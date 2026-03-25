import { View } from "react-native";
import { styles } from "../styles";
import { IdeaNotes } from "../IdeaNotes";
import { IdeaStatusProgress } from "../IdeaStatusProgress";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongClipListSummary() {
  const { screen } = useSongScreen();
  const selectedIdea = screen.selectedIdea;

  if (!selectedIdea) return null;

  if (selectedIdea.kind === "project") {
    if (!screen.isEditMode) return null;

    return (
      <View style={styles.songDetailTopStack}>
        <IdeaStatusProgress
          isEditMode={screen.isEditMode}
          draftStatus={screen.draftStatus}
          setDraftStatus={screen.setDraftStatus}
          draftCompletion={screen.draftCompletion}
          setDraftCompletion={screen.setDraftCompletion}
          kind={selectedIdea.kind}
          status={selectedIdea.status}
          completionPct={selectedIdea.completionPct}
        />
      </View>
    );
  }

  return (
    <View style={styles.songDetailTopStack}>
      <IdeaNotes isEditMode={screen.isEditMode} notes={selectedIdea.notes} />
    </View>
  );
}
