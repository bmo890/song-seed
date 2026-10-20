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
  extractRangeAsync?(
    sourceUri: string,
    offset: number,
    length: number,
    destinationUri: string,
    computeSha256: boolean,
    operationId: string
  ): Promise<{ crc32: number; sizeBytes: number; sha256?: string | null }>;
}

export default requireOptionalNativeModule<SongNookFileIOModule>("SongNookFileIO");
