import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
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
import { colors } from "../../../design/tokens";
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
  const { globalCustomTags } = props;
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
      haptic.tap();
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

  if (clips.length === 0) return null;

  const renderChip = (key: string, label: string, color: TagColor, withDot: boolean) => {
    const state = tagState(key);
    const active = state !== "none";
    return (
      <Pressable
        key={key}
        style={[
          styles.tagPickerChip,
          active
            ? { backgroundColor: color.bg, borderColor: color.bg }
            : { backgroundColor: "transparent", borderColor: color.text },
        ]}
        onPress={() => toggleTag(key)}
      >
        {withDot ? <View style={[styles.tagPickerCustomDot, { backgroundColor: color.text }]} /> : null}
        <Text style={[styles.tagPickerChipText, { color: color.text }]}>{label}</Text>
        {state === "all" ? (
          <Ionicons name="checkmark" size={12} color={color.text} />
        ) : state === "some" ? (
          <Ionicons name="remove" size={12} color={color.text} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <>
      <Text style={styles.tagPickerSectionLabel}>{t("songDetail.tags")}</Text>
      <View style={styles.tagPickerChipsWrap}>
        {SONG_CLIP_TAG_OPTIONS.map((tag) =>
          renderChip(
            tag.key,
            t(`clipTags.${tag.key}`, { defaultValue: tag.label }),
            { bg: tag.bg, text: tag.text },
            false
          )
        )}
      </View>

      {projectCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>{t("songDetail.projectTags")}</Text>
          <View style={styles.tagPickerChipsWrap}>
            {projectCustomTags.map((tag) =>
              renderChip(tag.key, tag.label, getTagColor(tag.key, projectCustomTags, globalCustomTags), true)
            )}
          </View>
        </>
      ) : null}

      {globalCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>{t("songDetail.globalTags")}</Text>
          <View style={styles.tagPickerChipsWrap}>
            {globalCustomTags.map((tag) =>
              renderChip(tag.key, tag.label, getTagColor(tag.key, projectCustomTags, globalCustomTags), true)
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
        <Pressable
          style={({ pressed }) => [
            styles.tagPickerAddBtn,
            !newTagLabel.trim() ? styles.tagPickerAddBtnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={addCustomTag}
          disabled={!newTagLabel.trim()}
        >
          <Ionicons name="add" size={16} color={newTagLabel.trim() ? colors.textPrimary : colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.tagPickerColorRow}>
        {CUSTOM_TAG_COLOR_OPTIONS.map((option) => (
          <Pressable
            key={option.bg}
            style={[
              styles.tagPickerColorSwatch,
              { backgroundColor: option.bg },
              newTagColor === option.bg ? styles.tagPickerColorSwatchActive : null,
            ]}
            onPress={() => setNewTagColor(option.bg)}
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
  return (
    <BottomSheet visible={visible} onClose={onClose} dismissDistance={420} keyboardAvoiding>
      <View style={styles.tagPickerContent}>
        {clips.length > 1 ? (
          <Text style={styles.tagPickerSectionLabel}>{`${clips.length} clips`}</Text>
        ) : null}
        <ClipTagEditorFields clips={clips} idea={idea} globalCustomTags={globalCustomTags} />
      </View>
    </BottomSheet>
  );
}
