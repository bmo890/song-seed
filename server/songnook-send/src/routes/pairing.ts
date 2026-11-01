/**
 * Pairing a browser with the app (founder, 2026-11-01), so a person sends from
 * a computer as their own SongNook install, Pro included, with no account.
 *
 *   browser  POST /api/pairings        → a 6-character code; the secret rides in a cookie
 *   app      POST /api/pairings/claim  { code } with its send key
 *   browser  GET  /api/session         → { paired, pro, freeLeft } (turns a claimed
 *                                         pairing into a 30-day session cookie)
 *   browser  DELETE /api/session       → unpair this browser
 *   app      GET  /api/browsers        → the browsers it has paired
 *   app      DELETE /api/browsers/:id  → remove one
 *
 * Cookies are HttpOnly, Secure, SameSite=Strict and scoped to /api: the page's
 * script never sees them and no other site can send them.
 */
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";
import { loadConfig } from "../env";
import { NOINDEX, errorResponse, jsonResponse } from "../lib/http";
import { clientIp, underRateLimit, webOriginAllowed } from "../lib/guard";
import {
  BROWSER_TTL_MS,
  PAIR_COOKIE,
  PAIRING_TTL_MS,
  SESSION_COOKIE,
  claimPairing,
  completePairing,
  createPairing,
  listBrowsers,
  normalizeCode,
  pairingForSecret,
  removeBrowser,
  senderAccess,
  senderFromApp,
  senderFromBrowser,
  type SenderRow,
} from "../lib/senders";

export const pairing = new Hono<{ Bindings: Env }>();

type C = Context<{ Bindings: Env }>;

const cookieOptions = (maxAgeMs: number) =>
  ({ path: "/api", httpOnly: true, secure: true, sameSite: "Strict", maxAge: Math.floor(maxAgeMs / 1000) }) as const;

async function bodyOf(c: C): Promise<Record<string, unknown>> {
  const value = await c.req.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// ── Browser ─────────────────────────────────────────────────────────────────

pairing.post("/pairings", async (c) => {
  const cfg = loadConfig(c.env);
  if (!c.req.header("origin") || !webOriginAllowed(c, cfg)) return errorResponse(403, "origin not allowed");
  if (!(await underRateLimit(c.env, "pair", clientIp(c), 30, 3600))) {
    return errorResponse(429, "too many codes — try again later");
  }
  const now = Date.now();
  const made = await createPairing(c.env, c.req.header("user-agent") ?? "", now);
  setCookie(c, PAIR_COOKIE, made.secret, cookieOptions(PAIRING_TTL_MS));
  return respond(c, { code: made.code, expiresAt: new Date(made.expiresAt).toISOString() }, 201);
});

pairing.get("/session", async (c) => {
  const cfg = loadConfig(c.env);
  const now = Date.now();
  const paired = await senderFromBrowser(c, now);
  if (paired) {
    const access = await senderAccess(c.env, cfg, paired.sender, now);
    return jsonResponse({ paired: true, label: paired.browser.label, pro: access.pro, freeLeft: access.freeLeft });
  }
  const pending = await pairingForSecret(c.env, getCookie(c, PAIR_COOKIE) ?? "", now);
  if (pending?.sender_id) {
    const session = await completePairing(c.env, pending, now);
    deleteCookie(c, PAIR_COOKIE, { path: "/api" });
    // Removed in the app before this browser checked in: start over.
    if (!session) return respond(c, { paired: false, pairing: null });
    setCookie(c, SESSION_COOKIE, session.sessionSecret, cookieOptions(BROWSER_TTL_MS));
    const sender = await c.env.DB.prepare(`SELECT * FROM senders WHERE sender_id = ?`)
      .bind(pending.sender_id)
      .first<SenderRow>();
    const access = sender ? await senderAccess(c.env, cfg, sender, now) : { pro: false, freeLeft: 0 };
    return respond(c, { paired: true, pro: access.pro, freeLeft: access.freeLeft });
  }
  return jsonResponse({
    paired: false,
    pairing: pending ? { code: pending.code, expiresAt: new Date(pending.expires_at).toISOString() } : null,
  });
});

pairing.delete("/session", async (c) => {
  const now = Date.now();
  const paired = await senderFromBrowser(c, now);
  if (paired) await removeBrowser(c.env, paired.sender.sender_id, paired.browser.browser_id);
  deleteCookie(c, SESSION_COOKIE, { path: "/api" });
  return respond(c, { paired: false });
});

/** JSON through the context, so the cookies set on it go out with the body. */
function respond(c: C, data: unknown, status: 200 | 201 = 200): Response {
  return c.json(data, status, { "cache-control": "no-store", "x-robots-tag": NOINDEX });
}

// ── App ─────────────────────────────────────────────────────────────────────

pairing.post("/pairings/claim", async (c) => {
  const now = Date.now();
  if (!(await underRateLimit(c.env, "pair", clientIp(c), 30, 3600))) {
    return errorResponse(429, "too many tries — wait a minute");
  }
  const sender = await senderFromApp(c, now);
  if (!sender) return jsonResponse({ error: "update SongNook to pair", code: "update" }, { status: 401 });
  const code = normalizeCode((await bodyOf(c)).code);
  if (!(await claimPairing(c.env, code, sender.sender_id, now))) {
    return jsonResponse({ error: "no such code", code: "badCode" }, { status: 404 });
  }
  return jsonResponse({ ok: true });
});

pairing.get("/browsers", async (c) => {
  const now = Date.now();
  const sender = await senderFromApp(c, now);
  if (!sender) return jsonResponse({ error: "update SongNook", code: "update" }, { status: 401 });
  const rows = await listBrowsers(c.env, sender.sender_id, now);
  return jsonResponse({
    browsers: rows.map((row) => ({
      id: row.browser_id,
      label: row.label,
      pairedAt: new Date(row.created_at).toISOString(),
      lastUsedAt: new Date(row.last_used_at).toISOString(),
    })),
  });
});

pairing.delete("/browsers/:id", async (c) => {
  const now = Date.now();
  const sender = await senderFromApp(c, now);
  if (!sender) return jsonResponse({ error: "update SongNook", code: "update" }, { status: 401 });
  await removeBrowser(c.env, sender.sender_id, c.req.param("id"));
  return new Response(null, { status: 204 });
});
