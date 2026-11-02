/**
 * "Get a link" — turns any SongNook archive into a hosted transfer link.
 *
 * Flow (brief §4–§5):
 *   1. create transfer   → transferId (BEFORE the archive is built)
 *   2. build the archive with share.transferId = transferId → the manifest is
 *      stamped at write time, so no zip rewriting is ever needed
 *   3. register + upload the single .songnook file (presigned PUT)
 *   4. finalize          → shareUrl
 *   5. record the link in the local outbox (useSentLinksStore)
 *
 * Reuses the same export-args builders as the OS-share-sheet path, so a link and a
 * file are the same bytes — only the destination differs.
 */
import { prepareLibraryExportArchive, type ExportLibraryArgs } from "./libraryExport";
import { SEND_MAX_ITEM_BYTES, SEND_MAX_TRANSFER_BYTES } from "../config/sendService";
import type { ShareKind } from "../types";
import { SEND_SERVICE_BASE_URL } from "../config/sendService";
import { isSendableFile } from "../domain/sendFormats";
import {
  SendCancelledError,
  SendTransferError,
  createTransfer,
  deleteTransfer,
  finalizeTransfer,
  fileSize,
  registerAndUploadFile,
  throwIfSendCancelled,
} from "./sendTransfer";
import { isBackupOperationCancelled } from "./backupOperation";
import { cleanupShareTempFile } from "./managedMedia";
import { losslessAudioToEncode } from "../domain/linkAudio";
import { deleteEncodedAudio, encodeAudioForLink } from "./linkAudioEncoder";
import type { SendProgressOptions } from "../domain/sendProgress";
import { useSentLinksStore } from "../state/useSentLinksStore";
import type { SentLink } from "../domain/sentLinks";
import { ParcelSealer, canSealParcels } from "./sendSeal";

/** Thrown when there's nothing exportable to link (mirrors the false return of
 *  the share-sheet path, so callers can show the same "nothing to share" copy). */
export class EmptyShareError extends Error {
  constructor() {
    super("Nothing to share.");
    this.name = "EmptyShareError";
  }
}

/** Thrown before any upload when the parcel is past the service caps — a
 *  whole workspace can be gigabytes. Callers point at "Share as file" instead. */
export class TooLargeShareError extends Error {
  constructor(readonly bytes: number, readonly limitBytes: number) {
    super("Too large to link.");
    this.name = "TooLargeShareError";
  }
}

/** Thrown before any upload when a file is of a kind the recipient can't open
 *  (.opus, .wma, MIDI…) and couldn't be turned into one (12h H-1). */
export class UnsendableShareError extends Error {
  constructor(readonly fileNames: string[]) {
    super(`Can't send: ${fileNames.join(", ")}`);
    this.name = "UnsendableShareError";
  }
}

export { SendCancelledError, SendTransferError };

/** The file as it would be named and typed in the parcel, after any encode. */
function encodedName(file: ShareFileInput, encoded: ReadonlyMap<string, string>): ShareFileInput {
  const next = encoded.get(file.fileUri);
  return next
    ? { fileUri: next, fileName: file.fileName.replace(/\.[A-Za-z0-9]+$/, "") + ".m4a", mimeType: "audio/mp4" }
    : file;
}

/** Files to encode for a link: lossless takes (to save space) and any file no
 *  recipient could open as it is (to make it openable). */
function filesToEncode(files: ShareFileInput[]): string[] {
  const unsendable = files.filter((file) => !isSendableFile(file.fileName, file.mimeType)).map((file) => file.fileUri);
  return Array.from(new Set([...losslessAudioToEncode(files.map((file) => file.fileUri)), ...unsendable]));
}

/**
 * Records the link in the outbox BEFORE finalize, then finalizes (idempotent on
 * the server, retried on a lost answer). If it still can't say, the draft is
 * taken back; if even that can't reach the server, the outbox keeps the entry
 * so Settings → Shared links can delete it. A link is never live and unlisted
 * (12h M-1).
 */
async function finalizeAndRecord(
  transfer: { transferId: string; uploadToken: string; expiresAt: string },
  sealedMeta: string | undefined,
  record: Omit<SentLink, "shareUrl" | "pending">,
  fragment: string
): Promise<SentLink> {
  const sentLinks = useSentLinksStore.getState();
  sentLinks.recordLink({
    ...record,
    shareUrl: `${SEND_SERVICE_BASE_URL}/t/${transfer.transferId}${fragment}`,
    pending: true,
  });
  try {
    const { shareUrl } = await finalizeTransfer(transfer.transferId, transfer.uploadToken, sealedMeta);
    const done: SentLink = { ...record, shareUrl: shareUrl + fragment };
    useSentLinksStore.getState().recordLink(done);
    return done;
  } catch (error) {
    // Whatever the server did, take it back: deleting a draft or a live link
    // both succeed, and "already gone" is success too.
    const takenBack = await deleteTransfer(transfer.transferId, transfer.uploadToken).then(
      () => true,
      () => false
    );
    if (takenBack) useSentLinksStore.getState().forgetLink(transfer.transferId);
    throw error;
  }
}
export type { SendProgressOptions };

/** A cancelled seal, whichever layer noticed first (zip, upload, or between steps). */
export function isSendCancelled(err: unknown): boolean {
  return err instanceof SendCancelledError || isBackupOperationCancelled(err);
}

function assertWithinCaps(itemBytes: number[]): void {
  const biggest = Math.max(0, ...itemBytes);
  if (biggest > SEND_MAX_ITEM_BYTES) throw new TooLargeShareError(biggest, SEND_MAX_ITEM_BYTES);
  const total = itemBytes.reduce((sum, size) => sum + size, 0);
  if (total > SEND_MAX_TRANSFER_BYTES) throw new TooLargeShareError(total, SEND_MAX_TRANSFER_BYTES);
}

export interface CreateShareLinkInput {
  title: string;
  kind: ShareKind;
  /** Back-reference to the shared entity (setlist/songbook id) for on-entity chips. */
  entityId?: string;
  senderName?: string | null;
  message?: string;
  /** Builds the export args once the transferId is known, so it's stamped into
   *  the manifest. Return null if nothing is exportable. */
  buildArgs: (transferId: string) => ExportLibraryArgs | null;
  /** Live progress and a cancel handle, for the seal that runs behind a pill. */
  progress?: SendProgressOptions;
  /** Plain audio riding beside the package for someone without SongNook: the
   *  link page's quiet "raw files" list. The app imports the package alone. */
  browserCopies?: ShareFileInput[];
}

export async function createShareLink(input: CreateShareLinkInput): Promise<SentLink> {
  const signal = input.progress?.signal;
  const report = input.progress?.onProgress;
  throwIfSendCancelled(signal);
  const sealer = canSealParcels() ? new ParcelSealer() : null;
  // 1. Reserve identity first so it can be stamped into the archive manifest.
  const transfer = await createTransfer({
    title: input.title,
    senderName: input.senderName ?? undefined,
    message: input.message,
    kind: input.kind,
    sealed: !!sealer,
  });

  // 2. Build the archive with the transferId already in the share block.
  const args = input.buildArgs(transfer.transferId);
  if (!args) {
    // Draft transfer is never finalized → nothing fetchable → swept at expiry.
    throw new EmptyShareError();
  }

  throwIfSendCancelled(signal);
  report?.({ phase: "packing", completedBytes: 0, totalBytes: 0 });
  // Packing is one bar: encoding (lossless takes → AAC) fills its first half
  // when it happens at all, the zip the rest. Other build phases are quick.
  let sawEncoding = false;
  const packing = (fraction: number, encoding?: { index: number; count: number }) =>
    report?.({ phase: "packing", completedBytes: Math.round(fraction * 1000), totalBytes: 1000, encoding });
  const prepared = await prepareLibraryExportArchive({
    ...args,
    signal,
    compressAudio: true,
    onProgress: (p) => {
      const within = p.totalBytes > 0 ? Math.min(1, p.completedBytes / p.totalBytes) : 0;
      if (p.phase === "encoding") {
        sawEncoding = true;
        packing(within * 0.5, p.encoding);
      } else if (p.phase === "packaging") {
        packing(sawEncoding ? 0.5 + within * 0.5 : within);
      }
    },
  });
  const fileName = `${prepared.archiveTitle}.${prepared.archiveExtension}`;
  const copies = input.browserCopies ?? [];
  const { encoded, tempUris } =
    copies.length > 0
      ? await encodeAudioForLink(filesToEncode(copies), { signal })
      : { encoded: new Map<string, string>(), tempUris: [] as string[] };
  // A plain copy is only for a browser; one no browser or app can open (.wma,
  // MIDI) is left out. The package carries every take for the app (12h H-1).
  const copyFiles = copies
    .map((file) => encodedName(file, encoded))
    .filter((file) => isSendableFile(file.fileName, file.mimeType));
  // Takes the package couldn't carry (a file missing on this phone): told, not hidden (12h M-2).
  const leftOut = prepared.warnings?.length ?? 0;
  let sealedMeta: string | undefined;
  try {
    const size = await fileSize(prepared.archiveUri);
    const copySizes = await Promise.all(copyFiles.map((file) => fileSize(file.fileUri)));
    // Past the cap the draft is simply never finalized (swept at expiry) — no
    // bytes leave the device.
    assertWithinCaps([size, ...copySizes]);
    const totalBytes = size + copySizes.reduce((sum, bytes) => sum + bytes, 0);

    // 3. Upload the .songnook file (opaque to the server), then any plain copies.
    // Sealed, each leaves as a sealed copy made just before its upload.
    report?.({ phase: "uploading", completedBytes: 0, totalBytes });
    const outgoing = async (file: ShareFileInput & { size: number }, browserCopy = false) =>
      sealer ? sealer.seal(file, { browserCopy }) : file;
    await registerAndUploadFile(
      transfer.transferId,
      transfer.uploadToken,
      await outgoing({
        fileUri: prepared.archiveUri,
        fileName,
        // Octet-stream, not application/zip: keeps the .songnook identity and
        // matches how the archive is saved to disk elsewhere.
        mimeType: "application/octet-stream",
        size,
      }),
      {
        signal,
        onProgress: (sent) => report?.({ phase: "uploading", completedBytes: sent, totalBytes }),
      }
    );
    let sentBefore = size;
    for (const [index, file] of copyFiles.entries()) {
      await registerAndUploadFile(
        transfer.transferId,
        transfer.uploadToken,
        await outgoing({ ...file, size: copySizes[index]! }, true),
        {
          signal,
          onProgress: (sent) => report?.({ phase: "uploading", completedBytes: sentBefore + sent, totalBytes }),
        }
      );
      sentBefore += copySizes[index]!;
    }
    sealedMeta = sealer
      ? await sealer.envelope({ title: input.title, senderName: input.senderName, message: input.message })
      : undefined;
  } finally {
    // The packed archive is a temp file (songnook/share); the share-sheet path deletes
    // its copy the same way. Nothing else reads it once the bytes are up (or failed).
    await cleanupShareTempFile(prepared.archiveUri);
    if (tempUris.length > 0) await deleteEncodedAudio(tempUris);
    await sealer?.cleanup();
  }

  // 4. Finalize — only now is the link live.
  throwIfSendCancelled(signal);
  report?.({ phase: "sealing", completedBytes: 0, totalBytes: 0 });
  // 4–5. Finalize and record in the local outbox. A sealed link keeps its key: the link is the whole key.
  return finalizeAndRecord(
    transfer,
    sealedMeta,
    {
      transferId: transfer.transferId,
      title: input.title,
      kind: input.kind,
      entityId: input.entityId,
      createdAt: Date.now(),
      expiresAt: Date.parse(transfer.expiresAt) || Date.now(),
      uploadToken: transfer.uploadToken,
      // What the sender sent: the clips (their plain copies count them), else the one package.
      itemCount: Math.max(1, copyFiles.length),
      ...(leftOut > 0 ? { leftOut } : null),
    },
    sealer?.fragment ?? ""
  );
}

export interface ShareFileInput {
  fileUri: string;
  fileName: string;
  mimeType: string;
}

/**
 * Link path for raw files (e.g. audio clips) — a mixed/opaque transfer with no
 * manifest and nothing to stamp. Each file becomes one transfer item; the
 * receiver types them on device (raw audio → playable files).
 */
export async function createFilesShareLink(input: {
  title: string;
  kind: ShareKind;
  entityId?: string;
  senderName?: string | null;
  message?: string;
  files: ShareFileInput[];
  progress?: SendProgressOptions;
}): Promise<SentLink> {
  if (input.files.length === 0) throw new EmptyShareError();
  const signal = input.progress?.signal;
  const report = input.progress?.onProgress;

  // Lossless takes go out as AAC, like every link (the encoded copies are
  // deleted once the parcel has left). A file the encoder cannot read is
  // sent as it is.
  throwIfSendCancelled(signal);
  // A file no recipient could open as it is (.opus, .wma) is encoded too; one
  // that still can't be (MIDI, a file the encoder can't read) stops the send
  // here, before any upload, instead of a "Link ready" nobody can open (12h H-1).
  const { encoded, tempUris } = await encodeAudioForLink(filesToEncode(input.files), {
    signal,
    onProgress: (completedBytes, totalBytes, index, count) =>
      report?.({ phase: "packing", completedBytes, totalBytes, encoding: { index, count } }),
  });
  try {
    // The encoder always writes an .m4a.
    const files = input.files.map((file) => encodedName(file, encoded));
    const unsendable = files.filter((file) => !isSendableFile(file.fileName, file.mimeType));
    if (unsendable.length > 0) throw new UnsendableShareError(unsendable.map((file) => file.fileName));
    return await uploadFiles({ ...input, files }, signal, report);
  } finally {
    if (tempUris.length > 0) await deleteEncodedAudio(tempUris);
  }
}

async function uploadFiles(
  input: {
    title: string;
    kind: ShareKind;
    entityId?: string;
    senderName?: string | null;
    message?: string;
    files: ShareFileInput[];
  },
  signal: AbortSignal | undefined,
  report: SendProgressOptions["onProgress"]
): Promise<SentLink> {
  // Sizes first: a parcel past the caps is refused before a transfer exists.
  const sizes = await Promise.all(input.files.map((file) => fileSize(file.fileUri)));
  assertWithinCaps(sizes);
  const totalBytes = sizes.reduce((sum, size) => sum + size, 0);

  throwIfSendCancelled(signal);
  const sealer = canSealParcels() ? new ParcelSealer() : null;
  const transfer = await createTransfer({
    title: input.title,
    senderName: input.senderName ?? undefined,
    message: input.message,
    kind: input.kind,
    sealed: !!sealer,
  });

  // One bar for the whole parcel: bytes already sent by earlier files plus the
  // file in flight. Sealed, each file leaves as a sealed copy made just before.
  let sentBefore = 0;
  let sealedMeta: string | undefined;
  report?.({ phase: "uploading", completedBytes: 0, totalBytes });
  try {
    for (const [index, file] of input.files.entries()) {
      const plain = { fileUri: file.fileUri, fileName: file.fileName, mimeType: file.mimeType, size: sizes[index]! };
      await registerAndUploadFile(transfer.transferId, transfer.uploadToken, sealer ? await sealer.seal(plain) : plain, {
        signal,
        onProgress: (sent) => report?.({ phase: "uploading", completedBytes: sentBefore + sent, totalBytes }),
      });
      sentBefore += sizes[index]!;
    }
    sealedMeta = sealer
      ? await sealer.envelope({ title: input.title, senderName: input.senderName, message: input.message })
      : undefined;
  } finally {
    await sealer?.cleanup();
  }

  throwIfSendCancelled(signal);
  report?.({ phase: "sealing", completedBytes: 0, totalBytes: 0 });
  return finalizeAndRecord(
    transfer,
    sealedMeta,
    {
      transferId: transfer.transferId,
      title: input.title,
      kind: input.kind,
      entityId: input.entityId,
      createdAt: Date.now(),
      expiresAt: Date.parse(transfer.expiresAt) || Date.now(),
      uploadToken: transfer.uploadToken,
      itemCount: input.files.length,
    },
    sealer?.fragment ?? ""
  );
}
