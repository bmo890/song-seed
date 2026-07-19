/**
 * Songstead Send — transport client.
 *
 * Low-level HTTP against the transfer service: create → register item (presigned
 * upload) → upload → finalize. No secrets here; the service mints the presigned
 * URLs and the app only echoes them back with the file body.
 *
 * Contract (docs/product-plan/transfer-service-brief.md §4): transferId comes
 * back at CREATE, before any upload, so a caller can stamp it into a .songstead
 * file's manifest before uploading. Nothing is fetchable until finalize.
 */
import * as FileSystem from "expo-file-system/legacy";
import { SEND_SERVICE_BASE_URL } from "../config/sendService";

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

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SEND_SERVICE_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new SendTransferError(
      `Couldn't reach the transfer service (${(err as Error).message}).`
    );
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
}): Promise<CreatedTransfer> {
  return postJson<CreatedTransfer>("/api/transfers", {
    title: input.title,
    senderName: input.senderName ?? undefined,
    message: input.message,
  });
}

/** 2+3. Register a file and stream it straight to the presigned URL. */
export async function registerAndUploadFile(
  transferId: string,
  uploadToken: string,
  file: { fileUri: string; fileName: string; mimeType: string; size: number }
): Promise<string> {
  const item = await postJson<RegisteredItem>(`/api/transfers/${transferId}/items`, {
    uploadToken,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
  });

  let uploadStatus: number;
  try {
    const res = await FileSystem.uploadAsync(item.uploadUrl, file.fileUri, {
      httpMethod: item.method ?? "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: item.headers ?? {},
    });
    uploadStatus = res.status;
  } catch (err) {
    throw new SendTransferError(`Upload failed (${(err as Error).message}).`);
  }
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
