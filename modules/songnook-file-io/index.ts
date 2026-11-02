import SongNookFileIOModule from "./src/SongNookFileIOModule";

export type SongNookFileCopyProgress = {
  completedBytes: number;
  totalBytes: number;
};

export function isSongNookFileIOAvailable() {
  return SongNookFileIOModule != null;
}

export async function copyLocalFileToContentUri(
  sourceUri: string,
  targetUri: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: SongNookFileCopyProgress) => void;
  }
) {
  const nativeModule = SongNookFileIOModule;
  if (!nativeModule) {
    throw new Error(
      "This Android build is missing SongNook's streaming backup module. Rebuild the app before saving a backup."
    );
  }

  const operationId = `backup-copy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const subscription = nativeModule.addListener("onCopyProgress", (event) => {
    if (event.operationId === operationId) {
      options?.onProgress?.({
        completedBytes: event.completedBytes,
        totalBytes: event.totalBytes,
      });
    }
  });
  const abort = () => nativeModule.cancelCopy(operationId);
  options?.signal?.addEventListener("abort", abort, { once: true });

  try {
    if (options?.signal?.aborted) {
      nativeModule.cancelCopy(operationId);
      throw new Error("BACKUP_COPY_CANCELLED");
    }
    const result = await nativeModule.copyFileToContentUriAsync(
      operationId,
      sourceUri,
      targetUri
    );
    if (result.copiedBytes !== result.totalBytes) {
      throw new Error("The folder provider did not receive the complete backup file.");
    }
    return result;
  } finally {
    options?.signal?.removeEventListener("abort", abort);
    subscription.remove();
  }
}

export async function deleteContentUri(targetUri: string) {
  if (!SongNookFileIOModule) return;
  await SongNookFileIOModule.deleteContentUriAsync(targetUri);
}

/* ── Native stored-zip passes (2026-10-20) ─────────────────────────────────────
 * One read per file: written into the archive (or out of it) while its CRC-32 and
 * the SHA-256 of its base64 form are computed from the same bytes. Builds made
 * before these functions existed report unavailable and keep the JS path. */

export type NativeFilePassResult = { crc32: number; sizeBytes: number; sha256: string | null };

/** The message native code throws when an operation is cancelled. */
export const NATIVE_IO_CANCELLED = "SONGNOOK_IO_CANCELLED";

export function isNativeZipAvailable(): boolean {
  const m = SongNookFileIOModule;
  return (
    m != null &&
    typeof m.zipCreateAsync === "function" &&
    typeof m.zipAddFileAsync === "function" &&
    typeof m.zipAddTextAsync === "function" &&
    typeof m.zipFinishAsync === "function" &&
    typeof m.extractRangeAsync === "function"
  );
}

/** True on builds whose native zip writer emits Zip64 records past 4 GB (2026-11-02).
 *  Older builds refuse such an archive natively, so callers take the JS writer. */
export function isNativeZip64Available(): boolean {
  const m = SongNookFileIOModule;
  return isNativeZipAvailable() && typeof m?.zipSupportsZip64 === "function" && m.zipSupportsZip64() === true;
}

type PassOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: SongNookFileCopyProgress) => void;
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Run one native pass with progress events and AbortSignal cancellation. */
async function withOperation<T>(prefix: string, options: PassOptions | undefined, run: (operationId: string) => Promise<T>) {
  const m = SongNookFileIOModule!;
  const operationId = newId(prefix);
  const subscription = options?.onProgress
    ? m.addListener("onCopyProgress", (event) => {
        if (event.operationId === operationId) {
          options.onProgress?.({ completedBytes: event.completedBytes, totalBytes: event.totalBytes });
        }
      })
    : null;
  const abort = () => m.cancelCopy(operationId);
  options?.signal?.addEventListener("abort", abort, { once: true });
  try {
    if (options?.signal?.aborted) throw new Error(NATIVE_IO_CANCELLED);
    return await run(operationId);
  } finally {
    options?.signal?.removeEventListener("abort", abort);
    subscription?.remove();
  }
}

/** A stored (uncompressed) zip being written natively, entry by entry. */
export class NativeZipWriter {
  private constructor(private readonly id: string) {}

  static async create(destinationUri: string) {
    const id = newId("zip");
    await SongNookFileIOModule!.zipCreateAsync!(id, destinationUri);
    return new NativeZipWriter(id);
  }

  /** Append a file. On failure the archive is left as it was before this entry. */
  async addFile(
    archiveName: string,
    sourceUri: string,
    options?: PassOptions & { expectedSizeBytes?: number; sha256?: boolean }
  ): Promise<NativeFilePassResult> {
    const result = await withOperation("zip-add", options, (operationId) =>
      SongNookFileIOModule!.zipAddFileAsync!(
        this.id,
        archiveName,
        sourceUri,
        options?.expectedSizeBytes ?? -1,
        options?.sha256 ?? false,
        operationId
      )
    );
    return { crc32: result.crc32 >>> 0, sizeBytes: result.sizeBytes, sha256: result.sha256 ?? null };
  }

  async addText(archiveName: string, text: string) {
    return SongNookFileIOModule!.zipAddTextAsync!(this.id, archiveName, text);
  }

  async addBase64(archiveName: string, base64Data: string) {
    return SongNookFileIOModule!.zipAddDataAsync!(this.id, archiveName, base64Data);
  }

  async finish() {
    return SongNookFileIOModule!.zipFinishAsync!(this.id);
  }

  async abort() {
    await SongNookFileIOModule!.zipAbortAsync!(this.id).catch(() => {});
  }
}

/** Copy `length` bytes at `offset` of a local file into a new file, hashing as it goes. */
export async function extractRangeNative(
  sourceUri: string,
  offset: number,
  length: number,
  destinationUri: string,
  options?: PassOptions & { sha256?: boolean }
): Promise<NativeFilePassResult> {
  const result = await withOperation("extract", options, (operationId) =>
    SongNookFileIOModule!.extractRangeAsync!(sourceUri, offset, length, destinationUri, options?.sha256 ?? false, operationId)
  );
  return { crc32: result.crc32 >>> 0, sizeBytes: result.sizeBytes, sha256: result.sha256 ?? null };
}

// ── SongNook Send, sealed end to end (docs/product-plan/send-e2e-encryption.md) ──

/** True on builds that carry the native SNS1 seal; older builds send and
 *  receive unsealed parcels only. */
export function isSealAvailable(): boolean {
  return typeof SongNookFileIOModule?.sealFileAsync === "function";
}

/** Seal a local file into `destinationUri`, a record at a time. */
export async function sealFileNative(sourceUri: string, destinationUri: string, keyText: string): Promise<number> {
  return (await SongNookFileIOModule!.sealFileAsync!(sourceUri, destinationUri, keyText)).sizeBytes;
}

/** Open a sealed file into `destinationUri`; throws on a wrong key or any change. */
export async function openSealedFileNative(sourceUri: string, destinationUri: string, keyText: string): Promise<number> {
  return (await SongNookFileIOModule!.openSealedFileAsync!(sourceUri, destinationUri, keyText)).sizeBytes;
}

export function sealBase64Native(base64: string, keyText: string): Promise<string> {
  return SongNookFileIOModule!.sealBase64Async!(base64, keyText);
}

export function openSealedBase64Native(base64: string, keyText: string): Promise<string> {
  return SongNookFileIOModule!.openSealedBase64Async!(base64, keyText);
}

// ── Backup folder for automatic backup (2026-11-02) ──────────────────────────────────

/** Thrown (as the error message) when the chosen folder no longer exists. */
export const FOLDER_GONE = "SONGNOOK_FOLDER_GONE";
/** Thrown when the app lost permission to the chosen folder. */
export const FOLDER_NO_ACCESS = "SONGNOOK_FOLDER_NO_ACCESS";

/** True on builds that carry the backup-folder functions; older builds hide automatic backup. */
export function isBackupFolderAvailable(): boolean {
  const m = SongNookFileIOModule;
  return (
    m != null &&
    typeof m.folderBookmarkAsync === "function" &&
    typeof m.folderResolveAsync === "function" &&
    typeof m.folderListAsync === "function" &&
    typeof m.folderWriteFileAsync === "function" &&
    typeof m.folderCopyOutAsync === "function"
  );
}

export type BackupFolderChild = { name: string; uri: string; size: number; isDirectory: boolean };

/** The native folder calls, in one object so services can take a test double instead. */
export const nativeBackupFolder = {
  bookmark: (uri: string) => SongNookFileIOModule!.folderBookmarkAsync!(uri),
  resolve: (handle: string) => SongNookFileIOModule!.folderResolveAsync!(handle),
  child: (dirUri: string, name: string, createDirectory: boolean) =>
    SongNookFileIOModule!.folderChildAsync!(dirUri, name, createDirectory),
  list: (dirUri: string): Promise<BackupFolderChild[]> => SongNookFileIOModule!.folderListAsync!(dirUri),
  writeFile: (dirUri: string, name: string, sourceUri: string) =>
    SongNookFileIOModule!.folderWriteFileAsync!(dirUri, name, sourceUri),
  writeText: (dirUri: string, name: string, text: string) =>
    SongNookFileIOModule!.folderWriteTextAsync!(dirUri, name, text),
  readText: (fileUri: string) => SongNookFileIOModule!.folderReadTextAsync!(fileUri),
  copyOut: async (
    fileUri: string,
    destinationUri: string,
    options?: PassOptions & { sha256?: boolean }
  ): Promise<NativeFilePassResult> => {
    const result = await withOperation("folder-out", options, (operationId) =>
      SongNookFileIOModule!.folderCopyOutAsync!(fileUri, destinationUri, options?.sha256 ?? false, operationId)
    );
    return { crc32: result.crc32 >>> 0, sizeBytes: result.sizeBytes, sha256: result.sha256 ?? null };
  },
  remove: (fileUri: string) => SongNookFileIOModule!.folderDeleteAsync!(fileUri),
};

/** Keep a local temp file out of the iPhone's iCloud device backup (no-op elsewhere). */
export async function excludeFromDeviceBackup(uri: string) {
  await SongNookFileIOModule?.setExcludedFromBackupAsync?.(uri);
}
