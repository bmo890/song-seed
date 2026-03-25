import { View } from "react-native";
import { ClipList } from "../components/ClipList";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongTakesSection() {
  const { screen } = useSongScreen();
  const hidden = screen.isProject && !screen.isEditMode && screen.songTab !== "takes";
  if (hidden) {
    return <View style={{ height: 0, overflow: "hidden" }} />;
  }

  return <ClipList />;
}
