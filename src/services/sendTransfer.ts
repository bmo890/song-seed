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
import type { ShareKind } from "../types";

export class SendTransferError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SendTransferError";
  }
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

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JSON_TIMEOUT_MS);
  try {
    res = await fetch(`${SEND_SERVICE_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new SendTransferError(
      `Couldn't reach the transfer service (${(err as Error).message}).`
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SendTransferError(detail || `Request failed (${res.status}).`, res.status);
  }
  return (await res.json()) as T;
}

/** 1. Create a transfer. Returns the transferId BEFORE any upload. */
export function createTransfer(input: {
  title?: string;
  senderName?: string | null;
  message?: string;
  /** What the parcel is. The service echoes it to the recipient page and the
   *  receive screen, so a collection or a workspace reads as one before any
   *  file is opened (the .songnook manifest stays the authority on device). */
  kind?: ShareKind;
}): Promise<CreatedTransfer> {
  return postJson<CreatedTransfer>("/api/transfers", {
    title: input.title,
    senderName: input.senderName ?? undefined,
    message: input.message,
    kind: input.kind,
  });
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
  try {
    // A truly hung socket is still bounded by an absolute ceiling — generous
    // enough for a large file on a slow uplink, finite enough that a seal
    // never runs forever. An abandoned draft is swept server-side within 24h.
    const UPLOAD_CEILING_MS = 15 * 60 * 1000;
    const res = await Promise.race([
      task.uploadAsync(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("upload timed out")), UPLOAD_CEILING_MS)
      ),
    ]);
    throwIfSendCancelled(options?.signal);
    if (!res) throw new SendCancelledError();
    uploadStatus = res.status;
  } catch (err) {
    if (err instanceof SendCancelledError || options?.signal?.aborted) throw new SendCancelledError();
    throw new SendTransferError(`Upload failed (${(err as Error).message}).`);
  } finally {
    options?.signal?.removeEventListener("abort", onAbort);
  }
  options?.onProgress?.(file.size, file.size);
  if (uploadStatus < 200 || uploadStatus >= 300) {
    throw new SendTransferError(`Upload rejected (${uploadStatus}).`, uploadStatus);
  }
  return item.itemId;
}

/** 4. Finalize — nothing is fetchable until this returns. */
export function finalizeTransfer(
  transferId: string,
  uploadToken: string
): Promise<{ shareUrl: string }> {
  return postJson<{ shareUrl: string }>(`/api/transfers/${transferId}/finalize`, {
    uploadToken,
  });
}

/** Convenience: size of a local file for item registration. */
export async function fileSize(fileUri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists && !info.isDirectory ? info.size ?? 0 : 0;
}
