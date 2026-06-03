import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import {
  getTagColor,
  getTagLabel,
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
  const toggleTag = (key: string) => {
    if (clipTagFilter.includes(key)) {
      setClipTagFilter(clipTagFilter.filter((k) => k !== key));
    } else {
      setClipTagFilter([...clipTagFilter, key]);
    }
  };

  const allOptions: { key: string; label: string }[] = [
    { key: "untagged", label: "Untagged" },
    ...SONG_CLIP_TAG_OPTIONS,
    ...projectCustomTags.map((t) => ({ key: t.key, label: t.label })),
    ...globalCustomTags.map((t) => ({ key: t.key, label: t.label })),
  ];

  return (
    <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, songClipToolbarStyles.menuOffsetRight]}>
      {/* Header row */}
      <View style={styles.ideasDropdownSectionToggle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="pricetag-outline" size={12} color="#a89994" />
          <Text style={styles.ideasDropdownSectionToggleText}>Tags</Text>
        </View>
        {clipTagFilter.length > 0 ? (
          <Pressable
            onPress={() => setClipTagFilter([])}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          >
            <Text style={songClipToolbarStyles.filterClearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Tag chips (multiselect) — styled to match the actual tag badges on clips */}
      <ScrollView
        style={styles.ideasStageChipsScroll}
        contentContainerStyle={styles.ideasStageChipsWrap}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {allOptions.map((option) => {
          const active = clipTagFilter.includes(option.key);
          const isUntagged = option.key === "untagged";
          const tagColor = isUntagged
            ? null
            : getTagColor(option.key, projectCustomTags, globalCustomTags);

          if (tagColor) {
            // Colored tag — matches the badge on the clip card
            return (
              <Pressable
                key={option.key}
                style={({ pressed }) => [
                  styles.clipCardTagBadge,
                  { backgroundColor: tagColor.bg },
                  active
                    ? { borderWidth: 1, borderColor: tagColor.text }
                    : { borderWidth: 1, borderColor: "transparent" },
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => toggleTag(option.key)}
              >
                <Text style={[styles.clipCardTagBadgeText, { color: tagColor.text }]}>
                  {getTagLabel(option.key, projectCustomTags, globalCustomTags)}
                </Text>
              </Pressable>
            );
          }

          // "Untagged" — same badge shape, neutral warm color
          const untaggedBg = "#EDE9E4";
          const untaggedText = "#84736f";
          return (
            <Pressable
              key={option.key}
              style={({ pressed }) => [
                styles.clipCardTagBadge,
                { backgroundColor: untaggedBg },
                active
                  ? { borderWidth: 1, borderColor: untaggedText }
                  : { borderWidth: 1, borderColor: "transparent" },
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => toggleTag(option.key)}
            >
              <Text style={[styles.clipCardTagBadgeText, { color: untaggedText }]}>
                Untagged
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {clipViewMode === "timeline" ? (
        <>
          <View style={styles.ideasDropdownDivider} />
          <View style={styles.ideasDropdownSectionToggle}>
            <Text style={styles.ideasDropdownSectionToggleText}>Display</Text>
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
