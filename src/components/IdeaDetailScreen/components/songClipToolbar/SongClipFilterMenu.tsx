import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import {
  getTagColor,
  getTagLabel,
  SONG_CLIP_TAG_OPTIONS,
  type SongClipGroupFilter,
  type SongClipTagFilter,
} from "../../songClipControls";
import type { ClipGroup, CustomTagDefinition } from "../../../../types";
import { songClipToolbarStyles } from "./styles";
import Animated, { FadeIn } from "react-native-reanimated";
import { durations } from "../../../../design/motion";
import { colors } from "../../../../design/tokens";

type SongClipFilterMenuProps = {
  clipViewMode: "timeline" | "evolution";
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  clipGroupFilter: SongClipGroupFilter;
  setClipGroupFilter: (filter: SongClipGroupFilter) => void;
  clipBookmarkedOnly: boolean;
  setClipBookmarkedOnly: (value: boolean) => void;
  clipGroups: ClipGroup[];
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
  clipGroupFilter,
  setClipGroupFilter,
  clipBookmarkedOnly,
  setClipBookmarkedOnly,
  clipGroups,
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
  const toggleGroup = (groupId: string) => {
    if (clipGroupFilter.includes(groupId)) {
      setClipGroupFilter(clipGroupFilter.filter((id) => id !== groupId));
    } else {
      setClipGroupFilter([...clipGroupFilter, groupId]);
    }
  };
  const hasActiveFilters =
    clipTagFilter.length > 0 || clipGroupFilter.length > 0 || clipBookmarkedOnly;

  const allOptions: { key: string; label: string }[] = [
    { key: "untagged", label: "Untagged" },
    ...SONG_CLIP_TAG_OPTIONS,
    ...projectCustomTags.map((t) => ({ key: t.key, label: t.label })),
    ...globalCustomTags.map((t) => ({ key: t.key, label: t.label })),
  ];

  return (
    <Animated.View entering={FadeIn.duration(durations.fast)} style={[styles.ideasSortMenu, styles.ideasPopoverMenu, songClipToolbarStyles.menuOffsetRight]}>
      {/* Header row */}
      <View style={styles.ideasDropdownSectionToggle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
          <Text style={styles.ideasDropdownSectionToggleText}>Tags</Text>
        </View>
        {hasActiveFilters ? (
          <Pressable
            onPress={() => {
              setClipTagFilter([]);
              setClipGroupFilter([]);
              setClipBookmarkedOnly(false);
            }}
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
          const untaggedBg = colors.surfaceHigh;
          const untaggedText = colors.textSecondary;
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

      <View style={styles.ideasDropdownDivider} />
      <View style={styles.ideasDropdownSectionToggle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="bookmark-outline" size={12} color={colors.textMuted} />
          <Text style={styles.ideasDropdownSectionToggleText}>Saved clips</Text>
        </View>
      </View>
      <View style={styles.ideasStageChipsWrap}>
        <Pressable
          style={({ pressed }) => [
            styles.ideasStageChip,
            clipBookmarkedOnly ? styles.ideasStageChipActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => setClipBookmarkedOnly(!clipBookmarkedOnly)}
        >
          <Text
            style={[
              styles.ideasStageChipText,
              clipBookmarkedOnly ? styles.ideasStageChipTextActive : null,
            ]}
          >
            Bookmarked only
          </Text>
        </Pressable>
      </View>

      {clipGroups.length > 0 ? (
        <>
          <View style={styles.ideasDropdownDivider} />
          <View style={styles.ideasDropdownSectionToggle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="folder-open-outline" size={12} color={colors.textMuted} />
              <Text style={styles.ideasDropdownSectionToggleText}>Groups</Text>
            </View>
          </View>
          <View style={styles.ideasStageChipsWrap}>
            {clipGroups.map((group) => {
              const active = clipGroupFilter.includes(group.id);
              return (
                <Pressable
                  key={group.id}
                  style={({ pressed }) => [
                    styles.ideasStageChip,
                    active ? styles.ideasStageChipActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => toggleGroup(group.id)}
                >
                  <Text
                    style={[
                      styles.ideasStageChipText,
                      active ? styles.ideasStageChipTextActive : null,
                    ]}
                  >
                    {group.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

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
    </Animated.View>
  );
}
