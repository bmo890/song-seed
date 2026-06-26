import { View } from "react-native";
import { styles } from "../styles";
import { IdeaNotes } from "../IdeaNotes";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";

export function SongNotesSection() {
  const { screen } = useSongScreen();
  if (!screen.selectedIdea || screen.songTab !== "notes") {
    return null;
  }

  return (
    <CollapsingTabStage
      contentContainerStyle={[
        styles.songDetailTabScrollContent,
        { paddingBottom: screen.songPageBaseBottomPadding },
      ]}
    >
      <View style={styles.songDetailTabPanelWrap}>
        <IdeaNotes
          isEditMode={false}
          notes={screen.selectedIdea.notes}
          tabMode
          cardStyle={styles.songDetailTabPanelCard}
        />
      </View>
    </CollapsingTabStage>
  );
}
