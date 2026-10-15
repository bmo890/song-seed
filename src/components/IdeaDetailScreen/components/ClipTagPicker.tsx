import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Switch } from "../../common/Switch";
import { Button } from "../../common/Button";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, CustomTagDefinition, SongIdea } from "../../../types";
import { BottomSheet } from "../../common/BottomSheet";
import { haptic } from "../../../design/haptics";
import {
  SONG_CLIP_TAG_OPTIONS,
  CUSTOM_TAG_COLOR_OPTIONS,
  getTagColor,
  type TagColor,
} from "../songClipControls";
import { colors, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserTextInput } from "../../../i18n";

const randomTagColor = () =>
  CUSTOM_TAG_COLOR_OPTIONS[Math.floor(Math.random() * CUSTOM_TAG_COLOR_OPTIONS.length)].bg;

/** How many of the targeted clips carry a tag — drives the tri-state chip. */
type TagState = "none" | "some" | "all";

type ClipTagPickerProps = {
  visible: boolean;
  clips: ClipVersion[];
  idea: SongIdea;
  globalCustomTags: CustomTagDefinition[];
  onClose: () => void;
};

/** A clip to tag, with the idea it belongs to. */
export type ClipTagTarget = { ideaId: string; clip: ClipVersion };

type ClipTagEditorFieldsProps = {
  globalCustomTags: CustomTagDefinition[];
  /** Inside a sketch the take's Bookmarked switch leads the tags; the
   *  collection bookmarks whole ideas from its own row instead. */
  showBookmark?: boolean;
} & (
  | {
      /** Inside one sketch: its clips; a new custom tag belongs to the sketch. */
      clips: ClipVersion[];
      idea: SongIdea;
      targets?: undefined;
    }
  | {
      /** Across the collection (2026-10-03): clips of several ideas; a new
       *  custom tag is global. */
      targets: ClipTagTarget[];
      clips?: undefined;
      idea?: undefined;
    }
);

/** Edits tags across one or more clips. With multiple, a chip is "all" (every
 * clip has it), "some", or "none"; tapping applies to all, or removes from all
 * when every clip already has it. */
export function ClipTagEditorFields(props: ClipTagEditorFieldsProps) {
  const { globalCustomTags, showBookmark = false } = props;
  const idea = props.idea;
  const targets = useMemo<ClipTagTarget[]>(
    () => props.targets ?? (props.clips ?? []).map((clip) => ({ ideaId: props.idea!.id, clip })),
    [props.targets, props.clips, props.idea]
  );
  const clips = useMemo(() => targets.map((target) => target.clip), [targets]);
  const { t } = useTranslation();
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(randomTagColor);
  const clipsKey = clips.map((clip) => clip.id).join("|");

  useEffect(() => {
    setNewTagLabel("");
    setNewTagColor(randomTagColor());
  }, [clipsKey]);

  const tagState = useCallback(
    (key: string): TagState => {
      if (clips.length === 0) return "none";
      const count = clips.filter((clip) => (clip.tags ?? []).includes(key)).length;
      return count === 0 ? "none" : count === clips.length ? "all" : "some";
    },
    [clips]
  );

  const applyToAll = useCallback(
    (key: string) => {
      targets.forEach(({ ideaId, clip }) => {
        const current = clip.tags ?? [];
        if (!current.includes(key)) {
          useStore.getState().setClipTags(ideaId, clip.id, [...current, key]);
        }
      });
    },
    [targets]
  );

  const toggleTag = useCallback(
    (key: string) => {
      if (targets.length === 0) return;
      const removing = tagState(key) === "all";
      targets.forEach(({ ideaId, clip }) => {
        const current = clip.tags ?? [];
        const has = current.includes(key);
        if (removing && has) {
          useStore.getState().setClipTags(ideaId, clip.id, current.filter((k) => k !== key));
        } else if (!removing && !has) {
          useStore.getState().setClipTags(ideaId, clip.id, [...current, key]);
        }
      });
    },
    [targets, tagState]
  );

  const addCustomTag = useCallback(() => {
    const label = newTagLabel.trim();
    if (!label || clips.length === 0) return;
    const key = label.toLowerCase().replace(/\s+/g, "-");

    const alreadyExists =
      SONG_CLIP_TAG_OPTIONS.some((t) => t.key === key) ||
      idea?.customTags?.some((t) => t.key === key) ||
      globalCustomTags.some((t) => t.key === key);

    if (alreadyExists) {
      applyToAll(key);
      setNewTagLabel("");
      return;
    }

    if (idea) {
      useStore.getState().addProjectCustomTag(idea.id, { key, label, color: newTagColor });
    } else {
      useStore.getState().addGlobalCustomClipTag({ key, label, color: newTagColor });
    }
    haptic.tap();
    applyToAll(key);
    setNewTagLabel("");
    setNewTagColor(randomTagColor());
  }, [newTagLabel, newTagColor, clips.length, idea, globalCustomTags, applyToAll]);

  const projectCustomTags = idea?.customTags ?? [];
  // Bookmarked lives with the tags (2026-10-15): both are marks you put on a
  // take. On when every target carries it; flipping it sets them all alike.
  const allBookmarked = clips.length > 0 && clips.every((clip) => !!clip.isBookmarked);
  const setBookmarked = (next: boolean) => {
    targets.forEach(({ ideaId, clip }) => {
      if (!!clip.isBookmarked !== next) useStore.getState().toggleClipBookmark(ideaId, clip.id);
    });
  };

  if (clips.length === 0) return null;

  // Editorial ink (multi-select): the tag's own colour in its dot. Filled =
  // every take has it, a centre point = some do, hollow = none.
  const renderInk = (key: string, label: string, color: TagColor) => {
    const state = tagState(key);
    return (
      <Press
        key={key}
        // haptics.ts: light → a small state flip.
        haptic="light"
        feel="glyph"
        style={inkStyles.option}
        onPress={() => toggleTag(key)}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: state === "all" ? true : state === "some" ? "mixed" : false }}
        accessibilityLabel={label}
      >
        <View
          style={[
            inkStyles.dot,
            { borderColor: color.text },
            state === "all" ? { backgroundColor: color.text } : null,
          ]}
        >
          {state === "some" ? <View style={[inkStyles.dotMid, { backgroundColor: color.text }]} /> : null}
        </View>
        <Text style={[inkStyles.label, state !== "none" ? inkStyles.labelOn : null]}>{label}</Text>
      </Press>
    );
  };

  return (
    <>
      {showBookmark ? (
      <View style={inkStyles.bookmarkRow}>
        <Ionicons name={allBookmarked ? "bookmark" : "bookmark-outline"} size={18} color={allBookmarked ? colors.primary : colors.textStrong} />
        <Text style={inkStyles.bookmarkLabel}>{t("songDetail.bookmarked")}</Text>
        <Switch value={allBookmarked} onValueChange={setBookmarked} accessibilityLabel={t("songDetail.bookmarked")} />
      </View>
      ) : null}
      {/* The sheet is titled Tags; the built-in ones need no second label. */}
      <View style={[inkStyles.wrap, inkStyles.wrapFirst]}>
        {SONG_CLIP_TAG_OPTIONS.map((tag) =>
          renderInk(tag.key, t(`clipTags.${tag.key}`, { defaultValue: tag.label }), { bg: tag.bg, text: tag.text })
        )}
      </View>

      {projectCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>{t("songDetail.projectTags")}</Text>
          <View style={inkStyles.wrap}>
            {projectCustomTags.map((tag) =>
              renderInk(tag.key, tag.label, getTagColor(tag.key, projectCustomTags, globalCustomTags))
            )}
          </View>
        </>
      ) : null}

      {globalCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>{t("songDetail.globalTags")}</Text>
          <View style={inkStyles.wrap}>
            {globalCustomTags.map((tag) =>
              renderInk(tag.key, tag.label, getTagColor(tag.key, projectCustomTags, globalCustomTags))
            )}
          </View>
        </>
      ) : null}

      <Text style={[styles.tagPickerSectionLabel, { marginTop: 14 }]}>
        {idea ? t("songDetail.addProjectTag") : t("songDetail.addGlobalTag")}
      </Text>
      <View style={styles.tagPickerAddRow}>
        <UserTextInput
          style={styles.tagPickerAddInput}
          placeholder={t("songDetail.tagName")}
          placeholderTextColor={colors.textMuted}
          value={newTagLabel}
          onChangeText={setNewTagLabel}
          onSubmitEditing={addCustomTag}
          returnKeyType="done"
        />
        <Button
          label={t("songDetail.addTag")}
          variant="primary"
          onPress={addCustomTag}
          disabled={!newTagLabel.trim()}
        />
      </View>
      <View style={styles.tagPickerColorRow}>
        {CUSTOM_TAG_COLOR_OPTIONS.map((option) => (
          <Press
            key={option.bg}
            // haptics.ts: tap → a control changed value.
            haptic="tap"
            feel="glyph"
            style={[
              styles.tagPickerColorSwatch,
              { backgroundColor: option.bg },
              newTagColor === option.bg ? styles.tagPickerColorSwatchActive : null,
            ]}
            onPress={() => setNewTagColor(option.bg)}
            accessibilityRole="radio"
            accessibilityState={{ selected: newTagColor === option.bg }}
          />
        ))}
      </View>
    </>
  );
}

export function ClipTagPicker({
  visible,
  clips,
  idea,
  globalCustomTags,
  onClose,
}: ClipTagPickerProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose} dismissDistance={420} keyboardAvoiding>
      <View style={styles.tagPickerContent}>
        {/* Named like every sheet: what it acts on. */}
        <View style={inkStyles.titleRow}>
          <Text style={inkStyles.title}>{t("selection.tagClips")}</Text>
          <Text style={inkStyles.titleContext} numberOfLines={1}>
            {clips.length === 1 ? clips[0]!.title : t("brand.takeCount", { count: clips.length })}
          </Text>
        </View>
        <ClipTagEditorFields clips={clips} idea={idea} globalCustomTags={globalCustomTags} showBookmark />
      </View>
    </BottomSheet>
  );
}

const inkStyles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  titleContext: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
  },
  bookmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
    marginBottom: spacing.xs,
  },
  bookmarkLabel: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 16,
    color: colors.textPrimary,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 20,
    rowGap: 10,
    marginBottom: spacing.xs,
  },
  wrapFirst: {
    marginTop: spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 30,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dotMid: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
  },
  labelOn: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
});
