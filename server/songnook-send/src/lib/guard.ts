/**
 * Request guards for the write endpoints (create / register-item).
 *
 * These are the anti-abuse layer that keeps the API from being used as a free
 * file host. They are intentionally coarse and fail-open in dev (no KV bound):
 * the strong controls for public launch are Turnstile (web) + App Attest /
 * Play Integrity (app), added later.
 */
import type { Context } from "hono";
import type { Config, Env } from "../env";

export function clientIp(c: Context): string {
  return c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
}

/**
 * Browser callers must come from an allowed origin (blocks other sites' JS).
 * The native app sends no Origin header → allowed (leaned on by rate limiting +
 * later attestation). A script can forge/omit Origin — that's what rate limits
 * and attestation are for, not this check.
 */
export function webOriginAllowed(c: Context, cfg: Config): boolean {
  const origin = c.req.header("origin");
  if (!origin) return true;
  return cfg.allowedWebOrigins.includes(origin);
}

/**
 * Per-IP fixed-window rate limit backed by KV. Approximate (KV is eventually
 * consistent) — enough to blunt scripted abuse. Fail-open if RATE isn't bound so
 * local dev isn't blocked. Returns true when the request is allowed.
 */
export async function underRateLimit(
  env: Env,
  bucket: string,
  ip: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  if (!env.RATE) return true;
  const windowId = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${bucket}:${ip}:${windowId}`;
  const current = parseInt((await env.RATE.get(key)) || "0", 10);
  if (current >= limit) return false;
  // TTL of two windows so stale counters self-expire.
  await env.RATE.put(key, String(current + 1), { expirationTtl: windowSec * 2 });
  return true;
}
