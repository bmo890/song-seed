/**
 * Presigned R2 upload URLs.
 *
 * Uploads go browser/app → R2 directly (bytes never touch the Worker). To allow
 * that without ever exposing a credential, the Worker signs a short-lived PUT URL
 * using the R2 S3 API token. The credential stays server-side; the client only
 * ever receives the signed URL.
 *
 * Downloads deliberately do NOT use presigning — they go through the Worker's R2
 * binding (see routes/download.ts) so we can gate on finalize/expiry and count.
 */
import { AwsClient } from "aws4fetch";
import type { Env } from "../env";

const UPLOAD_URL_TTL_SECONDS = 60 * 60; // 1 hour to complete an upload

export interface PresignedUpload {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>; // headers the client MUST echo on the PUT
}

export async function presignUpload(
  env: Env,
  key: string,
  contentType: string
): Promise<PresignedUpload> {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${encodeR2Key(
    key
  )}?X-Amz-Expires=${UPLOAD_URL_TTL_SECONDS}`;

  const signed = await client.sign(
    new Request(endpoint, { method: "PUT", headers: { "content-type": contentType } }),
    { aws: { signQuery: true } }
  );

  return {
    uploadUrl: signed.url,
    method: "PUT",
    // content-type is folded into the signature, so the client must send it back verbatim.
    headers: { "content-type": contentType },
  };
}

/** Encode each path segment but keep the slashes that structure the key. */
function encodeR2Key(key: string): string {
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}
