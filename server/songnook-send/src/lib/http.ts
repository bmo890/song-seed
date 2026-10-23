/**
 * Small response helpers. Metadata + download endpoints are deliberately
 * cookie-free and callable with no Origin (the link is the capability), so CORS
 * is permissive but no credentials/cookies are ever involved.
 */
export const NOINDEX = "noindex, nofollow, noarchive";

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": NOINDEX,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-upload-token, authorization",
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, { status });
}

/** Transfer is only usable once finalized and before expiry. */
export function transferUsable(status: string, expiresAt: number, now: number): boolean {
  return status === "finalized" && expiresAt > now;
}

/**
 * `Content-Disposition: attachment` for a user-typed file name. Header values
 * are Latin-1 byte strings, so a Hebrew clip title can't go in `filename=`
 * (throws or ships mojibake depending on the runtime). RFC 6266 shape: an
 * ASCII `filename=` fallback for old agents plus the real name in
 * `filename*=UTF-8''…` (RFC 5987 percent-encoding), which browsers prefer.
 */
export function attachmentDisposition(name: string): string {
  const safe = name.replace(/[\r\n"\\]/g, "_").slice(0, 200) || "file";
  // Fallback: printable ASCII only; a run of anything else becomes one "_".
  const asciiRaw = safe.replace(/[^\x20-\x7e]+/g, "_");
  const ascii = /[^_\s.]/.test(asciiRaw) ? asciiRaw : "file";
  // encodeURIComponent leaves *'() alone; RFC 5987 attr-char excludes them.
  const utf8 = encodeURIComponent(safe).replace(
    /[*'()]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
