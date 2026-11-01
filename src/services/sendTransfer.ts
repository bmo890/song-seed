/**
 * SongNook Send — transport client.
 *
 * Low-level HTTP against the transfer service: create → register item (presigned
 * upload) → upload → finalize. No secrets here; the service mints the presigned
 * URLs and the app only echoes them back with the file body.
 *
 * Contract (docs/product-plan/transfer-service-brief.md §4): transferId comes
 * back at CREATE, before any upload, so a caller can stamp it into a .songnook
 * file's manifest before uploading. Nothing is fetchable until finalize.
 */
import * as FileSystem from "expo-file-system/legacy";
import { SEND_SERVICE_BASE_URL } from "../config/sendService";
import { i18n } from "../i18n/instance";
import { sendIdentityHeaders } from "./sendIdentity";
import type { ShareKind } from "../types";

/** Why a transfer failed, for the alert; the English `message` (often a raw server
 *  body) stays for logs. Mirrors `DrRestoreErrorCode` (sweep 2026-10-22, #8). */
export type SendTransferErrorCode =
  | "unreachable"
  | "rejected"
  | "uploadFailed"
  | "uploadRejected"
  | "invalidTransfer"
  | "unsupportedItem"
  | "tooLarge"
  | "downloadFailed"
  | "limit"
  // Sealed parcels (services/sendSeal.ts): no key in the link, a build that
  // can't open them, a key that doesn't fit.
  | "missingKey"
  | "needsUpdate"
  | "sealBroken";

export class SendTransferError extends Error {
  constructor(message: string, readonly status?: number, readonly code: SendTransferErrorCode = "rejected") {
    super(message);
    this.name = "SendTransferError";
  }
}

/** Translated, user-facing sentence for a transfer failure. */
export function describeSendTransferError(error: SendTransferError): string {
  return i18n.t(`shareLink.sendError.${error.code}`, { status: error.status ?? "" });
}

export interface CreatedTransfer {
  transferId: string;
  uploadToken: string;
  expiresAt: string; // ISO
}

export interface RegisteredItem {
  itemId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

/** JSON API calls are tiny — bound them like every other network path (RN's
 *  OkHttp read timeout is infinite, so a hung socket would spin forever). */
const JSON_TIMEOUT_MS = 8000;

async function requestJson<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JSON_TIMEOUT_MS);
  try {
    res = await fetch(`${SEND_SERVICE_BASE_URL}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new SendTransferError(
      `Couldn't reach the transfer service (${(err as Error).message}).`,
      undefined,
      "unreachable"
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // The server's free allowance is spent (lib/senders.ts, once it enforces).
    const code: SendTransferErrorCode = res.status === 402 ? "limit" : "rejected";
    throw new SendTransferError(detail || `Request failed (${res.status}).`, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const postJson = <T,>(path: string, body?: unknown, headers?: Record<string, string>) =>
  requestJson<T>("POST", path, body, headers);

/** 1. Create a transfer. Returns the transferId BEFORE any upload. */
export function createTransfer(input: {
  title?: string;
  senderName?: string | null;
  message?: string;
  /** What the parcel is. The service echoes it to the recipient page and the
   *  receive screen, so a collection or a workspace reads as one before any
   *  file is opened (the .songnook manifest stays the authority on device). */
  kind?: ShareKind;
  /** Sealed end to end (services/sendSeal.ts): the title, sender and note go
   *  only inside the sealed envelope, at finalize. */
  sealed?: boolean;
}): Promise<CreatedTransfer> {
  return sendIdentityHeaders().then((identity) =>
    postJson<CreatedTransfer>(
      "/api/transfers",
      input.sealed
        ? { sealed: true, kind: input.kind }
        : {
            title: input.title,
            senderName: input.senderName ?? undefined,
            message: input.message,
            kind: input.kind,
          },
      identity
    )
  );
}

export class SendCancelledError extends Error {
  constructor() {
    super("Sealing cancelled.");
    this.name = "SendCancelledError";
  }
}

export function throwIfSendCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new SendCancelledError();
}

export type UploadProgress = (sentBytes: number, totalBytes: number) => void;

/** 2+3. Register a file and stream it straight to the presigned URL. */
export async function registerAndUploadFile(
  transferId: string,
  uploadToken: string,
  file: { fileUri: string; fileName: string; mimeType: string; size: number },
  options?: { signal?: AbortSignal; onProgress?: UploadProgress }
): Promise<string> {
  throwIfSendCancelled(options?.signal);
  const item = await postJson<RegisteredItem>(`/api/transfers/${transferId}/items`, {
    uploadToken,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
  });

  throwIfSendCancelled(options?.signal);

  // An upload TASK, not uploadAsync (2026-10-14): it reports bytes as they
  // leave and can be cancelled, which is what lets the seal run behind a pill
  // with a live bar and a Cancel that works. A background session on iOS
  // keeps the bytes moving if the app is sent to the back mid-upload.
  const task = FileSystem.createUploadTask(
    item.uploadUrl,
    file.fileUri,
    {
      httpMethod: item.method ?? "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: item.headers ?? {},
      sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
    },
    (data) => options?.onProgress?.(data.totalBytesSent, data.totalBytesExpectedToSend || file.size)
  );
  const onAbort = () => void task.cancelAsync().catch(() => {});
  options?.signal?.addEventListener("abort", onAbort);

  let uploadStatus: number;
  // A truly hung socket is still bounded by an absolute ceiling — generous
  // enough for a large file on a slow uplink, finite enough that a seal
  // never runs forever. An abandoned draft is swept server-side within 24h.
  // The task is cancelled on timeout (the bytes would otherwise keep flowing
  // behind a failure) and the timer cleared on every exit (sweep #17).
  const UPLOAD_CEILING_MS = 15 * 60 * 1000;
  let ceiling: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      task.uploadAsync(),
      new Promise<never>((_, reject) => {
        ceiling = setTimeout(() => {
          void task.cancelAsync().catch(() => {});
          reject(new Error("upload timed out"));
        }, UPLOAD_CEILING_MS);
      }),
    ]);
    throwIfSendCancelled(options?.signal);
    if (!res) throw new SendCancelledError();
    uploadStatus = res.status;
  } catch (err) {
    if (err instanceof SendCancelledError || options?.signal?.aborted) throw new SendCancelledError();
    throw new SendTransferError(`Upload failed (${(err as Error).message}).`, undefined, "uploadFailed");
  } finally {
    if (ceiling !== undefined) clearTimeout(ceiling);
    options?.signal?.removeEventListener("abort", onAbort);
  }
  options?.onProgress?.(file.size, file.size);
  if (uploadStatus < 200 || uploadStatus >= 300) {
    throw new SendTransferError(`Upload rejected (${uploadStatus}).`, uploadStatus, "uploadRejected");
  }
  return item.itemId;
}

/** 4. Finalize — nothing is fetchable until this returns. */
export function finalizeTransfer(
  transferId: string,
  uploadToken: string,
  /** A sealed parcel's envelope (title, sender, note, file names), sealed. */
  sealedMeta?: string
): Promise<{ shareUrl: string }> {
  return postJson<{ shareUrl: string }>(`/api/transfers/${transferId}/finalize`, {
    uploadToken,
    ...(sealedMeta ? { sealedMeta } : {}),
  });
}

/** Take a sealed link back: its files are deleted at once. The upload token is
 *  the sender's proof, kept with the outbox record. Already gone is success. */
export function deleteTransfer(transferId: string, uploadToken: string): Promise<void> {
  return requestJson<void>("DELETE", `/api/transfers/${encodeURIComponent(transferId)}`, undefined, {
    "x-upload-token": uploadToken,
  });
}

// ── Sending from a computer: pairing a browser with this install ────────────

export type PairedBrowser = { id: string; label: string; pairedAt: string; lastUsedAt: string };

/** Claim the code a browser shows. Throws a SendTransferError with status 404
 *  when there is no such live code. */
export async function claimBrowserPairing(code: string): Promise<void> {
  await postJson<{ ok: true }>("/api/pairings/claim", { code }, await sendIdentityHeaders());
}

export async function listPairedBrowsers(): Promise<PairedBrowser[]> {
  const res = await requestJson<{ browsers: PairedBrowser[] }>("GET", "/api/browsers", undefined, await sendIdentityHeaders());
  return Array.isArray(res?.browsers) ? res.browsers : [];
}

export async function removePairedBrowser(id: string): Promise<void> {
  await requestJson<void>("DELETE", `/api/browsers/${encodeURIComponent(id)}`, undefined, await sendIdentityHeaders());
}

/** Convenience: size of a local file for item registration. */
export async function fileSize(fileUri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists && !info.isDirectory ? info.size ?? 0 : 0;
}
