import React from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../../styles";
import { Button } from "../common/Button";
import { MiniProgress } from "../MiniProgress";
import { TitleInput } from "../common/TitleInput";
import { useStore } from "../../state/useStore";
import { fmtDuration, formatDate } from "../../utils";
import { type EvolutionListClipEntry, type TimelineClipEntry } from "../../clipGraph";
import { type SongIdea, type ClipVersion, type CustomTagDefinition } from "../../types";
import { type useInlinePlayer } from "../../hooks/useInlinePlayer";
import { getTagColor, getTagLabel } from "./songClipControls";

export type ClipCardEntry = TimelineClipEntry | EvolutionListClipEntry;

export type ClipCardSharedProps = {
  idea: SongIdea;
  displayPrimaryId: string | null;
  isEditMode: boolean;
  isDraftProject: boolean;
  isParentPicking: boolean;
  parentPickSourceIdSet: Set<string>;
  parentPickInvalidTargetIdSet: Set<string>;
  editingClipId: string | null;
  editingClipDraft: string;
  setEditingClipDraft: (value: string) => void;
  editingClipNotesDraft: string;
  setEditingClipNotesDraft: (value: string) => void;
  onBeginEditing: (clip: ClipVersion) => void;
  onSaveEditing: (clipId: string) => void;
  onCancelEditing: () => void;
  onOpenActions: (clip: ClipVersion) => void;
  onOpenNotesSheet?: (clip: ClipVersion) => void;
  onPickParentTarget: (clipId: string) => void;
  onOpenTagPicker?: (clip: ClipVersion) => void;
  globalCustomTags: CustomTagDefinition[];
  inlinePlayer: ReturnType<typeof useInlinePlayer>;
  getHighlightValue: (clipId: string) => Animated.Value | undefined;
};

type ClipCardProps = ClipCardSharedProps & {
  entry: ClipCardEntry;
};

function renderEvolutionGuide(entry: EvolutionListClipEntry) {
  if (!entry.indented) return null;

  return (
    <View style={styles.songDetailEvolutionGuideWrap}>
      <View
        style={[
          styles.songDetailEvolutionStem,
          !entry.continuesThreadBelow ? styles.songDetailEvolutionStemEnd : null,
        ]}
      />
      <View style={styles.songDetailEvolutionElbow}>
        <View style={styles.songDetailEvolutionDot} />
      </View>
    </View>
  );
}

export function ClipCard({
  entry,
  idea,
  displayPrimaryId,
  isEditMode,
  isDraftProject,
  isParentPicking,
  parentPickSourceIdSet,
  parentPickInvalidTargetIdSet,
  editingClipId,
  editingClipDraft,
  setEditingClipDraft,
  editingClipNotesDraft,
  setEditingClipNotesDraft,
  onBeginEditing,
  onSaveEditing,
  onCancelEditing,
  onOpenActions,
  onOpenNotesSheet,
  onPickParentTarget,
  onOpenTagPicker,
  globalCustomTags,
  inlinePlayer,
  getHighlightValue,
}: ClipCardProps) {
  const navigation = useNavigation();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const movingClipId = useStore((s) => s.movingClipId);
  const highlightValue = getHighlightValue(entry.clip.id);
  const { clip } = entry;
  const inlineTarget = inlinePlayer.inlineTarget;
  const inlineActive = inlineTarget?.ideaId === idea.id && inlineTarget.clipId === clip.id;
  const isSelected = selectedClipIds.includes(clip.id);
  const isMoving = movingClipId === clip.id;
  const isPrimaryCandidate = displayPrimaryId === clip.id;
  const compactDensity = entry.kind === "evolution" ? entry.compactPreview : false;
  const isParentPickSource = parentPickSourceIdSet.has(clip.id);
  const isInvalidParentTarget = isParentPicking && parentPickInvalidTargetIdSet.has(clip.id);
  const isValidParentTarget = isParentPicking && !isInvalidParentTarget;

  return (
    <View style={styles.threadRowWrap}>
      <View
        style={[
          styles.selectionIndicatorCol,
          clipSelectionMode ? null : styles.selectionIndicatorHidden,
        ]}
      >
        {clipSelectionMode ? (
          <View
            style={[
              styles.selectionIndicatorCircle,
              isSelected ? styles.selectionIndicatorActive : null,
            ]}
          >
            {isSelected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
          </View>
        ) : null}
      </View>
      {entry.kind === "evolution" ? renderEvolutionGuide(entry) : null}

      <View
        style={[
          styles.card,
          styles.cardFlex,
          styles.threadCard,
          styles.songDetailVersionCard,
          compactDensity ? styles.songDetailVersionCardCompact : null,
          isSelected || isMoving || isParentPickSource ? styles.cardSelected : null,
          isValidParentTarget ? styles.songDetailVersionCardParentTarget : null,
          isParentPicking && !isParentPickSource && isInvalidParentTarget
            ? styles.songDetailVersionCardParentTargetDisabled
            : null,
        ]}
      >
        <View style={styles.songDetailVersionRow}>
          <View
            style={[
              styles.songDetailVersionLead,
              inlineActive ? styles.songDetailVersionLeadInlineActive : null,
            ]}
          >
            {!clipSelectionMode && !isDraftProject && !isParentPicking ? (
              <Pressable
                onPress={(evt) => {
                  evt.stopPropagation();
                  void Haptics.selectionAsync();
                  if (!clip.audioUri) return;
                  void inlinePlayer.toggleInlinePlayback(idea.id, clip);
                }}
                onLongPress={() => {
                  onOpenActions(clip);
                }}
                style={({ pressed }) => [
                  styles.ideasInlinePlayBtn,
                  pressed ? styles.pressDown : null,
                ]}
              >
                <Ionicons
                  name={inlineActive && inlinePlayer.isInlinePlaying ? "pause" : "play"}
                  size={15}
                  color={!clip.audioUri ? "#9ca3af" : "#111827"}
                  style={inlineActive && inlinePlayer.isInlinePlaying ? undefined : { marginLeft: 2 }}
                />
              </Pressable>
            ) : (
              <View style={styles.ideasInlinePlayBtn}>
                <Ionicons name="play" size={15} color="#9ca3af" style={{ marginLeft: 2 }} />
              </View>
            )}
            <View style={styles.songDetailVersionLeadDurationSlot}>
              <Text style={styles.songDetailVersionLeadDurationText}>
                {clip.durationMs ? fmtDuration(clip.durationMs) : "0:00"}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.songDetailVersionMain}
            onLongPress={() => {
              if (isParentPicking) return;
              if (clipSelectionMode) {
                useStore.getState().toggleClipSelection(clip.id);
                return;
              }
              onOpenActions(clip);
            }}
            onPress={async () => {
              if (isDraftProject) return;
              if (isParentPicking) {
                if (isInvalidParentTarget) return;
                onPickParentTarget(clip.id);
                return;
              }
              if (clipSelectionMode) {
                useStore.getState().toggleClipSelection(clip.id);
                return;
              }
              if (isEditMode) {
                onBeginEditing(clip);
                return;
              }
              if (clip.audioUri) {
                await inlinePlayer.resetInlinePlayer();
                useStore.getState().setPlayerQueue([{ ideaId: idea.id, clipId: clip.id }], 0, true);
                navigation.navigate("Player" as never);
              }
            }}
            delayLongPress={250}
          >
            {highlightValue ? (
              <Animated.View
                style={[styles.cardHighlightOverlay, { opacity: highlightValue }]}
                pointerEvents="none"
              />
            ) : null}

            {editingClipId === clip.id ? (
              <View style={styles.inputRow}>
                <TitleInput
                  value={editingClipDraft}
                  onChangeText={setEditingClipDraft}
                  placeholder="Clip title"
                  containerStyle={{ marginHorizontal: 0, marginBottom: 8 }}
                />
                <TextInput
                  style={styles.notesInput}
                  multiline
                  placeholder="Clip notes"
                  value={editingClipNotesDraft}
                  onChangeText={setEditingClipNotesDraft}
                />
                <Button variant="secondary" label="Save" onPress={() => onSaveEditing(clip.id)} />
                <Button variant="secondary" label="Cancel" onPress={onCancelEditing} />
              </View>
            ) : (
              <>
                <View style={styles.songDetailVersionTopRow}>
                  <View style={styles.songDetailVersionTitleRow}>
                    <Text style={styles.songDetailVersionTitle} numberOfLines={2}>
                      {clip.title}
                    </Text>
                  </View>

                  <View style={styles.songDetailVersionTrailing}>
                    {isParentPickSource ? (
                      <Text style={styles.badge}>SOURCE</Text>
                    ) : isEditMode ? (
                      isPrimaryCandidate ? (
                        <Text style={styles.badge}>PRIMARY</Text>
                      ) : (
                        <Pressable
                          style={styles.songDetailVersionSetPrimaryBtn}
                          onPress={() => useStore.getState().setPendingPrimaryClipId(clip.id)}
                        >
                          <Text style={styles.songDetailVersionSetPrimaryText}>Primary</Text>
                        </Pressable>
                      )
                    ) : clip.isPrimary ? (
                      <Text style={styles.badge}>PRIMARY</Text>
                    ) : null}

                    {!clipSelectionMode && !isEditMode && !isDraftProject && !isParentPicking ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.songDetailVersionReplyBtn,
                          compactDensity ? styles.songDetailVersionReplyBtnCompact : null,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={async (evt) => {
                          evt.stopPropagation();
                          await inlinePlayer.resetInlinePlayer();
                          useStore.getState().setRecordingParentClipId(clip.id);
                          useStore.getState().setRecordingIdeaId(idea.id);
                          navigation.navigate("Recording" as never);
                        }}
                      >
                        <Ionicons
                          name="return-up-forward-outline"
                          size={14}
                          color="#475569"
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {clip.notes?.trim() ? (
                  <Pressable
                    style={styles.clipCardNotesPreview}
                    onPress={() => onOpenNotesSheet?.(clip)}
                    hitSlop={{ top: 4, bottom: 4 }}
                  >
                    <Ionicons name="document-text-outline" size={11} color="#94a3b8" />
                    <Text style={styles.clipCardNotesPreviewText} numberOfLines={1}>
                      {clip.notes.trim()}
                    </Text>
                  </Pressable>
                ) : null}

                {clip.tags?.length || (!isEditMode && !isDraftProject && !isParentPicking && !clipSelectionMode) ? (
                  <Pressable
                    style={styles.clipCardTagsRow}
                    onPress={(evt) => {
                      evt.stopPropagation();
                      onOpenTagPicker?.(clip);
                    }}
                    hitSlop={{ top: 2, bottom: 2 }}
                  >
                    {clip.tags?.map((tagKey) => {
                      const color = getTagColor(tagKey, idea.customTags, globalCustomTags);
                      const label = getTagLabel(tagKey, idea.customTags, globalCustomTags);
                      return (
                        <View key={tagKey} style={[styles.clipCardTagBadge, { backgroundColor: color.bg }]}>
                          <Text style={[styles.clipCardTagBadgeText, { color: color.text }]}>{label}</Text>
                        </View>
                      );
                    })}
                    {!isEditMode && !isDraftProject && !isParentPicking && !clipSelectionMode ? (
                      <View style={styles.clipCardAddTagBtn}>
                        <Ionicons name="add" size={11} color="#94a3b8" />
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}

                <Text style={styles.songDetailVersionMeta}>{formatDate(clip.createdAt)}</Text>
              </>
            )}

            {inlineActive ? (
              <View style={styles.songDetailVersionInlinePlayerWrap}>
                <View style={styles.songDetailVersionInlinePlayerProgress}>
                  <MiniProgress
                    currentMs={inlinePlayer.inlinePosition}
                    durationMs={inlinePlayer.inlineDuration || clip.durationMs || 0}
                    onSeek={(ms) => {
                      void inlinePlayer.endInlineScrub(ms);
                    }}
                    onSeekStart={() => {
                      void inlinePlayer.beginInlineScrub();
                    }}
                    onSeekCancel={() => {
                      void inlinePlayer.cancelInlineScrub();
                    }}
                  />
                </View>
                <Pressable
                  style={styles.ideasInlineCloseBtn}
                  onPress={(evt) => {
                    evt.stopPropagation();
                    void inlinePlayer.resetInlinePlayer();
                  }}
                >
                  <Ionicons name="close" size={13} color="#64748b" />
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
