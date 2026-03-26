import { useEffect, useMemo, useState } from "react";
import {
  buildImportedTitle,
  type ImportedAudioAsset,
} from "../../../services/audioStorage";
import { extractSharedAudioAssets } from "../../../services/shareImport";

type ShareIntentFiles = Parameters<typeof extractSharedAudioAssets>[0];

export function useResolvedShareAssets(shareIntentFiles: ShareIntentFiles) {
  const [shareAssets, setShareAssets] = useState<{
    assets: ImportedAudioAsset[];
    rejectedCount: number;
  }>({
    assets: [],
    rejectedCount: 0,
  });
  const [isResolvingShareAssets, setIsResolvingShareAssets] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!shareIntentFiles?.length) {
        setShareAssets({ assets: [], rejectedCount: 0 });
        setIsResolvingShareAssets(false);
        return;
      }

      setIsResolvingShareAssets(true);
      try {
        const nextShareAssets = await extractSharedAudioAssets(shareIntentFiles);
        if (!cancelled) {
          setShareAssets(nextShareAssets);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingShareAssets(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [shareIntentFiles]);

  const importedAssets = shareAssets.assets;
  const previewNames = useMemo(
    () => importedAssets.slice(0, 4).map((asset) => buildImportedTitle(asset.name)),
    [importedAssets]
  );
  const unsupportedOnly =
    !isResolvingShareAssets &&
    importedAssets.length === 0 &&
    (shareIntentFiles?.length ?? 0) > 0;

  return {
    shareAssets,
    importedAssets,
    previewNames,
    unsupportedOnly,
    isResolvingShareAssets,
  };
}
