/**
 * "Get a link" — turns any Songstead archive into a hosted transfer link.
 *
 * Flow (brief §4–§5):
 *   1. create transfer   → transferId (BEFORE the archive is built)
 *   2. build the archive with share.transferId = transferId → the manifest is
 *      stamped at write time, so no zip rewriting is ever needed
 *   3. register + upload the single .songstead file (presigned PUT)
 *   4. finalize          → shareUrl
 *   5. record the link in the local outbox (useSentLinksStore)
 *
 * Reuses the same export-args builders as the OS-share-sheet path, so a link and a
 * file are the same bytes — only the destination differs.
 */
import { prepareLibraryExportArchive, type ExportLibraryArgs } from "./libraryExport";
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

export { SendTransferError };

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

  // 3. Upload the single .songstead file. Opaque to the server.
  await registerAndUploadFile(transfer.transferId, transfer.uploadToken, {
    fileUri: prepared.archiveUri,
    fileName,
    // Octet-stream, not application/zip: keeps the .songstead identity and
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

  const transfer = await createTransfer({
    title: input.title,
    senderName: input.senderName ?? undefined,
    message: input.message,
  });

  for (const file of input.files) {
    const size = await fileSize(file.fileUri);
    await registerAndUploadFile(transfer.transferId, transfer.uploadToken, {
      fileUri: file.fileUri,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size,
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
