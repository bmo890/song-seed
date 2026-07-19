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
      "x-robots-tag": NOINDEX,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
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
