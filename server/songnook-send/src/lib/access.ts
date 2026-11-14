/**
 * Access rules for sending (lib/senders.ts holds the storage and cookies): who
 * counts as Pro, how many free links are left, and the pairing code's shape.
 * No runtime imports, so the rules are tested on their own.
 */
import type { Config, Env } from "../env";

// The app's own count is domain/proCatalog.ts "send".freeLimit: keep the two the same
// (founder, 2026-11-14: one link per 30 days, was three).
export const FREE_LINKS = 1;
export const FREE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** How long a RevenueCat "has Pro" answer is trusted before asking again. */
const PRO_CACHE_MS = 6 * 60 * 60 * 1000;
/** A "no Pro" answer (never bought, or the paid time has run out) is trusted only
 *  this long: someone who just bought or renewed sends right away. */
const PRO_RECHECK_MS = 60 * 1000;

/** No I, L, O, 0 or 1: a code is read off one screen and typed on another. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export interface SenderRow {
  sender_id: string;
  created_at: number;
  rc_app_user_id: string | null;
  trial_ends_at: number | null;
  pro_until: number | null;
  pro_checked_at: number | null;
}

export type Access = { pro: boolean; freeLeft: number };

// ── Access ──────────────────────────────────────────────────────────────────

/** Pro-until from a RevenueCat v1 subscriber body: 0 when the entitlement is
 *  absent, Infinity for a lifetime purchase (no expiry). Grace periods count. */
export function proUntilFromSubscriber(body: unknown, entitlementId: string): number {
  const entitlement = (body as { subscriber?: { entitlements?: Record<string, unknown> } })?.subscriber
    ?.entitlements?.[entitlementId] as
    | { expires_date?: string | null; grace_period_expires_date?: string | null }
    | undefined;
  if (!entitlement) return 0;
  if (entitlement.expires_date == null) return Number.POSITIVE_INFINITY;
  const expires = Date.parse(entitlement.expires_date) || 0;
  const grace = entitlement.grace_period_expires_date ? Date.parse(entitlement.grace_period_expires_date) || 0 : 0;
  return Math.max(expires, grace);
}

/** RevenueCat turned the key away: every subscriber reads as free until it is fixed. */
export class BillingKeyRefused extends Error {}

async function revenueCatProUntil(cfg: Config, appUserId: string, fetchImpl: typeof fetch): Promise<number> {
  const res = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { authorization: `Bearer ${cfg.revenueCatSecretKey}`, accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) throw new BillingKeyRefused(`RevenueCat ${res.status}`);
  if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
  return proUntilFromSubscriber(await res.json(), cfg.proEntitlementId);
}

/** The customer the health check asks about: never a real install. */
const HEALTH_CHECK_USER = "songnook-send-health-check";

export type BillingHealth = { ok: true } | { ok: false; problem: string };

/** Can the server tell who has Pro? Without the key, or with one that isn't a
 *  RevenueCat secret key, every subscriber would silently read as free. */
export function billingKeyProblem(cfg: Config): string | null {
  if (!cfg.revenueCatSecretKey) return "REVENUECAT_SECRET_KEY is not set";
  if (!cfg.revenueCatSecretKey.startsWith("sk_")) return "REVENUECAT_SECRET_KEY is not a secret key (sk_...)";
  return null;
}

/** The same question, asked of RevenueCat itself: is the key accepted? */
export async function checkBilling(cfg: Config, fetchImpl: typeof fetch = fetch): Promise<BillingHealth> {
  const problem = billingKeyProblem(cfg);
  if (problem) return { ok: false, problem };
  try {
    await revenueCatProUntil(cfg, HEALTH_CHECK_USER, fetchImpl);
    return { ok: true };
  } catch (err) {
    if (err instanceof BillingKeyRefused) return { ok: false, problem: "RevenueCat refused REVENUECAT_SECRET_KEY" };
    return { ok: false, problem: "RevenueCat could not be reached" };
  }
}

async function linksInWindow(env: Env, senderId: string, now: number): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM send_log WHERE sender_id = ? AND created_at > ?`)
    .bind(senderId, now - FREE_WINDOW_MS)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** May this sender seal another link? Pro sends without limit; everyone else
 *  has FREE_LINKS per 30 days. While nothing is for sale (`proForAll`, the
 *  server's twin of the app's ALL_FEATURES_FREE) everyone is Pro. */
export async function senderAccess(
  env: Env,
  cfg: Config,
  sender: SenderRow,
  now: number,
  fetchImpl: typeof fetch = fetch
): Promise<Access> {
  const freeLeft = async () => Math.max(0, FREE_LINKS - (await linksInWindow(env, sender.sender_id, now)));
  if (cfg.proForAll) return { pro: true, freeLeft: FREE_LINKS };
  if ((sender.trial_ends_at ?? 0) > now) return { pro: true, freeLeft: await freeLeft() };

  // Selling with no key: nobody can be found to have Pro. Say so in the logs.
  if (!cfg.revenueCatSecretKey) console.error("billing: REVENUECAT_SECRET_KEY is not set, every sender reads as free");

  if (cfg.revenueCatSecretKey && sender.rc_app_user_id) {
    let until = sender.pro_until ?? 0;
    const trustedFor = until > now ? PRO_CACHE_MS : PRO_RECHECK_MS;
    const fresh = sender.pro_checked_at != null && now - sender.pro_checked_at < trustedFor;
    if (!fresh) {
      try {
        until = await revenueCatProUntil(cfg, sender.rc_app_user_id, fetchImpl);
        // D1 has no Infinity: a lifetime purchase is stored as the largest safe time.
        await env.DB.prepare(`UPDATE senders SET pro_until = ?, pro_checked_at = ? WHERE sender_id = ?`)
          .bind(Number.isFinite(until) ? until : Number.MAX_SAFE_INTEGER, now, sender.sender_id)
          .run();
      } catch (err) {
        // RevenueCat unreachable: the last answer stands (a payer is never
        // locked out by an outage; a stranger never had one).
        console.error(
          err instanceof BillingKeyRefused
            ? "billing: RevenueCat refused REVENUECAT_SECRET_KEY, every sender reads as free"
            : "revenuecat check failed",
          err
        );
      }
    }
    if (until > now) return { pro: true, freeLeft: await freeLeft() };
  }
  return { pro: false, freeLeft: await freeLeft() };
}

/** Uniform over the alphabet: bytes past the last whole multiple are redrawn. */
export function newPairingCode(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = "";
  while (out.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}

/** What a person typed, as a code: capitals, no spaces or dashes. */
export function normalizeCode(input: unknown): string {
  return typeof input === "string" ? input.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

/** "Chrome on Mac": enough for a person to recognise their own browser. */
export function browserLabel(userAgent: string): string {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)
      ? "Mac"
      : /iPhone|iPad/.test(ua)
        ? "iPhone"
        : /Android/.test(ua)
          ? "Android"
          : /Linux|CrOS/.test(ua)
            ? "Linux"
            : "";
  return system ? `${browser} on ${system}` : browser;
}
