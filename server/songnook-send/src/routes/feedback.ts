/**
 * The app's feedback sheet posts here (founder, 2026-11-11):
 *
 *   app  POST /api/feedback  { note, version, update, platform, locale }  → { ok: true }
 *
 * No send key and no cookie: a note is anonymous on purpose. Each note is also
 * emailed to the founder when the EMAIL binding is set (lib/feedback.ts). Per-IP rate
 * limiting and a small body cap keep it from being a place to dump text.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import { loadConfig } from "../env";
import { errorResponse, jsonResponse } from "../lib/http";
import { clientIp, underRateLimit, webOriginAllowed } from "../lib/guard";
import { insertFeedback, notifyFeedback, parseFeedback } from "../lib/feedback";

/** Four bytes a character at the note's cap, plus the labels, is well under this. */
const MAX_BODY_BYTES = 16 * 1024;

export const feedback = new Hono<{ Bindings: Env }>();

feedback.post("/feedback", async (c) => {
  if (!webOriginAllowed(c, loadConfig(c.env))) return errorResponse(403, "origin not allowed");
  if (!(await underRateLimit(c.env, "feedback", clientIp(c), 10, 3600))) {
    return errorResponse(429, "too many notes — try again later");
  }
  if (Number(c.req.header("content-length")) > MAX_BODY_BYTES) return errorResponse(413, "note too long");
  const raw = await c.req.text();
  if (raw.length > MAX_BODY_BYTES) return errorResponse(413, "note too long");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, "invalid body");
  }
  // A `null` / primitive / array JSON body is a valid parse — normalise first.
  const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const parsed = parseFeedback(record);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  const now = Date.now();
  await insertFeedback(c.env, parsed.value, now);
  // The founder's copy goes out after the answer: a slow mail never holds the app.
  const mail = notifyFeedback(c.env, parsed.value, now);
  try {
    c.executionCtx.waitUntil(mail);
  } catch {
    await mail; // no execution context (tests): finish here
  }
  return jsonResponse({ ok: true });
});
