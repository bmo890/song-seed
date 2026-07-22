/**
 * Base URL for the Magpie Hebrew-source proxy — a Cloudflare Worker that fronts
 * the Project Ben-Yehuda public API (holds the API key, caches an index of
 * eligible works). See server/magpie-benyehuda/.
 *
 * Mirrors the WORD_SERVICE_BASE_URL / SEND_SERVICE_BASE_URL pattern. Left empty
 * until the worker is deployed: the Hebrew source is gated on MAGPIE_HE_ENABLED,
 * so the Magpie language toggle only appears once this points at a live worker.
 * To turn it on: deploy the worker, then set this to its URL (no trailing slash).
 */
export const MAGPIE_HE_SERVICE_BASE_URL = "https://songnook-magpie-benyehuda.bmostudio-dev.workers.dev";

/** Whether the Hebrew (Ben-Yehuda) Magpie source is available. */
export const MAGPIE_HE_ENABLED = MAGPIE_HE_SERVICE_BASE_URL.length > 0;

/** Prose-family genres the Hebrew source can draw from — the user picks any
 * non-empty subset via the Magpie settings. Poetry/drama are excluded (verse is
 * too song-shaped); reference/lexicon are dictionaries. Keep in sync with
 * CANDIDATE_GENRES in server/magpie-benyehuda/worker.js. */
export const MAGPIE_HE_GENRES = ["prose", "memoir", "letters", "fables"] as const;
export type MagpieHeGenre = (typeof MAGPIE_HE_GENRES)[number];
export const MAGPIE_HE_DEFAULT_GENRES: MagpieHeGenre[] = ["prose"];
