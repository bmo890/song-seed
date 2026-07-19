/**
 * Ranged download proxy.
 *
 * Served through the Worker's R2 binding (no credentials, no egress fee) so we can:
 *  - gate on finalize + expiry (nothing fetchable until finalized / after expiry),
 *  - honor Range requests for resume on flaky mobile networks,
 *  - stamp noindex,
 *  - count downloads.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import { getItem, getTransfer, incrementDownload } from "../lib/db";
import { NOINDEX, transferUsable } from "../lib/http";

export const download = new Hono<{ Bindings: Env }>();

download.get("/:id/dl/:itemId", async (c) => {
  const transferId = c.req.param("id");
  const itemId = c.req.param("itemId");

  const transfer = await getTransfer(c.env, transferId);
  if (!transfer) return new Response("Not found", { status: 404 });
  if (!transferUsable(transfer.status, transfer.expires_at, Date.now())) {
    return new Response("Gone", { status: transfer.status === "draft" ? 404 : 410 });
  }

  const item = await getItem(c.env, transferId, itemId);
  if (!item) return new Response("Not found", { status: 404 });

  const rangeHeader = c.req.header("range");
  const range = parseRange(rangeHeader, item.size);

  const object = await c.env.BUCKET.get(item.r2_key, range ? { range } : undefined);
  if (!object) return new Response("Not found", { status: 404 });

  // Count only whole-file / initial fetches, not every resume chunk.
  if (!range || range.offset === 0) {
    c.executionCtx.waitUntil(incrementDownload(c.env, itemId));
  }

  const headers = new Headers();
  headers.set("content-type", item.mime_type || "application/octet-stream");
  headers.set("accept-ranges", "bytes");
  headers.set("x-robots-tag", NOINDEX);
  headers.set("cache-control", "private, no-store");
  headers.set(
    "content-disposition",
    `attachment; filename="${sanitizeFilename(item.file_name)}"`
  );
  if (object.httpEtag) headers.set("etag", object.httpEtag);

  if (range) {
    const end = range.offset + range.length - 1;
    headers.set("content-range", `bytes ${range.offset}-${end}/${item.size}`);
    headers.set("content-length", String(range.length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(item.size));
  return new Response(object.body, { status: 200, headers });
});

interface R2Range {
  offset: number;
  length: number;
}

/** Parse a single `bytes=start-end` range. Ignores multipart/malformed ranges. */
function parseRange(header: string | undefined, size: number): R2Range | null {
  if (!header || size <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, startStr, endStr] = m;

  if (startStr === "" && endStr === "") return null;

  // Suffix range: bytes=-N → last N bytes.
  if (startStr === "") {
    const suffix = Math.min(Number(endStr), size);
    if (suffix <= 0) return null;
    return { offset: size - suffix, length: suffix };
  }

  const start = Number(startStr);
  if (start >= size) return null;
  const end = endStr === "" ? size - 1 : Math.min(Number(endStr), size - 1);
  if (end < start) return null;
  return { offset: start, length: end - start + 1 };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_").slice(0, 200) || "file";
}
