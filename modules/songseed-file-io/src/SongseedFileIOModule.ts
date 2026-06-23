import { NativeModule, requireOptionalNativeModule } from "expo";

type CopyProgressEvent = {
  operationId: string;
  completedBytes: number;
  totalBytes: number;
};

type SongseedFileIOEvents = {
  onCopyProgress: (event: CopyProgressEvent) => void;
};

declare class SongseedFileIOModule extends NativeModule<SongseedFileIOEvents> {
  copyFileToContentUriAsync(
    operationId: string,
    sourceUri: string,
    targetUri: string
  ): Promise<{ copiedBytes: number; totalBytes: number }>;
  cancelCopy(operationId: string): void;
  deleteContentUriAsync(targetUri: string): Promise<void>;
}

export default requireOptionalNativeModule<SongseedFileIOModule>("SongseedFileIO");
