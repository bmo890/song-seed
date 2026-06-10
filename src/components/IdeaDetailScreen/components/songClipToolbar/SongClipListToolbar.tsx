import { useState } from "react";
import { View } from "react-native";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
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

  // Hide the "IDEAS N" label once the collapsible header has fully slid away.
  const [isCollapsed, setIsCollapsed] = useState(false);
  useAnimatedReaction(
    () => {
      const h = screen.collapsibleHeaderHeight.value;
      return h > 0 && screen.scrollY.value >= h - 2;
    },
    (collapsed, prev) => {
      if (collapsed !== prev) runOnJS(setIsCollapsed)(collapsed);
    }
  );

  if (!selectedIdea) return null;

  return (
    <View style={songClipToolbarStyles.headerStack}>
      {!isCollapsed ? (
        <SongClipListSectionLabel
          title={selectedIdea.kind === "project" ? "Ideas" : "Replies"}
          count={visibleIdeaCount}
        />
      ) : null}

      {selectedIdea.kind === "project" ? (
        <SongClipToolbarControls
          projectCustomTags={selectedIdea.customTags ?? []}
          clipGroups={selectedIdea.clipGroups ?? []}
        />
      ) : null}
    </View>
  );
}
