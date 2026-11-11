/**
 * Where SongNook's public legal pages live. Served by the Send Worker on the
 * bare domain (server/songnook-send/src/pages/legal.ts), generated from
 * docs/privacy-policy.md and docs/terms-of-use.md — the same text the store
 * listings link to, so the app and the stores never disagree.
 */
export const PRIVACY_POLICY_URL = "https://songnook.app/privacy";
export const TERMS_OF_USE_URL = "https://songnook.app/terms";
/** The help page the store listings name as the Support URL (same Worker, pages/legal.ts). */
export const SUPPORT_URL = "https://songnook.app/support";

/** The one inbox for feedback, deletion requests and abuse reports (the policy names it). */
export const SONGNOOK_EMAIL = "bmostudio.dev@gmail.com";

/**
 * Where "Rate SongNook" lands: the store's own write-a-review page. Android tries
 * the Play app first, then the web listing.
 */
export const IOS_REVIEW_URL = "https://apps.apple.com/app/id6810435199?action=write-review";
export const ANDROID_REVIEW_URL = "market://details?id=com.bmostudio.songnook";
export const ANDROID_REVIEW_WEB_URL = "https://play.google.com/store/apps/details?id=com.bmostudio.songnook";
