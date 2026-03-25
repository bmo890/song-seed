import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import {
  getSongClipTagFilterSummary,
  getSongMainTakeFilterSummary,
  getTagColor,
  SONG_CLIP_TAG_OPTIONS,
  type SongClipTagFilter,
} from "../../songClipControls";
import type { CustomTagDefinition } from "../../../../types";
import { songClipToolbarStyles } from "./styles";

type SongClipFilterMenuProps = {
  clipViewMode: "timeline" | "evolution";
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  timelineMainTakesOnly: boolean;
  setTimelineMainTakesOnly: (value: boolean) => void;
  projectCustomTags: CustomTagDefinition[];
  globalCustomTags: CustomTagDefinition[];
  onClose: () => void;
};

export function SongClipFilterMenu({
  clipViewMode,
  clipTagFilter,
  setClipTagFilter,
  timelineMainTakesOnly,
  setTimelineMainTakesOnly,
  projectCustomTags,
  globalCustomTags,
  onClose,
}: SongClipFilterMenuProps) {
  return (
    <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, songClipToolbarStyles.menuOffset]}>
      <View style={styles.ideasDropdownSectionToggle}>
        <Text style={styles.ideasDropdownSectionToggleText}>Tags</Text>
        <View style={styles.ideasDropdownSectionMeta}>
          <Text style={styles.ideasDropdownSectionMetaText}>
            {getSongClipTagFilterSummary(
              clipTagFilter,
              projectCustomTags,
              globalCustomTags
            )}
          </Text>
        </View>
      </View>
      <View style={styles.ideasStageChipsWrap}>
        {([
          { key: "all", label: "All" },
          { key: "untagged", label: "Untagged" },
          ...SONG_CLIP_TAG_OPTIONS,
          ...projectCustomTags.map((t) => ({ key: t.key, label: t.label })),
          ...globalCustomTags.map((t) => ({ key: t.key, label: t.label })),
        ] as { key: string; label: string }[]).map((option) => {
          const active = clipTagFilter === option.key;
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
                setClipTagFilter(option.key);
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
      </View>

      {clipViewMode === "timeline" ? (
        <>
          <View style={styles.ideasDropdownDivider} />
          <View style={styles.ideasDropdownSectionToggle}>
            <Text style={styles.ideasDropdownSectionToggleText}>Display</Text>
            <View style={styles.ideasDropdownSectionMeta}>
              <Text style={styles.ideasDropdownSectionMetaText}>
                {getSongMainTakeFilterSummary(timelineMainTakesOnly)}
              </Text>
            </View>
          </View>
          <View style={styles.ideasStageChipsWrap}>
            {([
              { key: "all", label: "All takes", value: false },
              { key: "main", label: "Main takes only", value: true },
            ] as const).map((option) => {
              const active = timelineMainTakesOnly === option.value;
              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [
                    styles.ideasStageChip,
                    active ? styles.ideasStageChipActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    setTimelineMainTakesOnly(option.value);
                    onClose();
                  }}
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
        </>
      ) : null}
    </View>
  );
}
