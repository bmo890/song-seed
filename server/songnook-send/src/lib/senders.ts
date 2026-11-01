/**
 * Who may send (founder, 2026-11-01). There are no accounts: a SENDER is one
 * SongNook install, known only by the hash of a random key the app keeps in
 * its secure store. A browser sends as that install once the person has typed
 * the browser's short pairing code into the app (Settings, Send from a
 * computer). Pro comes from RevenueCat, asked with a secret key only this
 * Worker holds; a free sender gets FREE_LINKS sealed links per 30 days, the
 * same allowance whether they send from the phone or a paired browser.
 *
 * Recipients never meet any of this: a link stays the whole capability.
 */
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "../env";
import { randomBase62 } from "./ids";
import { sha256Hex } from "./uploadToken";
import { CODE_LENGTH, FREE_WINDOW_MS, browserLabel, newPairingCode, type SenderRow } from "./access";

export { FREE_LINKS, senderAccess, normalizeCode, type Access, type SenderRow } from "./access";

/** The app's free month, at most this long after the server first saw the install. */
const TRIAL_MAX_MS = 31 * 24 * 60 * 60 * 1000;
export const PAIRING_TTL_MS = 10 * 60 * 1000;
export const BROWSER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SENDER_HEADER = "x-songnook-sender";
export const RC_HEADER = "x-songnook-rc";
export const TRIAL_HEADER = "x-songnook-trial-ends";
export const PAIR_COOKIE = "sn_pair";
export const SESSION_COOKIE = "sn_session";

export interface PairingRow {
  pairing_hash: string;
  code: string;
  sender_id: string | null;
  user_agent: string;
  created_at: number;
  expires_at: number;
}

export interface BrowserRow {
  browser_id: string;
  session_hash: string;
  sender_id: string;
  label: string;
  created_at: number;
  last_used_at: number;
  expires_at: number;
}

const KEY_SHAPE = /^[A-Za-z0-9_-]{20,200}$/;

export async function senderIdForKey(key: string): Promise<string> {
  return `s_${await sha256Hex(key)}`;
}

const secretHash = async (secret: string) => `sha256:${await sha256Hex(secret)}`;

// ── The app ─────────────────────────────────────────────────────────────────

/** The sending install, from the app's headers; registered on first sight.
 *  Null when the request carries no (well-formed) send key. */
export async function senderFromApp(c: Context<{ Bindings: Env }>, now: number): Promise<SenderRow | null> {
  const key = c.req.header(SENDER_HEADER) ?? "";
  if (!KEY_SHAPE.test(key)) return null;
  const senderId = await senderIdForKey(key);
  const rc = (c.req.header(RC_HEADER) ?? "").trim().slice(0, 200) || null;
  const trialClaim = Number(c.req.header(TRIAL_HEADER));

  await c.env.DB.prepare(`INSERT OR IGNORE INTO senders (sender_id, created_at, rc_app_user_id) VALUES (?, ?, ?)`)
    .bind(senderId, now, rc)
    .run();
  const row = await c.env.DB.prepare(`SELECT * FROM senders WHERE sender_id = ?`).bind(senderId).first<SenderRow>();
  if (!row) return null;

  const trial = Number.isFinite(trialClaim) && trialClaim > 0 ? Math.min(trialClaim, row.created_at + TRIAL_MAX_MS) : null;
  const rcChanged = rc != null && rc !== row.rc_app_user_id;
  const trialChanged = trial != null && trial !== row.trial_ends_at;
  if (rcChanged || trialChanged) {
    const next: SenderRow = {
      ...row,
      rc_app_user_id: rc ?? row.rc_app_user_id,
      trial_ends_at: trial ?? row.trial_ends_at,
      // A new RevenueCat identity (a restore, a new purchase) is asked afresh.
      pro_checked_at: rcChanged ? null : row.pro_checked_at,
    };
    await c.env.DB.prepare(
      `UPDATE senders SET rc_app_user_id = ?, trial_ends_at = ?, pro_checked_at = ? WHERE sender_id = ?`
    )
      .bind(next.rc_app_user_id, next.trial_ends_at, next.pro_checked_at, senderId)
      .run();
    return next;
  }
  return row;
}

export async function recordSend(env: Env, senderId: string, now: number): Promise<void> {
  await env.DB.prepare(`INSERT INTO send_log (sender_id, created_at) VALUES (?, ?)`).bind(senderId, now).run();
}

// ── Pairing a browser ───────────────────────────────────────────────────────

/** A browser asks to be paired: it keeps the secret, the person reads the code. */
export async function createPairing(
  env: Env,
  userAgent: string,
  now: number
): Promise<{ secret: string; code: string; expiresAt: number }> {
  const secret = `pr_${randomBase62(24)}`;
  const hash = await secretHash(secret);
  const expiresAt = now + PAIRING_TTL_MS;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairingCode();
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO pairings (pairing_hash, code, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(hash, code, userAgent.slice(0, 300), now, expiresAt)
      .run();
    if ((res.meta?.changes ?? 0) === 1) return { secret, code, expiresAt };
    // A live code collided: drop any expired rows holding codes, then draw again.
    await env.DB.prepare(`DELETE FROM pairings WHERE expires_at < ?`).bind(now).run();
  }
  throw new Error("no free pairing code");
}

export async function pairingForSecret(env: Env, secret: string, now: number): Promise<PairingRow | null> {
  if (!secret) return null;
  return await env.DB.prepare(`SELECT * FROM pairings WHERE pairing_hash = ? AND expires_at > ?`)
    .bind(await secretHash(secret), now)
    .first<PairingRow>();
}

/** Until the browser collects its session, its row holds this in place of
 *  the session's hash: it is listed (and removable) in the app at once. */
const pendingMark = (pairingHash: string) => `pending:${pairingHash}`;

/** The app claims a code it was shown. True only for a live, unclaimed code;
 *  the browser is paired from that moment and shows in the app's list. */
export async function claimPairing(env: Env, code: string, senderId: string, now: number): Promise<boolean> {
  if (code.length !== CODE_LENGTH) return false;
  const pairing = await env.DB.prepare(`SELECT * FROM pairings WHERE code = ? AND sender_id IS NULL AND expires_at > ?`)
    .bind(code, now)
    .first<PairingRow>();
  if (!pairing) return false;
  const res = await env.DB.prepare(`UPDATE pairings SET sender_id = ? WHERE pairing_hash = ? AND sender_id IS NULL`)
    .bind(senderId, pairing.pairing_hash)
    .run();
  if ((res.meta?.changes ?? 0) !== 1) return false;
  await env.DB.prepare(
    `INSERT INTO browsers (browser_id, session_hash, sender_id, label, created_at, last_used_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      `b_${randomBase62(10)}`,
      pendingMark(pairing.pairing_hash),
      senderId,
      browserLabel(pairing.user_agent),
      now,
      now,
      now + BROWSER_TTL_MS
    )
    .run();
  return true;
}

/** The browser collects its session: a claimed pairing becomes a session
 *  secret, and the pairing is spent. Null when the app removed the browser
 *  before it got here. */
export async function completePairing(
  env: Env,
  pairing: PairingRow,
  now: number
): Promise<{ sessionSecret: string; expiresAt: number } | null> {
  if (!pairing.sender_id) return null;
  const sessionSecret = `bs_${randomBase62(24)}`;
  const expiresAt = now + BROWSER_TTL_MS;
  const [updated] = await env.DB.batch([
    env.DB.prepare(`UPDATE browsers SET session_hash = ?, expires_at = ?, last_used_at = ? WHERE session_hash = ?`).bind(
      await secretHash(sessionSecret),
      expiresAt,
      now,
      pendingMark(pairing.pairing_hash)
    ),
    env.DB.prepare(`DELETE FROM pairings WHERE pairing_hash = ?`).bind(pairing.pairing_hash),
  ]);
  if ((updated?.meta?.changes ?? 0) !== 1) return null;
  return { sessionSecret, expiresAt };
}

/** The sender behind a paired browser's session cookie, or null. */
export async function senderFromBrowser(
  c: Context<{ Bindings: Env }>,
  now: number
): Promise<{ sender: SenderRow; browser: BrowserRow } | null> {
  const secret = getCookie(c, SESSION_COOKIE) ?? "";
  if (!secret) return null;
  const browser = await c.env.DB.prepare(`SELECT * FROM browsers WHERE session_hash = ? AND expires_at > ?`)
    .bind(await secretHash(secret), now)
    .first<BrowserRow>();
  if (!browser) return null;
  const sender = await c.env.DB.prepare(`SELECT * FROM senders WHERE sender_id = ?`)
    .bind(browser.sender_id)
    .first<SenderRow>();
  if (!sender) return null;
  if (now - browser.last_used_at > 60 * 60 * 1000) {
    await c.env.DB.prepare(`UPDATE browsers SET last_used_at = ? WHERE browser_id = ?`)
      .bind(now, browser.browser_id)
      .run();
  }
  return { sender, browser };
}

export async function listBrowsers(env: Env, senderId: string, now: number): Promise<BrowserRow[]> {
  const res = await env.DB.prepare(
    `SELECT * FROM browsers WHERE sender_id = ? AND expires_at > ? ORDER BY created_at DESC`
  )
    .bind(senderId, now)
    .all<BrowserRow>();
  return res.results ?? [];
}

export async function removeBrowser(env: Env, senderId: string, browserId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM browsers WHERE browser_id = ? AND sender_id = ?`).bind(browserId, senderId).run();
}

/** Nightly: spent pairings, lapsed browsers, and send counts past the window. */
export async function sweepSenders(env: Env, now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM pairings WHERE expires_at < ?`).bind(now),
    env.DB.prepare(`DELETE FROM browsers WHERE expires_at < ?`).bind(now),
    env.DB.prepare(`DELETE FROM send_log WHERE created_at < ?`).bind(now - FREE_WINDOW_MS - 24 * 60 * 60 * 1000),
  ]);
}
