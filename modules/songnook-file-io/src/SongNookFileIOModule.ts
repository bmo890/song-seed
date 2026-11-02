import { NativeModule, requireOptionalNativeModule } from "expo";

type CopyProgressEvent = {
  operationId: string;
  completedBytes: number;
  totalBytes: number;
};

type SongNookFileIOEvents = {
  onCopyProgress: (event: CopyProgressEvent) => void;
};

declare class SongNookFileIOModule extends NativeModule<SongNookFileIOEvents> {
  copyFileToContentUriAsync(
    operationId: string,
    sourceUri: string,
    targetUri: string
  ): Promise<{ copiedBytes: number; totalBytes: number }>;
  cancelCopy(operationId: string): void;
  deleteContentUriAsync(targetUri: string): Promise<void>;
  // Native stored-zip passes (2026-10-20). Missing on builds made before them.
  zipCreateAsync?(writerId: string, destinationUri: string): Promise<void>;
  zipAddFileAsync?(
    writerId: string,
    archiveName: string,
    sourceUri: string,
    expectedSize: number,
    computeSha256: boolean,
    operationId: string
  ): Promise<{ crc32: number; sizeBytes: number; sha256?: string | null }>;
  zipAddTextAsync?(writerId: string, archiveName: string, text: string): Promise<{ crc32: number; sizeBytes: number }>;
  zipAddDataAsync?(writerId: string, archiveName: string, base64Data: string): Promise<{ crc32: number; sizeBytes: number }>;
  zipFinishAsync?(writerId: string): Promise<{ sizeBytes: number }>;
  zipAbortAsync?(writerId: string): Promise<void>;
  // Zip64 past 4 GB (2026-11-02). Missing on builds made before it.
  zipSupportsZip64?(): boolean;
  extractRangeAsync?(
    sourceUri: string,
    offset: number,
    length: number,
    destinationUri: string,
    computeSha256: boolean,
    operationId: string
  ): Promise<{ crc32: number; sizeBytes: number; sha256?: string | null }>;
  // Backup folder for automatic backup (2026-11-02). Missing on builds made before it.
  folderBookmarkAsync?(uri: string): Promise<string>;
  folderResolveAsync?(handle: string): Promise<{ uri: string; name: string; handle: string }>;
  folderChildAsync?(dirUri: string, name: string, createDirectory: boolean): Promise<string | null>;
  folderListAsync?(dirUri: string): Promise<Array<{ name: string; uri: string; size: number; isDirectory: boolean }>>;
  folderWriteFileAsync?(dirUri: string, name: string, sourceUri: string): Promise<{ uri: string; sizeBytes: number }>;
  folderWriteTextAsync?(dirUri: string, name: string, text: string): Promise<{ uri: string; sizeBytes: number }>;
  folderReadTextAsync?(fileUri: string): Promise<string>;
  folderCopyOutAsync?(
    fileUri: string,
    destinationUri: string,
    computeSha256: boolean,
    operationId: string
  ): Promise<{ crc32: number; sizeBytes: number; sha256?: string | null }>;
  folderDeleteAsync?(fileUri: string): Promise<void>;
  setExcludedFromBackupAsync?(uri: string): Promise<void>;
  // SongNook Send sealed end to end (2026-11-01). Missing on builds made before it.
  sealFileAsync?(sourceUri: string, destinationUri: string, keyText: string): Promise<{ sizeBytes: number }>;
  openSealedFileAsync?(sourceUri: string, destinationUri: string, keyText: string): Promise<{ sizeBytes: number }>;
  sealBase64Async?(base64: string, keyText: string): Promise<string>;
  openSealedBase64Async?(base64: string, keyText: string): Promise<string>;
}

export default requireOptionalNativeModule<SongNookFileIOModule>("SongNookFileIO");
