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
import { Hono, type Context } from "hono";
import type { Env } from "../env";
import { loadConfig } from "../env";
import {
  deleteTransfer,
  finalizeTransfer,
  getItems,
  getTransfer,
  insertItemWithinCaps,
  insertTransfer,
  setItemSize,
  setTransferSize,
} from "../lib/db";
import { errorResponse, jsonResponse, transferUsable } from "../lib/http";
import { newItemId, newTransferId, newUploadToken } from "../lib/ids";
import { presignUpload } from "../lib/r2presign";
import { toTransferPayload } from "../lib/serialize";
import {
  checkUploadAllowed,
  isSealedItemName,
  looksLikeZip,
  looksSealed,
  requiresZipMagic,
  sealedMetaValid,
} from "../lib/contentPolicy";
import { clientIp, underRateLimit, webOriginAllowed } from "../lib/guard";
import { hashUploadToken, uploadTokenValid } from "../lib/uploadToken";
import { normalizeShareKind } from "../lib/shareKind";
import { recordSend, senderAccess, senderFromApp, senderFromBrowser, type SenderRow } from "../lib/senders";

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

/** Who is sealing this parcel, and may they (lib/senders.ts)? A browser (it
 *  sends an Origin) must be paired with the app; the app names itself with
 *  its send key. Returns the sender (null when unknown and allowed) or the
 *  refusal to send back. */
async function senderForCreate(
  c: Context<{ Bindings: Env }>,
  now: number
): Promise<{ sender: SenderRow | null } | { refusal: Response }> {
  const cfg = loadConfig(c.env);
  const fromBrowser = !!c.req.header("origin");
  let sender: SenderRow | null = null;
  if (fromBrowser) {
    sender = (await senderFromBrowser(c, now))?.sender ?? null;
    if (!sender && cfg.webSendRequiresPairing) {
      return { refusal: jsonResponse({ error: "pair this browser first", code: "pair" }, { status: 401 }) };
    }
  } else {
    sender = await senderFromApp(c, now);
    if (!sender && cfg.appSendEnforced) {
      return { refusal: jsonResponse({ error: "update SongNook to send", code: "update" }, { status: 401 }) };
    }
  }
  const mustCheck = fromBrowser ? cfg.webSendRequiresPairing : cfg.appSendEnforced;
  if (sender && mustCheck) {
    const access = await senderAccess(c.env, cfg, sender, now);
    if (!access.pro && access.freeLeft <= 0) {
      return { refusal: jsonResponse({ error: "free links used", code: "limit" }, { status: 402 }) };
    }
  }
  return { sender };
}

// ── 1. Create ───────────────────────────────────────────────────────────────
// POST /api/transfers  { title?, senderName?, message?, kind? } → { transferId, expiresAt }
api.post("/transfers", async (c) => {
  const cfg = loadConfig(c.env);
  if (!webOriginAllowed(c, cfg)) return errorResponse(403, "origin not allowed");
  if (!(await underRateLimit(c.env, "create", clientIp(c), cfg.rateCreatePerHour, 3600))) {
    return errorResponse(429, "too many transfers — try again later");
  }
  // A `null` / primitive JSON body is a valid parse — normalise before `.title`.
  const body = bodyRecord(await c.req.json().catch(() => ({})));
  const now = Date.now();
  const who = await senderForCreate(c, now);
  if ("refusal" in who) return who.refusal;
  // A sealed parcel is bytes the server can't read: only a known sender (the
  // app's key or a paired browser) may leave one, and it carries no plain
  // title, sender or note at all.
  const sealed = body.sealed === true;
  if (sealed) {
    if (!who.sender) return jsonResponse({ error: "update SongNook to send", code: "update" }, { status: 401 });
    if (!sealedMetaValid(body.sealedMeta)) return errorResponse(400, "sealed envelope missing or malformed");
  }

  const transferId = newTransferId();
  const uploadToken = newUploadToken();
  const expiresAt = now + cfg.expiryMs;

  await insertTransfer(c.env, {
    transfer_id: transferId,
    title: sealed ? "" : clampText(body.title, 200),
    sender_name: sealed ? "" : clampText(body.senderName, 80),
    sender_user_id: null, // v1: always null (accounts fill this later, no wire change)
    message: sealed ? "" : clampText(body.message, 1000),
    share_kind: normalizeShareKind(body.kind),
    status: "draft",
    size_total: 0,
    created_at: now,
    expires_at: expiresAt,
    upload_token_hash: await hashUploadToken(uploadToken),
    sender_id: who.sender?.sender_id ?? null,
    sealed: sealed ? 1 : 0,
    sealed_meta: sealed ? (body.sealedMeta as string) : null,
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
  // A sealed item's real type is sealed too: the server stores bytes.
  const mimeType =
    transfer.sealed === 1 ? "application/octet-stream" : clampText(body.mimeType, 120) || "application/octet-stream";
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return errorResponse(400, "invalid size");

  // Content allowlist: audio + .songnook only, checked on extension AND mime.
  // A sealed parcel's items are numbered `N.sealed` (real names are sealed).
  if (transfer.sealed === 1) {
    if (!isSealedItemName(fileName)) return errorResponse(415, "a sealed parcel takes only sealed items");
  } else {
    const allowed = checkUploadAllowed(fileName, mimeType);
    if (!allowed.ok) return errorResponse(415, allowed.reason ?? "file type not accepted");
  }

  // Early, precise answers for the plain cases; the insert below re-checks the
  // item and byte caps atomically, since these reads race parallel registrations.
  const existing = await getItems(c.env, transferId);
  if (existing.length >= MAX_ITEMS_PER_TRANSFER) return errorResponse(400, "too many items");

  // Per-item and per-transfer size caps.
  if (size > cfg.maxItemBytes) return errorResponse(413, "file exceeds per-file size cap");
  if (transfer.size_total + size > cfg.maxTransferBytes) {
    return errorResponse(413, "transfer exceeds size cap");
  }

  const itemId = newItemId();
  const r2Key = `${transferId}/${itemId}`; // key is opaque; original name kept in metadata only

  const landed = await insertItemWithinCaps(
    c.env,
    {
      item_id: itemId,
      transfer_id: transferId,
      file_name: fileName,
      mime_type: mimeType,
      size,
      r2_key: r2Key,
      download_count: 0,
      created_at: Date.now(),
    },
    { maxTotalBytes: cfg.maxTransferBytes, maxItems: MAX_ITEMS_PER_TRANSFER }
  );
  // Lost a race: a parallel registration (or finalize) used the room first.
  if (!landed) return errorResponse(413, "transfer exceeds size cap");

  const presigned = await presignUpload(c.env, r2Key, mimeType, size);

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

    // A sealed item must at least be SNS1 (the server can see no further).
    if (transfer.sealed === 1) {
      const obj = await c.env.BUCKET.get(item.r2_key, { range: { offset: 0, length: 4 } });
      const head4 = obj ? new Uint8Array(await obj.arrayBuffer()) : new Uint8Array();
      if (!looksSealed(head4)) {
        await deleteDraftAndObjects(c.env, transferId, items);
        return errorResponse(415, `not a sealed file: ${item.file_name}`);
      }
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
  // A sealed link counts toward its sender's free allowance.
  if (transfer.sender_id) await recordSend(c.env, transfer.sender_id, Date.now());
  return jsonResponse({ shareUrl: `${cfg.publicOrigin}/t/${transferId}` });
});

// ── Delete (the sender takes a link back) ───────────────────────────────────
// DELETE /api/transfers/:id  (upload token in x-upload-token or the body) → 204
// The files go at once; the link reads as gone from then on. Already gone is
// success: the sender's wish is met either way.
api.delete("/transfers/:id", async (c) => {
  const transferId = c.req.param("id");
  const transfer = await getTransfer(c.env, transferId);
  if (!transfer) return new Response(null, { status: 204 });
  const body = bodyRecord(await c.req.json().catch(() => ({})));
  if (!(await uploadTokenValid(c, transfer, body))) {
    return errorResponse(401, "upload token required");
  }
  await deleteDraftAndObjects(c.env, transferId, await getItems(c.env, transferId));
  return new Response(null, { status: 204 });
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
