/**
 * Core transfer API: create → items(presign) → finalize → metadata.
 *
 * Contract highlights (brief §3–§5):
 *  - transferId is returned at CREATE, before any upload (the app stamps it into
 *    the .songnook manifest, then uploads).
 *  - Nothing is fetchable until finalize.
 *  - Metadata works with no cookies / no Origin.
 *  - Files are opaque: we store bytes + name + mime, never inspect content.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import { loadConfig } from "../env";
import {
  bumpTransferSize,
  deleteTransfer,
  finalizeTransfer,
  getItems,
  getTransfer,
  insertItem,
  insertTransfer,
  setItemSize,
  setTransferSize,
} from "../lib/db";
import { errorResponse, jsonResponse, transferUsable } from "../lib/http";
import { newItemId, newTransferId, newUploadToken } from "../lib/ids";
import { presignUpload } from "../lib/r2presign";
import { toTransferPayload } from "../lib/serialize";
import { checkUploadAllowed, looksLikeZip, requiresZipMagic } from "../lib/contentPolicy";
import { clientIp, underRateLimit, webOriginAllowed } from "../lib/guard";
import { hashUploadToken, uploadTokenValid } from "../lib/uploadToken";

export const api = new Hono<{ Bindings: Env }>();

const MAX_ITEMS_PER_TRANSFER = 200;
const MAX_NAME_LEN = 260;

function clampText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
}

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function deleteDraftAndObjects(
  env: Env,
  transferId: string,
  items: Awaited<ReturnType<typeof getItems>>
): Promise<void> {
  const keys = items.map((item) => item.r2_key);
  if (keys.length > 0) {
    await env.BUCKET.delete(keys);
  }
  await deleteTransfer(env, transferId);
}

// ── 1. Create ───────────────────────────────────────────────────────────────
// POST /api/transfers  { title?, senderName?, message? } → { transferId, expiresAt }
api.post("/transfers", async (c) => {
  const cfg = loadConfig(c.env);
  if (!webOriginAllowed(c, cfg)) return errorResponse(403, "origin not allowed");
  if (!(await underRateLimit(c.env, "create", clientIp(c), cfg.rateCreatePerHour, 3600))) {
    return errorResponse(429, "too many transfers — try again later");
  }
  const body = await c.req.json().catch(() => ({}));
  const now = Date.now();

  const transferId = newTransferId();
  const uploadToken = newUploadToken();
  const expiresAt = now + cfg.expiryMs;

  await insertTransfer(c.env, {
    transfer_id: transferId,
    title: clampText(body.title, 200),
    sender_name: clampText(body.senderName, 80),
    sender_user_id: null, // v1: always null (accounts fill this later, no wire change)
    message: clampText(body.message, 1000),
    status: "draft",
    size_total: 0,
    created_at: now,
    expires_at: expiresAt,
    upload_token_hash: await hashUploadToken(uploadToken),
  });

  return jsonResponse(
    { transferId, uploadToken, expiresAt: new Date(expiresAt).toISOString() },
    { status: 201 }
  );
});

// ── 2. Register an item → presigned upload URL ──────────────────────────────
// POST /api/transfers/:id/items { fileName, mimeType, size } → { itemId, uploadUrl, headers }
api.post("/transfers/:id/items", async (c) => {
  const cfg = loadConfig(c.env);
  if (!webOriginAllowed(c, cfg)) return errorResponse(403, "origin not allowed");
  if (!(await underRateLimit(c.env, "items", clientIp(c), cfg.rateItemsPerHour, 3600))) {
    return errorResponse(429, "too many uploads — try again later");
  }
  const transferId = c.req.param("id");
  const transfer = await getTransfer(c.env, transferId);
  if (!transfer) return errorResponse(404, "transfer not found");
  if (transfer.status !== "draft") return errorResponse(409, "transfer already finalized");

  const body = bodyRecord(await c.req.json().catch(() => ({})));
  if (!(await uploadTokenValid(c, transfer, body))) {
    return errorResponse(401, "upload token required");
  }
  const fileName = clampText(body.fileName, MAX_NAME_LEN) || "file";
  const mimeType = clampText(body.mimeType, 120) || "application/octet-stream";
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return errorResponse(400, "invalid size");

  // Content allowlist: audio + .songnook only, checked on extension AND mime.
  const allowed = checkUploadAllowed(fileName, mimeType);
  if (!allowed.ok) return errorResponse(415, allowed.reason ?? "file type not accepted");

  const existing = await getItems(c.env, transferId);
  if (existing.length >= MAX_ITEMS_PER_TRANSFER) return errorResponse(400, "too many items");

  // Per-item and per-transfer size caps.
  if (size > cfg.maxItemBytes) return errorResponse(413, "file exceeds per-file size cap");
  if (transfer.size_total + size > cfg.maxTransferBytes) {
    return errorResponse(413, "transfer exceeds size cap");
  }

  const itemId = newItemId();
  const r2Key = `${transferId}/${itemId}`; // key is opaque; original name kept in metadata only
  const presigned = await presignUpload(c.env, r2Key, mimeType);

  await insertItem(c.env, {
    item_id: itemId,
    transfer_id: transferId,
    file_name: fileName,
    mime_type: mimeType,
    size,
    r2_key: r2Key,
    download_count: 0,
    created_at: Date.now(),
    sort_order: existing.length,
  });
  await bumpTransferSize(c.env, transferId, size);

  return jsonResponse(
    { itemId, uploadUrl: presigned.uploadUrl, method: presigned.method, headers: presigned.headers },
    { status: 201 }
  );
});

// ── 3. Finalize ─────────────────────────────────────────────────────────────
// POST /api/transfers/:id/finalize → { shareUrl }
api.post("/transfers/:id/finalize", async (c) => {
  const cfg = loadConfig(c.env);
  const transferId = c.req.param("id");
  const transfer = await getTransfer(c.env, transferId);
  if (!transfer) return errorResponse(404, "transfer not found");
  const body = bodyRecord(await c.req.json().catch(() => ({})));
  if (!(await uploadTokenValid(c, transfer, body))) {
    return errorResponse(401, "upload token required");
  }
  if (transfer.status === "finalized") {
    return jsonResponse({ shareUrl: `${cfg.publicOrigin}/t/${transferId}` });
  }

  const items = await getItems(c.env, transferId);
  if (items.length === 0) return errorResponse(400, "no items to finalize");

  // Verify what was ACTUALLY uploaded before making anything fetchable —
  // presigned PUT isn't size-bound and the bytes are otherwise untrusted.
  let actualTotal = 0;
  for (const item of items) {
    const head = await c.env.BUCKET.head(item.r2_key);
    if (!head) {
      await deleteDraftAndObjects(c.env, transferId, items);
      return errorResponse(409, `item not uploaded: ${item.file_name}`);
    }

    if (head.size <= 0 || head.size > cfg.maxItemBytes) {
      await deleteDraftAndObjects(c.env, transferId, items);
      return errorResponse(413, `file exceeds per-file size cap: ${item.file_name}`);
    }
    if (item.size > 0 && head.size > item.size) {
      await deleteDraftAndObjects(c.env, transferId, items);
      return errorResponse(413, `upload larger than declared: ${item.file_name}`);
    }
    actualTotal += head.size;
    if (head.size !== item.size) {
      await setItemSize(c.env, item.item_id, head.size);
    }

    // A .songnook file must be a real zip (blocks arbitrary bytes renamed to
    // .songnook). Cannot inspect INSIDE the zip — that's the opaque residual.
    if (requiresZipMagic(item.file_name)) {
      const obj = await c.env.BUCKET.get(item.r2_key, { range: { offset: 0, length: 4 } });
      const head4 = obj ? new Uint8Array(await obj.arrayBuffer()) : new Uint8Array();
      if (!looksLikeZip(head4)) {
        await deleteDraftAndObjects(c.env, transferId, items);
        return errorResponse(415, `not a valid songnook file: ${item.file_name}`);
      }
    }
  }
  if (actualTotal > cfg.maxTransferBytes) {
    await deleteDraftAndObjects(c.env, transferId, items);
    return errorResponse(413, "transfer exceeds size cap");
  }

  if (actualTotal !== transfer.size_total) {
    await setTransferSize(c.env, transferId, actualTotal);
  }
  await finalizeTransfer(c.env, transferId);
  return jsonResponse({ shareUrl: `${cfg.publicOrigin}/t/${transferId}` });
});

// ── 4. Metadata (cookie/Origin-free) ────────────────────────────────────────
// GET /api/transfers/:id → the §3 payload
api.get("/transfers/:id", async (c) => {
  const cfg = loadConfig(c.env);
  const transferId = c.req.param("id");
  const transfer = await getTransfer(c.env, transferId);
  if (!transfer) return errorResponse(404, "transfer not found");
  if (!transferUsable(transfer.status, transfer.expires_at, Date.now())) {
    // Draft (not yet fetchable) and expired both read as gone to a caller.
    return errorResponse(transfer.status === "draft" ? 404 : 410, "transfer unavailable");
  }

  const items = await getItems(c.env, transferId);
  return jsonResponse(toTransferPayload(cfg, transfer, items));
});
