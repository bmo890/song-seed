import { View } from "react-native";
import { styles } from "../styles";
import { IdeaNotes } from "../IdeaNotes";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongClipListSummary() {
  const { screen } = useSongScreen();
  const selectedIdea = screen.selectedIdea;

  if (!selectedIdea) return null;

  // Songs edit their progress in the edit sheet now, so nothing is injected into
  // the takes list for projects.
  if (selectedIdea.kind === "project") {
    return null;
  }

  return (
    <View style={styles.songDetailTopStack}>
      <IdeaNotes isEditMode={screen.isEditMode} notes={selectedIdea.notes} />
    </View>
  );
}
