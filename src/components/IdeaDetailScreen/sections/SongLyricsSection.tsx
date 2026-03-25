import { ScrollView } from "react-native";
import { LyricsVersionsPanel } from "../../LyricsScreen/LyricsVersionsPanel";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongLyricsSection() {
  const { screen } = useSongScreen();
  if (screen.selectedIdea?.kind !== "project" || screen.isEditMode || screen.songTab !== "lyrics") {
    return null;
  }

  return (
    <ScrollView
      style={styles.songDetailTabScroll}
      contentContainerStyle={[
        styles.songDetailTabScrollContent,
        { paddingBottom: screen.songPageBaseBottomPadding },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <LyricsVersionsPanel projectIdea={screen.selectedIdea} />
    </ScrollView>
  );
}
