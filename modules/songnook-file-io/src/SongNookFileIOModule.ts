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
}

export default requireOptionalNativeModule<SongNookFileIOModule>("SongNookFileIO");
