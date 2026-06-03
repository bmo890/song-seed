import { Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "../../styles";
import {
  getSongClipTagFilterSummary,
  getTagColor,
  SONG_CLIP_TAG_OPTIONS,
  type SongClipTagFilter,
} from "../../songClipControls";
import type { SongTimelineSortDirection } from "../../../../clipGraph";
import type { CustomTagDefinition } from "../../../../types";
import { songClipToolbarStyles } from "./styles";

type SongClipViewMenuProps = {
  clipViewMode: "timeline" | "evolution";
  setClipViewMode: (mode: "timeline" | "evolution") => void;
  timelineSortDirection: SongTimelineSortDirection;
  setTimelineSortDirection: (direction: SongTimelineSortDirection) => void;
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  projectCustomTags: CustomTagDefinition[];
  globalCustomTags: CustomTagDefinition[];
  onClose: () => void;
};

export function SongClipViewMenu({
  clipViewMode,
  setClipViewMode,
  timelineSortDirection,
  setTimelineSortDirection,
  clipTagFilter,
  setClipTagFilter,
  projectCustomTags,
  globalCustomTags,
  onClose,
}: SongClipViewMenuProps) {
  return (
    <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, songClipToolbarStyles.menuOffset]}>
      <View style={styles.ideasDropdownSectionToggle}>
        <Text style={styles.ideasDropdownSectionToggleText}>Layout</Text>
      </View>
      <View style={styles.ideasStageChipsWrap}>
        {([
          { key: "evolution", label: "Evolution" },
          { key: "timeline", label: "Timeline" },
        ] as const).map((option) => {
          const active = clipViewMode === option.key;
          return (
            <Pressable
              key={option.key}
              style={({ pressed }) => [
                styles.ideasStageChip,
                active ? styles.ideasStageChipActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => setClipViewMode(option.key)}
            >
              <Text
                style={[
                  styles.ideasStageChipText,
                  active ? styles.ideasStageChipTextActive : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.ideasDropdownDivider} />
      <View style={styles.ideasDropdownSectionToggle}>
        <Text style={styles.ideasDropdownSectionToggleText}>Arrange</Text>
      </View>
      <View style={styles.ideasStageChipsWrap}>
        {([
          { key: "desc", label: "Newest first" },
          { key: "asc", label: "Oldest first" },
        ] as const).map((option) => {
          const active = timelineSortDirection === option.key;
          return (
            <Pressable
              key={option.key}
              style={({ pressed }) => [
                styles.ideasStageChip,
                active ? styles.ideasStageChipActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => setTimelineSortDirection(option.key)}
            >
              <Text
                style={[
                  styles.ideasStageChipText,
                  active ? styles.ideasStageChipTextActive : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.ideasDropdownDivider} />
      <View style={styles.ideasDropdownSectionToggle}>
        <Text style={styles.ideasDropdownSectionToggleText}>Show</Text>
        <View style={styles.ideasDropdownSectionMeta}>
          <Text style={styles.ideasDropdownSectionMetaText}>
            {getSongClipTagFilterSummary(clipTagFilter, projectCustomTags, globalCustomTags)}
          </Text>
        </View>
      </View>
      <ScrollView
        style={styles.ideasStageChipsScroll}
        contentContainerStyle={styles.ideasStageChipsWrap}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {([
          { key: "all", label: "All" },
          { key: "untagged", label: "Untagged" },
          ...SONG_CLIP_TAG_OPTIONS,
          ...projectCustomTags.map((t) => ({ key: t.key, label: t.label })),
          ...globalCustomTags.map((t) => ({ key: t.key, label: t.label })),
        ] as { key: string; label: string }[]).map((option) => {
          const active = option.key === "all" ? clipTagFilter.length === 0 : clipTagFilter.includes(option.key);
          const customColor =
            option.key !== "all" && option.key !== "untagged"
              ? getTagColor(option.key, projectCustomTags, globalCustomTags)
              : null;
          const isCustom =
            !SONG_CLIP_TAG_OPTIONS.some((t) => t.key === option.key) &&
            option.key !== "all" &&
            option.key !== "untagged";

          return (
            <Pressable
              key={option.key}
              style={({ pressed }) => [
                styles.ideasStageChip,
                active ? styles.ideasStageChipActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => {
                if (option.key === "all") {
                  setClipTagFilter([]);
                } else {
                  const next = clipTagFilter.includes(option.key)
                    ? clipTagFilter.filter((k) => k !== option.key)
                    : [...clipTagFilter, option.key];
                  setClipTagFilter(next);
                }
                onClose();
              }}
            >
              {isCustom && customColor ? (
                <View
                  style={[
                    songClipToolbarStyles.customTagDot,
                    { backgroundColor: customColor.text },
                  ]}
                />
              ) : null}
              <Text
                style={[
                  styles.ideasStageChipText,
                  active ? styles.ideasStageChipTextActive : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
