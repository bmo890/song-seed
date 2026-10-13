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
import {
  SendTransferError,
  createTransfer,
  finalizeTransfer,
  fileSize,
  registerAndUploadFile,
} from "./sendTransfer";
import { useSentLinksStore } from "../state/useSentLinksStore";
import type { SentLink } from "../domain/sentLinks";

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

export { SendTransferError };

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
}

export async function createShareLink(input: CreateShareLinkInput): Promise<SentLink> {
  // 1. Reserve identity first so it can be stamped into the archive manifest.
  const transfer = await createTransfer({
    title: input.title,
    senderName: input.senderName ?? undefined,
    message: input.message,
    kind: input.kind,
  });

  // 2. Build the archive with the transferId already in the share block.
  const args = input.buildArgs(transfer.transferId);
  if (!args) {
    // Draft transfer is never finalized → nothing fetchable → swept at expiry.
    throw new EmptyShareError();
  }

  const prepared = await prepareLibraryExportArchive(args);
  const fileName = `${prepared.archiveTitle}.${prepared.archiveExtension}`;
  const size = await fileSize(prepared.archiveUri);
  // Past the cap the draft is simply never finalized (swept at expiry) — no
  // bytes leave the device.
  assertWithinCaps([size]);

  // 3. Upload the single .songnook file. Opaque to the server.
  await registerAndUploadFile(transfer.transferId, transfer.uploadToken, {
    fileUri: prepared.archiveUri,
    fileName,
    // Octet-stream, not application/zip: keeps the .songnook identity and
    // matches how the archive is saved to disk elsewhere.
    mimeType: "application/octet-stream",
    size,
  });

  // 4. Finalize — only now is the link live.
  const { shareUrl } = await finalizeTransfer(transfer.transferId, transfer.uploadToken);

  // 5. Record in the local outbox.
  const record: SentLink = {
    transferId: transfer.transferId,
    shareUrl,
    title: input.title,
    kind: input.kind,
    entityId: input.entityId,
    createdAt: Date.now(),
    expiresAt: Date.parse(transfer.expiresAt) || Date.now(),
    itemCount: 1,
  };
  useSentLinksStore.getState().recordLink(record);
  return record;
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
}): Promise<SentLink> {
  if (input.files.length === 0) throw new EmptyShareError();

  // Sizes first: a parcel past the caps is refused before a transfer exists.
  const sizes = await Promise.all(input.files.map((file) => fileSize(file.fileUri)));
  assertWithinCaps(sizes);

  const transfer = await createTransfer({
    title: input.title,
    senderName: input.senderName ?? undefined,
    message: input.message,
    kind: input.kind,
  });

  for (const [index, file] of input.files.entries()) {
    await registerAndUploadFile(transfer.transferId, transfer.uploadToken, {
      fileUri: file.fileUri,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: sizes[index]!,
    });
  }

  const { shareUrl } = await finalizeTransfer(transfer.transferId, transfer.uploadToken);

  const record: SentLink = {
    transferId: transfer.transferId,
    shareUrl,
    title: input.title,
    kind: input.kind,
    entityId: input.entityId,
    createdAt: Date.now(),
    expiresAt: Date.parse(transfer.expiresAt) || Date.now(),
    itemCount: input.files.length,
  };
  useSentLinksStore.getState().recordLink(record);
  return record;
}
