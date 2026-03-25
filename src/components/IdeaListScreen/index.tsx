import { CollectionScreenContent } from "./components/CollectionScreenContent";
import { CollectionScreenProvider } from "./provider/CollectionScreenProvider";

export function IdeaListScreen() {
  return (
    <CollectionScreenProvider>
      <CollectionScreenContent />
    </CollectionScreenProvider>
  );
}
