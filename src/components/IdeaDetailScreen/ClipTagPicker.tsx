import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "./styles";
import { useStore } from "../../state/useStore";
import type { ClipVersion, CustomTagDefinition, SongIdea } from "../../types";
import { BottomSheet } from "../common/BottomSheet";
import {
  SONG_CLIP_TAG_OPTIONS,
  CUSTOM_TAG_COLOR_OPTIONS,
  getTagColor,
} from "./songClipControls";

const randomTagColor = () =>
  CUSTOM_TAG_COLOR_OPTIONS[Math.floor(Math.random() * CUSTOM_TAG_COLOR_OPTIONS.length)].bg;

type ClipTagPickerProps = {
  visible: boolean;
  clip: ClipVersion | null;
  idea: SongIdea;
  globalCustomTags: CustomTagDefinition[];
  onClose: () => void;
};

type ClipTagEditorFieldsProps = {
  clip: ClipVersion | null;
  idea: SongIdea;
  globalCustomTags: CustomTagDefinition[];
};

export function ClipTagEditorFields({
  clip,
  idea,
  globalCustomTags,
}: ClipTagEditorFieldsProps) {
  const [newTagLabel, setNewTagLabel] = useState("");
  // Pre-pick a random color so adding a tag is one step (type + add); the swatch
  // row below lets the user override it before adding if they care.
  const [newTagColor, setNewTagColor] = useState(randomTagColor);

  const activeTags = useMemo(() => new Set(clip?.tags ?? []), [clip?.tags]);

  useEffect(() => {
    setNewTagLabel("");
    setNewTagColor(randomTagColor());
  }, [clip?.id]);

  const toggleTag = useCallback(
    (tagKey: string) => {
      if (!clip) return;
      void Haptics.selectionAsync();
      const current = clip.tags ?? [];
      const next = current.includes(tagKey)
        ? current.filter((k) => k !== tagKey)
        : [...current, tagKey];
      useStore.getState().setClipTags(idea.id, clip.id, next);
    },
    [clip, idea.id]
  );

  const addCustomTag = useCallback(() => {
    const label = newTagLabel.trim();
    if (!label || !clip) return;
    const key = label.toLowerCase().replace(/\s+/g, "-");

    const alreadyExists =
      SONG_CLIP_TAG_OPTIONS.some((t) => t.key === key) ||
      idea.customTags?.some((t) => t.key === key) ||
      globalCustomTags.some((t) => t.key === key);

    if (alreadyExists) {
      if (!activeTags.has(key)) toggleTag(key);
      setNewTagLabel("");
      return;
    }

    useStore.getState().addProjectCustomTag(idea.id, { key, label, color: newTagColor });
    void Haptics.selectionAsync();

    const current = clip.tags ?? [];
    if (!current.includes(key)) {
      useStore.getState().setClipTags(idea.id, clip.id, [...current, key]);
    }
    setNewTagLabel("");
    setNewTagColor(randomTagColor());
  }, [newTagLabel, newTagColor, clip, idea.id, idea.customTags, globalCustomTags, activeTags, toggleTag]);

  const projectCustomTags = idea.customTags ?? [];

  if (!clip) return null;

  return (
    <>
      <Text style={styles.tagPickerSectionLabel}>Tags</Text>
      <View style={styles.tagPickerChipsWrap}>
        {SONG_CLIP_TAG_OPTIONS.map((tag) => {
          const active = activeTags.has(tag.key);
          return (
            <Pressable
              key={tag.key}
              style={[
                styles.tagPickerChip,
                active
                  ? { backgroundColor: tag.bg, borderColor: tag.bg }
                  : { backgroundColor: "transparent", borderColor: tag.text },
              ]}
              onPress={() => toggleTag(tag.key)}
            >
              <Text style={[styles.tagPickerChipText, { color: tag.text }]}>
                {tag.label}
              </Text>
              {active ? (
                <Ionicons name="checkmark" size={12} color={tag.text} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {projectCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>Project tags</Text>
          <View style={styles.tagPickerChipsWrap}>
            {projectCustomTags.map((tag) => {
              const active = activeTags.has(tag.key);
              const color = getTagColor(tag.key, projectCustomTags, globalCustomTags);
              return (
                <Pressable
                  key={tag.key}
                  style={[
                    styles.tagPickerChip,
                    active
                      ? { backgroundColor: color.bg, borderColor: color.bg }
                      : { backgroundColor: "transparent", borderColor: color.text },
                  ]}
                  onPress={() => toggleTag(tag.key)}
                >
                  <View style={[styles.tagPickerCustomDot, { backgroundColor: color.text }]} />
                  <Text style={[styles.tagPickerChipText, { color: color.text }]}>
                    {tag.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={12} color={color.text} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {globalCustomTags.length > 0 ? (
        <>
          <Text style={styles.tagPickerSectionLabel}>Global tags</Text>
          <View style={styles.tagPickerChipsWrap}>
            {globalCustomTags.map((tag) => {
              const active = activeTags.has(tag.key);
              const color = getTagColor(tag.key, projectCustomTags, globalCustomTags);
              return (
                <Pressable
                  key={tag.key}
                  style={[
                    styles.tagPickerChip,
                    active
                      ? { backgroundColor: color.bg, borderColor: color.bg }
                      : { backgroundColor: "transparent", borderColor: color.text },
                  ]}
                  onPress={() => toggleTag(tag.key)}
                >
                  <View style={[styles.tagPickerCustomDot, { backgroundColor: color.text }]} />
                  <Text style={[styles.tagPickerChipText, { color: color.text }]}>
                    {tag.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={12} color={color.text} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={[styles.tagPickerSectionLabel, { marginTop: 14 }]}>
        Add project tag
      </Text>
      <View style={styles.tagPickerAddRow}>
        <TextInput
          style={styles.tagPickerAddInput}
          placeholder="Tag name"
          placeholderTextColor="#a89994"
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
          <Ionicons name="add" size={16} color={newTagLabel.trim() ? "#1b1c1a" : "#a89994"} />
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
  clip,
  idea,
  globalCustomTags,
  onClose,
}: ClipTagPickerProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} dismissDistance={420} keyboardAvoiding>
      <View style={styles.tagPickerContent}>
        <ClipTagEditorFields clip={clip} idea={idea} globalCustomTags={globalCustomTags} />
      </View>
    </BottomSheet>
  );
}
