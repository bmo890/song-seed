import { ScrollView, View } from "react-native";
import { styles } from "../styles";
import { IdeaNotes } from "../IdeaNotes";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongNotesSection() {
  const { screen } = useSongScreen();
  if (!screen.selectedIdea || screen.isEditMode || screen.songTab !== "notes") {
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
      <View style={styles.songDetailTabPanelWrap}>
        <IdeaNotes
          isEditMode={false}
          notes={screen.selectedIdea.notes}
          tabMode
          cardStyle={styles.songDetailTabPanelCard}
        />
      </View>
    </ScrollView>
  );
}
