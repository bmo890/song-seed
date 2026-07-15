import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";
import { useStore } from "../../state/useStore";
import type { ClipVersion, CustomTagDefinition, SongIdea } from "../../types";
import { BottomSheet } from "../common/BottomSheet";
import { haptic } from "../../design/haptics";
import {
  SONG_CLIP_TAG_OPTIONS,
  CUSTOM_TAG_COLOR_OPTIONS,
  getTagColor,
  type TagColor,
} from "./songClipControls";
import { colors } from "../../design/tokens";

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

type ClipTagEditorFieldsProps = {
  clips: ClipVersion[];
  idea: SongIdea;
  globalCustomTags: CustomTagDefinition[];
};

/** Edits tags across one or more clips. With multiple, a chip is "all" (every
 * clip has it), "some", or "none"; tapping applies to all, or removes from all
 * when every clip already has it. */
export function ClipTagEditorFields({
  clips,
  idea,
  globalCustomTags,
}: ClipTagEditorFieldsProps) {
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
      clips.forEach((clip) => {
        const current = clip.tags ?? [];
        if (!current.includes(key)) {
          useStore.getState().setClipTags(idea.id, clip.id, [...current, key]);
        }
      });
    },
    [clips, idea.id]
  );

  const toggleTag = useCallback(
    (key: string) => {
      if (clips.length === 0) return;
      haptic.tap();
      const removing = tagState(key) === "all";
      clips.forEach((clip) => {
        const current = clip.tags ?? [];
        const has = current.includes(key);
        if (removing && has) {
          useStore.getState().setClipTags(idea.id, clip.id, current.filter((k) => k !== key));
        } else if (!removing && !has) {
          useStore.getState().setClipTags(idea.id, clip.id, [...current, key]);
        }
      });
    },
    [clips, idea.id, tagState]
  );

  const addCustomTag = useCallback(() => {
    const label = newTagLabel.trim();
    if (!label || clips.length === 0) return;
    const key = label.toLowerCase().replace(/\s+/g, "-");

    const alreadyExists =
      SONG_CLIP_TAG_OPTIONS.some((t) => t.key === key) ||
      idea.customTags?.some((t) => t.key === key) ||
      globalCustomTags.some((t) => t.key === key);

    if (alreadyExists) {
      applyToAll(key);
      setNewTagLabel("");
      return;
    }

    useStore.getState().addProjectCustomTag(idea.id, { key, label, color: newTagColor });
    haptic.tap();
    applyToAll(key);
    setNewTagLabel("");
    setNewTagColor(randomTagColor());
  }, [newTagLabel, newTagColor, clips.length, idea.id, idea.customTags, globalCustomTags, applyToAll]);

  const projectCustomTags = idea.customTags ?? [];

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
      <Text style={styles.tagPickerSectionLabel}>Tags</Text>
      <View style={styles.tagPickerChipsWrap}>
        {SONG_CLIP_TAG_OPTIONS.map((tag) =>
          renderChip(tag.key, tag.label, { bg: tag.bg, text: tag.text }, false)
        )}
      </View>

      {projectCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>Project tags</Text>
          <View style={styles.tagPickerChipsWrap}>
            {projectCustomTags.map((tag) =>
              renderChip(tag.key, tag.label, getTagColor(tag.key, projectCustomTags, globalCustomTags), true)
            )}
          </View>
        </>
      ) : null}

      {globalCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>Global tags</Text>
          <View style={styles.tagPickerChipsWrap}>
            {globalCustomTags.map((tag) =>
              renderChip(tag.key, tag.label, getTagColor(tag.key, projectCustomTags, globalCustomTags), true)
            )}
          </View>
        </>
      ) : null}

      <Text style={[styles.tagPickerSectionLabel, { marginTop: 14 }]}>Add project tag</Text>
      <View style={styles.tagPickerAddRow}>
        <TextInput
          style={styles.tagPickerAddInput}
          placeholder="Tag name"
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
