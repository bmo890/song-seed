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
