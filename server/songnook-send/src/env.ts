/**
 * Worker runtime bindings + config. Secrets and non-secret vars are surfaced here
 * so the rest of the code never reaches into raw `env` and never hardcodes a key.
 */
export interface Env {
  // Bindings
  DB: D1Database;
  BUCKET: R2Bucket;
  /** KV for per-IP rate limiting. Optional — fail-open when absent (dev). */
  RATE?: KVNamespace;

  // Public, non-secret vars (from wrangler.toml [vars]) — safe everywhere.
  PUBLIC_ORIGIN: string;
  MAX_TRANSFER_BYTES: string;
  MAX_ITEM_BYTES: string;
  EXPIRY_DAYS: string;
  /** Drafts with unfinished uploads are swept sooner than finalized links. */
  DRAFT_EXPIRY_HOURS?: string;
  IOS_APP_STORE_URL: string;
  ANDROID_PACKAGE: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  /** Comma-separated browser origins allowed to call the write API. */
  ALLOWED_WEB_ORIGINS?: string;
  /** Per-IP write limits (fixed window). */
  RATE_CREATE_PER_HOUR?: string;
  RATE_ITEMS_PER_HOUR?: string;

  // Optional universal-link identity (supplied by the app team; placeholders until then).
  APPLE_TEAM_ID?: string;
  ANDROID_CERT_FINGERPRINTS?: string; // comma-separated SHA-256 fingerprints

  // Secrets (Worker secrets / .dev.vars — NEVER committed). Only used to presign uploads.
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;

  // Optional: abuse-report destination.
  ABUSE_CONTACT_EMAIL?: string;
}

export interface Config {
  publicOrigin: string;
  maxTransferBytes: number;
  maxItemBytes: number;
  expiryMs: number;
  draftExpiryMs: number;
  iosAppStoreUrl: string;
  androidPackage: string;
  r2AccountId: string;
  r2Bucket: string;
  abuseEmail: string;
  allowedWebOrigins: string[];
  rateCreatePerHour: number;
  rateItemsPerHour: number;
}

export function loadConfig(env: Env): Config {
  const expiryDays = Number(env.EXPIRY_DAYS) || 7;
  const publicOrigin = (env.PUBLIC_ORIGIN || "https://send.songnook.app").replace(/\/$/, "");
  const configuredOrigins = (env.ALLOWED_WEB_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Always trust our own page's origin; allow localhost for dev.
  const allowedWebOrigins = Array.from(
    new Set([publicOrigin, "http://localhost:8799", ...configuredOrigins])
  );
  return {
    publicOrigin,
    maxTransferBytes: Number(env.MAX_TRANSFER_BYTES) || 1024 * 1024 * 1024,
    maxItemBytes: Number(env.MAX_ITEM_BYTES) || 512 * 1024 * 1024,
    expiryMs: expiryDays * 24 * 60 * 60 * 1000,
    draftExpiryMs: (Number(env.DRAFT_EXPIRY_HOURS) || 24) * 60 * 60 * 1000,
    iosAppStoreUrl: env.IOS_APP_STORE_URL || "",
    androidPackage: env.ANDROID_PACKAGE || "com.bmostudio.songseed",
    r2AccountId: env.R2_ACCOUNT_ID || "",
    r2Bucket: env.R2_BUCKET || "songnook-send",
    abuseEmail: env.ABUSE_CONTACT_EMAIL || "abuse@songnook.app",
    allowedWebOrigins,
    rateCreatePerHour: Number(env.RATE_CREATE_PER_HOUR) || 30,
    rateItemsPerHour: Number(env.RATE_ITEMS_PER_HOUR) || 300,
  };
}
