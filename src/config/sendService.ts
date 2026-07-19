/**
 * Songnook Send — client configuration.
 *
 * The base URL is PUBLIC (not a secret): the app only ever calls the public API
 * and PUTs to short-lived presigned URLs the API returns. No credentials ship in
 * the app. Real builds hit the deployed service; dev defaults to a local
 * `wrangler dev`. Override either with EXPO_PUBLIC_SEND_BASE_URL (Expo inlines
 * EXPO_PUBLIC_* at build time; a gitignored .env works for the dev client).
 *
 * Mirrors the WORD_SERVICE_BASE_URL pattern in src/domain/wordTools.ts.
 */
const PRODUCTION_BASE_URL = "https://send.songnook.app";
const DEFAULT_LOCAL_BASE_URL = "http://localhost:8799";

export const SEND_SERVICE_BASE_URL = (
  process.env.EXPO_PUBLIC_SEND_BASE_URL || (__DEV__ ? DEFAULT_LOCAL_BASE_URL : PRODUCTION_BASE_URL)
).replace(/\/$/, "");

/** True once a real (non-localhost) endpoint is configured — gate UI on this so
 *  "Get a link" doesn't appear pointing at a dev box in shipped builds. */
export const isSendServiceConfigured = (): boolean =>
  !/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/.test(SEND_SERVICE_BASE_URL);
