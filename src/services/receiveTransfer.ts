/**
 * Songnook Send — receive side. Fetches a transfer's metadata (§3 payload) and
 * downloads its items into cache for import. Counterpart to sendTransfer.ts;
 * same no-credentials rule: the link is the capability.
 */
import * as FileSystem from "expo-file-system/legacy";
import { SEND_MAX_ITEM_BYTES, SEND_MAX_TRANSFER_BYTES, SEND_SERVICE_BASE_URL } from "../config/sendService";
import { SendCancelledError, SendTransferError } from "./sendTransfer";
import type { ShareKind } from "../types";

export type TransferItemPayload = {
  itemId: string;
  fileName: string;
  size: number;
  mimeType: string;
  downloadUrl: string;
};

export type TransferPayload = {
  transferId: string;
  title: string | null;
  sender: { name: string | null; userId: string | null };
  message: string | null;
  /** What the sender said this is. For loose audio the app acts on it (a
   *  running order becomes a playlist or a setlist); for a .songnook item the
   *  file's own manifest stays the authority and this only names the parcel
   *  before it is opened. Older parcels carry no kind and read as clips. */
  kind: ShareKind;
  createdAt: string;
  expiresAt: string;
  items: TransferItemPayload[];
};

/** Thrown when the transfer is gone (expired or never existed) — the friendly
 *  branch, distinct from network failures. */
export class TransferGoneError extends Error {
  constructor() {
    super("This transfer has expired or doesn't exist.");
    this.name = "TransferGoneError";
  }
}

const MAX_TRANSFER_ITEMS = 200;
// The same lines the sender and the service enforce (config/sendService): a parcel
// that sealed fine must never be refused on arrival.
const MAX_TRANSFER_BYTES = SEND_MAX_TRANSFER_BYTES;
const MAX_ITEM_BYTES = SEND_MAX_ITEM_BYTES;
const MAX_NAME_LEN = 260;
const TRANSFER_ID_PATTERN = /^t_[A-Za-z0-9]{16,80}$/;
const ITEM_ID_PATTERN = /^i_[A-Za-z0-9]{8,80}$/;
const AUDIO_EXTS = new Set(["m4a", "mp3", "wav", "aac", "flac", "ogg", "oga", "aif", "aiff", "caf"]);
const SHARE_KINDS: ReadonlySet<string> = new Set<ShareKind>([
  "setlist",
  "playlist",
  "songbook",
  "sketch",
  "collection",
  "workspace",
  "clips",
  "library",
]);

/** Unknown or missing → "clips": a parcel is never refused over its label. */
export function normalizeTransferKind(value: unknown): ShareKind {
  return typeof value === "string" && SHARE_KINDS.has(value) ? (value as ShareKind) : "clips";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Every "the service sent something we can't trust" failure reads the same to a person. */
function invalidTransfer(message: string): SendTransferError {
  return new SendTransferError(message, undefined, "invalidTransfer");
}

function optionalText(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw invalidTransfer("Transfer metadata is invalid.");
  return value.slice(0, max);
}

function requiredText(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length === 0) {
    throw invalidTransfer("Transfer metadata is invalid.");
  }
  return value.slice(0, max);
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

function isSupportedTransferItem(fileName: string, mimeType: string): boolean {
  const ext = extensionOf(fileName);
  const mime = mimeType.toLowerCase();
  if (ext === "songnook") return mime === "application/octet-stream" || mime === "application/zip";
  if (AUDIO_EXTS.has(ext)) return mime.startsWith("audio/") || mime === "application/octet-stream";
  return false;
}

function validateDownloadUrl(value: unknown, transferId: string, itemId: string): string {
  const downloadUrl = requiredText(value, 2000);
  let url: URL;
  let serviceUrl: URL;
  try {
    url = new URL(downloadUrl);
    serviceUrl = new URL(SEND_SERVICE_BASE_URL);
  } catch {
    throw invalidTransfer("Transfer metadata points to an invalid download URL.");
  }
  if (url.origin !== serviceUrl.origin) {
    throw invalidTransfer("Transfer metadata points to an unexpected download host.");
  }
  if (url.pathname !== `/t/${transferId}/dl/${itemId}`) {
    throw invalidTransfer("Transfer metadata points to an unexpected file path.");
  }
  return downloadUrl;
}

export function validateTransferPayload(value: unknown, expectedTransferId: string): TransferPayload {
  if (!isRecord(value)) throw invalidTransfer("Transfer metadata is invalid.");
  const transferId = requiredText(value.transferId, 100);
  if (transferId !== expectedTransferId || !TRANSFER_ID_PATTERN.test(transferId)) {
    throw invalidTransfer("Transfer metadata is invalid.");
  }

  const itemsIn = value.items;
  if (!Array.isArray(itemsIn) || itemsIn.length === 0 || itemsIn.length > MAX_TRANSFER_ITEMS) {
    throw invalidTransfer("Transfer metadata has no importable items.");
  }

  let total = 0;
  const items: TransferItemPayload[] = itemsIn.map((raw) => {
    if (!isRecord(raw)) throw invalidTransfer("Transfer item metadata is invalid.");
    const itemId = requiredText(raw.itemId, 100);
    if (!ITEM_ID_PATTERN.test(itemId)) throw invalidTransfer("Transfer item metadata is invalid.");
    const fileName = requiredText(raw.fileName, MAX_NAME_LEN).trim() || "file";
    const mimeType = requiredText(raw.mimeType, 120).toLowerCase();
    const size = Number(raw.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ITEM_BYTES) {
      throw invalidTransfer("Transfer item size is invalid.");
    }
    if (!isSupportedTransferItem(fileName, mimeType)) {
      throw new SendTransferError(`Transfer item "${fileName}" is not supported.`, undefined, "unsupportedItem");
    }
    total += size;
    if (total > MAX_TRANSFER_BYTES) {
      throw new SendTransferError("Transfer is too large for this app version.", undefined, "tooLarge");
    }
    return {
      itemId,
      fileName,
      mimeType,
      size,
      downloadUrl: validateDownloadUrl(raw.downloadUrl, transferId, itemId),
    };
  });

  const sender = isRecord(value.sender) ? value.sender : {};
  const createdAt = requiredText(value.createdAt, 80);
  const expiresAt = requiredText(value.expiresAt, 80);
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(expiresAt))) {
    throw invalidTransfer("Transfer dates are invalid.");
  }

  return {
    transferId,
    title: optionalText(value.title, 200),
    sender: {
      name: optionalText(sender.name, 80),
      userId: optionalText(sender.userId, 120),
    },
    message: optionalText(value.message, 1000),
    kind: normalizeTransferKind(value.kind),
    createdAt,
    expiresAt,
    items,
  };
}

/** Pulls a transferId out of a trusted send.songnook.app URL, app-scheme URL,
 *  or raw id. Null when nothing transfer-like is present. */
export function parseTransferUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (TRANSFER_ID_PATTERN.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const serviceUrl = new URL(SEND_SERVICE_BASE_URL);
    if (url.protocol === serviceUrl.protocol && url.host === serviceUrl.host) {
      const match = /^\/t\/(t_[A-Za-z0-9]{16,80})(?:\/)?$/.exec(url.pathname);
      return match?.[1] ?? null;
    }
    if (url.protocol === "songnook:" && url.hostname === "t") {
      const id = url.pathname.replace(/^\//, "");
      return TRANSFER_ID_PATTERN.test(id) ? id : null;
    }
  } catch {
    // Not a URL; raw-id case was handled above.
  }
  return null;
}

/** GET /api/transfers/:id — no auth, no cookies; the id is the capability. */
export async function fetchTransfer(transferId: string): Promise<TransferPayload> {
  if (!TRANSFER_ID_PATTERN.test(transferId)) throw new TransferGoneError();
  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    res = await fetch(`${SEND_SERVICE_BASE_URL}/api/transfers/${encodeURIComponent(transferId)}`, {
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
  if (res.status === 404 || res.status === 410) throw new TransferGoneError();
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SendTransferError(detail || `Request failed (${res.status}).`, res.status, "rejected");
  }
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw invalidTransfer("Transfer metadata could not be read.");
  }
  return validateTransferPayload(raw, transferId);
}

/** A SongNook archive item (vs. a loose audio file). The service registers
 *  only .songnook and audio, so there is no other archive to recognise. */
export function isArchiveItem(item: TransferItemPayload): boolean {
  return item.fileName.toLowerCase().endsWith(".songnook");
}

const RECEIVE_CACHE_DIR = `${FileSystem.cacheDirectory}songnook-receive`;

/** Downloads one item into cache; returns the local file uri. Progress is
 *  0..1 within this item. Caller cleans up via cleanupReceiveCache(). An
 *  aborted `signal` cancels the download in flight (a Stop mid-parcel used to
 *  wait for the whole item) and throws `SendCancelledError`. */
export async function downloadTransferItem(
  item: TransferItemPayload,
  onProgress?: (fraction: number) => void,
  options?: { signal?: AbortSignal }
): Promise<string> {
  if (options?.signal?.aborted) throw new SendCancelledError();
  await FileSystem.makeDirectoryAsync(RECEIVE_CACHE_DIR, { intermediates: true }).catch(() => {});
  // Keep the original extension (import routing keys off it); the itemId prefix
  // guarantees uniqueness within the cache dir.
  const safeName = item.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 160) || "file";
  const target = `${RECEIVE_CACHE_DIR}/${item.itemId}-${safeName}`;

  // A hung socket must not stall the receive flow forever: the progress
  // callback doubles as a liveness signal — no bytes for STALL_MS cancels the
  // download and surfaces a retryable error instead of an eternal spinner.
  const STALL_MS = 30_000;
  let lastProgressAt = Date.now();
  const download = FileSystem.createDownloadResumable(
    item.downloadUrl,
    target,
    {},
    (progress) => {
      lastProgressAt = Date.now();
      if (!onProgress || progress.totalBytesExpectedToWrite <= 0) return;
      onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
    }
  );
  const stallWatch = setInterval(() => {
    if (Date.now() - lastProgressAt > STALL_MS) {
      clearInterval(stallWatch);
      void download.cancelAsync().catch(() => {});
    }
  }, 5_000);
  const onAbort = () => void download.cancelAsync().catch(() => {});
  options?.signal?.addEventListener("abort", onAbort);
  // A Stop that landed while the cache directory was being made has no listener yet.
  if (options?.signal?.aborted) onAbort();
  let result: FileSystem.FileSystemDownloadResult | undefined;
  try {
    result = await download.downloadAsync();
  } finally {
    clearInterval(stallWatch);
    options?.signal?.removeEventListener("abort", onAbort);
  }
  if (options?.signal?.aborted) throw new SendCancelledError();
  if (!result || (result.status !== 200 && result.status !== 206)) {
    throw new SendTransferError(
      `Download failed for "${item.fileName}" (${result?.status ?? "no response"}).`,
      result?.status,
      "downloadFailed"
    );
  }
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || info.isDirectory || !Number.isFinite(info.size) || info.size !== item.size) {
    throw new SendTransferError(`Downloaded file size did not match "${item.fileName}".`, undefined, "downloadFailed");
  }
  return result.uri;
}

export async function cleanupReceiveCache(): Promise<void> {
  await FileSystem.deleteAsync(RECEIVE_CACHE_DIR, { idempotent: true }).catch(() => {});
}
