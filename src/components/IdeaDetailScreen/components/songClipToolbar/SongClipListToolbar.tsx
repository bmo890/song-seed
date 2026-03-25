import { View } from "react-native";
import { styles } from "../../styles";
import { useSongScreen } from "../../provider/SongScreenProvider";
import { SongClipListSectionLabel } from "./SongClipListSectionLabel";
import { SongClipToolbarControls } from "./SongClipToolbarControls";
import { songClipToolbarStyles } from "./styles";

type SongClipListToolbarProps = {
  visibleIdeaCount: number;
};

export function SongClipListToolbar({
  visibleIdeaCount,
}: SongClipListToolbarProps) {
  const { screen, store } = useSongScreen();
  const selectedIdea = screen.selectedIdea;
  if (!selectedIdea || store.clipSelectionMode) return null;

  return (
    <View style={songClipToolbarStyles.headerStack}>
      <SongClipListSectionLabel
        title={selectedIdea.kind === "project" ? "Ideas" : "Replies"}
        count={visibleIdeaCount}
      />

      {selectedIdea.kind === "project" ? (
        <SongClipToolbarControls projectCustomTags={selectedIdea.customTags ?? []} />
      ) : null}
    </View>
  );
}
