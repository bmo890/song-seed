/**
 * SongNook Send, sealed end to end (docs/product-plan/send-e2e-encryption.md).
 *
 * Sending: one random key per parcel; every file is sealed (SNS1) on this
 * device before it leaves, and so is the envelope that carries the parcel's
 * title, sender, note and real file names. The key rides only in the link's
 * `#k=` part, which no server ever receives. Receiving: the same key opens
 * the envelope and each downloaded file. The native module does the sealing
 * (CryptoKit on iOS, javax.crypto on Android); builds without it send as
 * before and can't open a sealed parcel.
 */
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import {
  isSealAvailable,
  openSealedBase64Native,
  openSealedFileNative,
  sealBase64Native,
  sealFileNative,
} from "../../modules/songnook-file-io";
import type { ShareFileInput } from "./shareLink";

const SEAL_CACHE_DIR = `${FileSystem.cacheDirectory}songnook-seal`;

/** Every parcel this build sends is sealed when it can be (step 3 of the rollout). */
export function canSealParcels(): boolean {
  return isSealAvailable();
}

/** Whether this build can open a sealed parcel. */
export function canOpenSealedParcels(): boolean {
  return isSealAvailable();
}

function base64UrlOf(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64ToUtf8(base64: string): string {
  const s = atob(base64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export type ParcelEnvelope = {
  v: 1;
  title: string;
  senderName: string;
  message: string;
  items: { name: string; mime: string; size: number }[];
};

/** Seals one parcel: each file in upload order, then the envelope naming them. */
export class ParcelSealer {
  readonly key = base64UrlOf(Crypto.getRandomBytes(32));
  private readonly items: ParcelEnvelope["items"] = [];
  private readonly temps: string[] = [];

  /** The link's tail that carries the key. */
  get fragment(): string {
    return `#k=${this.key}`;
  }

  /** A sealed copy of `file`, named by its place in the parcel (`3.sealed`). */
  async seal(file: ShareFileInput & { size: number }): Promise<ShareFileInput & { size: number }> {
    await FileSystem.makeDirectoryAsync(SEAL_CACHE_DIR, { intermediates: true }).catch(() => {});
    const index = this.items.length + 1;
    const target = `${SEAL_CACHE_DIR}/${Date.now().toString(36)}-${index}.sealed`;
    this.temps.push(target);
    const size = await sealFileNative(file.fileUri, target, this.key);
    this.items.push({ name: file.fileName, mime: file.mimeType, size: file.size });
    return { fileUri: target, fileName: `${index}.sealed`, mimeType: "application/octet-stream", size };
  }

  /** The envelope, sealed, for the server to keep beside the files it can't read. */
  async envelope(meta: { title: string; senderName?: string | null; message?: string | null }): Promise<string> {
    const envelope: ParcelEnvelope = {
      v: 1,
      title: meta.title,
      senderName: meta.senderName ?? "",
      message: meta.message ?? "",
      items: this.items,
    };
    return sealBase64Native(utf8ToBase64(JSON.stringify(envelope)), this.key);
  }

  async cleanup(): Promise<void> {
    await Promise.all(this.temps.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})));
  }
}

/** Opens a sealed envelope; throws when the key doesn't fit. */
export async function openParcelEnvelope(sealedMeta: string, key: string): Promise<ParcelEnvelope> {
  const value = JSON.parse(base64ToUtf8(await openSealedBase64Native(sealedMeta, key))) as ParcelEnvelope;
  if (!value || value.v !== 1 || !Array.isArray(value.items)) throw new Error("Unreadable envelope.");
  return value;
}

/** Opens a downloaded sealed file into `destinationUri`; returns its plain size. */
export function openSealedFile(sourceUri: string, destinationUri: string, key: string): Promise<number> {
  return openSealedFileNative(sourceUri, destinationUri, key);
}
