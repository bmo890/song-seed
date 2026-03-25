import { SongScreenProvider } from "./provider/SongScreenProvider";
import { SongScreenContent } from "./components/SongScreenContent";

export function IdeaDetailScreen() {
  return (
    <SongScreenProvider>
      <SongScreenContent />
    </SongScreenProvider>
  );
}
