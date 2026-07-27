import { Pressable, Text, View } from "react-native";
import ReAnimated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useStore } from "../../../../state/useStore";
import { haptic } from "../../../../design/haptics";
import { styles } from "../../styles";
import { useSongScreen } from "../../provider/SongScreenProvider";
import { SongClipListSectionLabel } from "./SongClipListSectionLabel";
import { SongClipToolbarControls } from "./SongClipToolbarControls";
import { songClipToolbarStyles } from "./styles";

/**
 * Selection mode repurposes the toolbar's controls row IN PLACE — count, All,
 * Cancel at the same height the view switch occupied, so entering selection
 * never pushes the takes downward. No card, no shadow: it's chrome, not content.
 */
function SelectionControlsRow() {
  const { t } = useTranslation();
  const { screen } = useSongScreen();
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const selectableClipIds = (screen.selectedIdea?.clips ?? []).map((c) => c.id);
  const allSelected =
    selectableClipIds.length > 0 &&
    selectableClipIds.every((id) => selectedClipIds.includes(id));

  return (
    <View style={songClipToolbarStyles.selectionRow}>
      <Text style={songClipToolbarStyles.selectionCount}>
        {t("common.selected", { count: selectedClipIds.length })}
      </Text>
      <Pressable
        style={({ pressed }) => [
          allSelected ? { opacity: 0.35 } : null,
          pressed && !allSelected ? styles.pressDown : null,
        ]}
        disabled={allSelected}
        onPress={() => {
          haptic.tap();
          useStore.getState().replaceClipSelection(selectableClipIds);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t("common.selectAll")}
      >
        <Text style={songClipToolbarStyles.selectionAll}>{t("common.all")}</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable
        style={({ pressed }) => [
          songClipToolbarStyles.selectionCancel,
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => {
          haptic.tap();
          useStore.getState().cancelClipSelection();
        }}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancelSelection")}
      >
        <Text style={songClipToolbarStyles.selectionCancelText}>{t("common.cancel")}</Text>
      </Pressable>
    </View>
  );
}

type SongClipListToolbarProps = {
  visibleIdeaCount: number;
};

export function SongClipListToolbar({
  visibleIdeaCount,
}: SongClipListToolbarProps) {
  const { t } = useTranslation();
  const { screen, store } = useSongScreen();
  const selectedIdea = screen.selectedIdea;
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);

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
        {/* Takes, not "Ideas" — inside a sketch the terminology law says take. */}
        <SongClipListSectionLabel
          title={t(selectedIdea.kind === "project" ? "screens.takes" : "songDetail.replies")}
          count={visibleIdeaCount}
        />
      </ReAnimated.View>

      {selectedIdea.kind === "project" ? (
        clipSelectionMode ? (
          <SelectionControlsRow />
        ) : (
          <SongClipToolbarControls
            projectCustomTags={selectedIdea.customTags ?? []}
            clipGroups={selectedIdea.clipGroups ?? []}
          />
        )
      ) : null}
    </View>
  );
}
