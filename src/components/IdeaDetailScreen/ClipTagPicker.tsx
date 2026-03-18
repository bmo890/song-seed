import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import type { ClipVersion, CustomTagDefinition, SongIdea } from "../../types";
import {
  SONG_CLIP_TAG_OPTIONS,
  CUSTOM_TAG_COLOR_OPTIONS,
  getTagColor,
  getTagLabel,
} from "./songClipControls";

type ClipTagPickerProps = {
  visible: boolean;
  clip: ClipVersion | null;
  idea: SongIdea;
  globalCustomTags: CustomTagDefinition[];
  onClose: () => void;
};

export function ClipTagPicker({
  visible,
  clip,
  idea,
  globalCustomTags,
  onClose,
}: ClipTagPickerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(CUSTOM_TAG_COLOR_OPTIONS[0].bg);

  const activeTags = useMemo(() => new Set(clip?.tags ?? []), [clip?.tags]);

  useEffect(() => {
    if (!visible) return;
    isClosingRef.current = false;
    setNewTagLabel("");
    translateY.setValue(32);
    Animated.spring(translateY, {
      toValue: 0,
      damping: 20,
      stiffness: 220,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  const closeWithSlide = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: 420,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isClosingRef.current = false;
        return;
      }
      onClose();
    });
  }, [onClose, translateY]);

  const snapBack = useCallback(() => {
    isClosingRef.current = false;
    Animated.spring(translateY, {
      toValue: 0,
      damping: 20,
      stiffness: 240,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => {
          translateY.setValue(Math.max(0, gs.dy));
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy > 96 || gs.vy > 0.9) {
            closeWithSlide();
            return;
          }
          snapBack();
        },
        onPanResponderTerminate: () => snapBack(),
      }),
    [closeWithSlide, snapBack, translateY]
  );

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
      // Just toggle the existing tag on
      if (!activeTags.has(key)) toggleTag(key);
      setNewTagLabel("");
      return;
    }

    useStore.getState().addProjectCustomTag(idea.id, { key, label, color: newTagColor });
    void Haptics.selectionAsync();

    // Also assign it to the clip
    const current = clip.tags ?? [];
    if (!current.includes(key)) {
      useStore.getState().setClipTags(idea.id, clip.id, [...current, key]);
    }
    setNewTagLabel("");
  }, [newTagLabel, newTagColor, clip, idea.id, idea.customTags, globalCustomTags, activeTags, toggleTag]);

  const projectCustomTags = idea.customTags ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeWithSlide}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.bottomSheetBackdrop}>
          <Pressable style={styles.bottomSheetOverlay} onPress={closeWithSlide} />
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.modalCard,
              styles.bottomSheetCard,
              { paddingBottom: 14 + insets.bottom, transform: [{ translateY }] },
            ]}
          >
            <View style={styles.bottomSheetDragZone}>
              <View style={styles.bottomSheetHandle} />
            </View>

            <View style={styles.tagPickerContent}>
              <Text style={styles.tagPickerSectionLabel}>Tags</Text>
              <View style={styles.tagPickerChipsWrap}>
                {SONG_CLIP_TAG_OPTIONS.map((tag) => {
                  const active = activeTags.has(tag.key);
                  return (
                    <Pressable
                      key={tag.key}
                      style={[
                        styles.tagPickerChip,
                        { backgroundColor: active ? tag.bg : "#f1f5f9" },
                      ]}
                      onPress={() => toggleTag(tag.key)}
                    >
                      <Text
                        style={[
                          styles.tagPickerChipText,
                          { color: active ? tag.text : "#64748b" },
                        ]}
                      >
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
                            { backgroundColor: active ? color.bg : "#f1f5f9" },
                          ]}
                          onPress={() => toggleTag(tag.key)}
                        >
                          <View style={[styles.tagPickerCustomDot, { backgroundColor: color.text }]} />
                          <Text
                            style={[
                              styles.tagPickerChipText,
                              { color: active ? color.text : "#64748b" },
                            ]}
                          >
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
                            { backgroundColor: active ? color.bg : "#f1f5f9" },
                          ]}
                          onPress={() => toggleTag(tag.key)}
                        >
                          <View style={[styles.tagPickerCustomDot, { backgroundColor: color.text }]} />
                          <Text
                            style={[
                              styles.tagPickerChipText,
                              { color: active ? color.text : "#64748b" },
                            ]}
                          >
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
                  placeholderTextColor="#94a3b8"
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
                  <Ionicons name="add" size={16} color={newTagLabel.trim() ? "#0f172a" : "#94a3b8"} />
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
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
