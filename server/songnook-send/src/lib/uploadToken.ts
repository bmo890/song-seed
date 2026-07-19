/**
 * Draft mutation auth. The public transfer id is the recipient capability; this
 * token is the sender-side capability for adding items and finalizing.
 */
import type { Context } from "hono";
import type { Env } from "../env";
import type { TransferRow } from "./db";

const HASH_PREFIX = "sha256:";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashUploadToken(token: string): Promise<string> {
  return `${HASH_PREFIX}${await sha256Hex(token)}`;
}

function tokenFromRequest(c: Context<{ Bindings: Env }>, body: Record<string, unknown>): string {
  const bodyToken = body.uploadToken;
  if (typeof bodyToken === "string") return bodyToken;

  const headerToken = c.req.header("x-upload-token");
  if (headerToken) return headerToken;

  const auth = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1] ?? "";
}

/**
 * Legacy rows created before migration have no token hash. They are allowed so
 * in-flight drafts can still finish during a rolling deploy; every new transfer
 * gets a hash and requires the token.
 */
export async function uploadTokenValid(
  c: Context<{ Bindings: Env }>,
  transfer: TransferRow,
  body: Record<string, unknown>
): Promise<boolean> {
  if (!transfer.upload_token_hash) return true;
  const token = tokenFromRequest(c, body);
  if (!token) return false;
  return constantTimeEqual(await hashUploadToken(token), transfer.upload_token_hash);
}
