import { View } from "react-native";
import ReAnimated, { useAnimatedStyle } from "react-native-reanimated";
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

  // Keep the label mounted so the pinned toolbar height stays stable while the
  // collapsible header crosses its docked threshold.
  const labelStyle = useAnimatedStyle(() => {
    const h = screen.collapsibleHeaderHeight.value;
    const collapsed = h > 0 && screen.scrollY.value >= h - 2;
    return { opacity: collapsed ? 0 : 1 };
  });

  if (!selectedIdea) return null;

  return (
    <View style={songClipToolbarStyles.headerStack}>
      <ReAnimated.View style={labelStyle} pointerEvents="none">
        <SongClipListSectionLabel
          title={selectedIdea.kind === "project" ? "Ideas" : "Replies"}
          count={visibleIdeaCount}
        />
      </ReAnimated.View>

      {selectedIdea.kind === "project" ? (
        <SongClipToolbarControls
          projectCustomTags={selectedIdea.customTags ?? []}
          clipGroups={selectedIdea.clipGroups ?? []}
        />
      ) : null}
    </View>
  );
}
