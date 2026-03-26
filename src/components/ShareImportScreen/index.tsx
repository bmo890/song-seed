import { ShareImportScreenContent } from "./components/ShareImportScreenContent";
import type { ShareImportScreenProps } from "./types";

export function ShareImportScreen({ fallbackCollectionId }: ShareImportScreenProps) {
  return <ShareImportScreenContent fallbackCollectionId={fallbackCollectionId} />;
}
