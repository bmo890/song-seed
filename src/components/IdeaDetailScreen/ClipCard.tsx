import React from "react";
import { Alert, Animated, Pressable, View, type GestureResponderEvent } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { styles } from "./styles";
import { appActions } from "../../state/actions";
import { useStore } from "../../state/useStore";
import { getClipOverdubStemCount, getClipPlaybackDurationMs, hasClipPlaybackSource } from "../../clipPresentation";
import { fmtDuration, formatDate } from "../../utils";
import { type EvolutionListClipEntry, type TimelineClipEntry } from "../../clipGraph";
import { type SongIdea, type ClipVersion, type CustomTagDefinition } from "../../types";
import { type useInlinePlayer } from "../../hooks/useInlinePlayer";
import { getTagColor, getTagLabel } from "./songClipControls";
import { ClipCardEditForm } from "./components/clipCard/ClipCardEditForm";
import { ClipCardEvolutionGuide } from "./components/clipCard/ClipCardEvolutionGuide";
import { ClipCardInlinePlayer } from "./components/clipCard/ClipCardInlinePlayer";
import { ClipCardLead } from "./components/clipCard/ClipCardLead";
import { ClipCardOverdubButton } from "./components/clipCard/ClipCardOverdubButton";
import { ClipCardPrimaryIndicator } from "./components/clipCard/ClipCardPrimaryIndicator";
import { ClipCardReplyButton } from "./components/clipCard/ClipCardReplyButton";
import { ClipCardSelectionRail } from "./components/clipCard/ClipCardSelectionRail";
import { ClipCardStaticBody } from "./components/clipCard/ClipCardStaticBody";

export type ClipCardEntry = TimelineClipEntry | EvolutionListClipEntry;

export type ClipCardModeProps = {
  idea: SongIdea;
  displayPrimaryId: string | null;
  isEditMode: boolean;
  isDraftProject: boolean;
  isParentPicking: boolean;
  parentPickSourceIdSet: Set<string>;
  parentPickInvalidTargetIdSet: Set<string>;
};

export type ClipCardEditingProps = {
  editingClipId: string | null;
  editingClipDraft: string;
  setEditingClipDraft: (value: string) => void;
  editingClipNotesDraft: string;
  setEditingClipNotesDraft: (value: string) => void;
  onBeginEditing: (clip: ClipVersion) => void;
  onSaveEditing: (clipId: string) => void;
  onCancelEditing: () => void;
};

export type ClipCardActionProps = {
  onOpenActions: (clip: ClipVersion) => void;
  longPressBehavior?: "select" | "actions";
  onOpenNotesSheet?: (clip: ClipVersion) => void;
  onPickParentTarget: (clipId: string) => void;
  onOpenTagPicker?: (clip: ClipVersion) => void;
};

export type ClipCardPlaybackProps = {
  globalCustomTags: CustomTagDefinition[];
  inlinePlayer: ReturnType<typeof useInlinePlayer>;
  getHighlightValue: (clipId: string) => Animated.Value | undefined;
};

export type ClipCardContextProps = {
  mode: ClipCardModeProps;
  editing: ClipCardEditingProps;
  actions: ClipCardActionProps;
  playback: ClipCardPlaybackProps;
};

type ClipCardProps = {
  entry: ClipCardEntry;
  context: ClipCardContextProps;
  displayOnly?: boolean;
};

export function ClipCard({
  entry,
  context,
  displayOnly,
}: ClipCardProps) {
  const {
    mode: {
      idea,
      displayPrimaryId,
      isEditMode,
      isDraftProject,
      isParentPicking,
      parentPickSourceIdSet,
      parentPickInvalidTargetIdSet,
    },
    editing: {
      editingClipId,
      editingClipDraft,
      setEditingClipDraft,
      editingClipNotesDraft,
      setEditingClipNotesDraft,
      onBeginEditing,
      onSaveEditing,
      onCancelEditing,
    },
    actions: {
      onOpenActions,
      longPressBehavior = "select",
      onOpenNotesSheet,
      onPickParentTarget,
      onOpenTagPicker,
    },
    playback: { globalCustomTags, inlinePlayer, getHighlightValue },
  } = context;

  const navigation = useNavigation();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const movingClipId = useStore((s) => s.movingClipId);
  const startClipSelection = useStore((s) => s.startClipSelection);
  const toggleClipSelection = useStore((s) => s.toggleClipSelection);
  const setPendingPrimaryClipId = useStore((s) => s.setPendingPrimaryClipId);
  const setRecordingParentClipId = useStore((s) => s.setRecordingParentClipId);
  const setRecordingIdeaId = useStore((s) => s.setRecordingIdeaId);
  const setPlayerQueue = useStore((s) => s.setPlayerQueue);
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
  const tagBadges = (clip.tags ?? []).map((tagKey) => {
    const color = getTagColor(tagKey, idea.customTags, globalCustomTags);
    const label = getTagLabel(tagKey, idea.customTags, globalCustomTags);
    return {
      key: tagKey,
      label,
      backgroundColor: color.bg,
      textColor: color.text,
    };
  });
  const canEditTags =
    !displayOnly && !isEditMode && !isDraftProject && !isParentPicking && !clipSelectionMode;
  const playbackDurationMs = getClipPlaybackDurationMs(clip);
  const overdubStemCount = getClipOverdubStemCount(clip);
  const durationLabel = playbackDurationMs ? fmtDuration(playbackDurationMs) : "0:00";
  const createdAtLabel =
    overdubStemCount > 0
      ? `${formatDate(clip.createdAt)} • ${overdubStemCount} ${overdubStemCount === 1 ? "layer" : "layers"}`
      : formatDate(clip.createdAt);
  const canToggleInlinePlayback = !clipSelectionMode && !isDraftProject && !isParentPicking;
  const canShowReplyButton =
    !displayOnly && !clipSelectionMode && !isEditMode && !isDraftProject && !isParentPicking;
  const canShowOverdubButton =
    !displayOnly &&
    !clipSelectionMode &&
    !isEditMode &&
    !isDraftProject &&
    !isParentPicking &&
    hasClipPlaybackSource(clip);

  const openPlayer = async () => {
    if (!hasClipPlaybackSource(clip)) return;
    await inlinePlayer.resetInlinePlayer();
    setPlayerQueue([{ ideaId: idea.id, clipId: clip.id }], 0, true);
    navigation.navigate("Player" as never);
  };

  const beginActions = () => {
    onOpenActions(clip);
  };
  const beginSelection = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startClipSelection(clip.id);
  };
  const handleSetPrimary = () => {
    setPendingPrimaryClipId(clip.id);
  };
  const handleReply = async () => {
    await inlinePlayer.resetInlinePlayer();
    setRecordingParentClipId(clip.id);
    setRecordingIdeaId(idea.id);
    navigation.navigate("Recording" as never);
  };
  const handleOverdub = async () => {
    await inlinePlayer.resetInlinePlayer();
    try {
      appActions.startClipOverdubRecording(idea.id, clip.id);
      navigation.navigate("Recording" as never);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start overdub recording.";
      Alert.alert("Overdub unavailable", message);
    }
  };
  const handleLongPress = () => {
    if (displayOnly || isParentPicking) return;
    if (clipSelectionMode) {
      toggleClipSelection(clip.id);
      return;
    }
    if (longPressBehavior === "actions") {
      beginActions();
      return;
    }
    beginSelection();
  };
  const handlePress = async () => {
    if (displayOnly) {
      await openPlayer();
      return;
    }
    if (isDraftProject) return;
    if (isParentPicking) {
      if (isInvalidParentTarget) return;
      onPickParentTarget(clip.id);
      return;
    }
    if (clipSelectionMode) {
      toggleClipSelection(clip.id);
      return;
    }
    if (isEditMode) {
      onBeginEditing(clip);
      return;
    }
    await openPlayer();
  };
  const handleTagsPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (onOpenTagPicker) {
      onOpenTagPicker(clip);
      return;
    }
    onOpenNotesSheet?.(clip);
  };

  return (
    <View style={styles.threadRowWrap}>
      {!displayOnly ? (
        <ClipCardSelectionRail visible={clipSelectionMode} selected={isSelected} />
      ) : null}
      <ClipCardEvolutionGuide entry={entry.kind === "evolution" ? entry : null} />

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
          <ClipCardLead
            durationLabel={durationLabel}
            inlineActive={inlineActive}
            inlinePlaying={inlinePlayer.isInlinePlaying}
            canToggleInlinePlayback={canToggleInlinePlayback}
            canPlay={hasClipPlaybackSource(clip)}
            onPressPlay={() => inlinePlayer.toggleInlinePlayback(idea.id, clip)}
            onLongPress={displayOnly ? undefined : handleLongPress}
          />

          <Pressable
            style={styles.songDetailVersionMain}
            onLongPress={displayOnly ? undefined : handleLongPress}
            onPress={handlePress}
            delayLongPress={250}
          >
            {highlightValue ? (
              <Animated.View
                style={[styles.cardHighlightOverlay, { opacity: highlightValue }]}
                pointerEvents="none"
              />
            ) : null}

            {!displayOnly && editingClipId === clip.id ? (
              <ClipCardEditForm
                titleDraft={editingClipDraft}
                notesDraft={editingClipNotesDraft}
                onChangeTitle={setEditingClipDraft}
                onChangeNotes={setEditingClipNotesDraft}
                onSave={() => onSaveEditing(clip.id)}
                onCancel={onCancelEditing}
              />
            ) : (
              <ClipCardStaticBody
                title={clip.title}
                trailing={
                  <>
                    <ClipCardPrimaryIndicator
                      displayOnly={displayOnly}
                      isParentPickSource={isParentPickSource}
                      isEditMode={isEditMode}
                      isPrimaryCandidate={isPrimaryCandidate}
                      isPrimary={clip.isPrimary}
                      onSetPrimary={handleSetPrimary}
                    />
                    <ClipCardReplyButton
                      visible={canShowReplyButton}
                      compact={compactDensity}
                      onPress={handleReply}
                    />
                    <ClipCardOverdubButton
                      visible={canShowOverdubButton}
                      compact={compactDensity}
                      onPress={handleOverdub}
                    />
                  </>
                }
                notes={clip.notes ?? ""}
                disabled={!!displayOnly}
                onPressNotes={displayOnly ? undefined : () => onOpenNotesSheet?.(clip)}
                tags={tagBadges}
                canEditTags={canEditTags}
                onPressTags={displayOnly ? undefined : handleTagsPress}
                createdAtLabel={createdAtLabel}
              />
            )}

            {inlineActive && !displayOnly ? (
              <ClipCardInlinePlayer
                currentMs={inlinePlayer.inlinePosition}
                durationMs={inlinePlayer.inlineDuration || playbackDurationMs || 0}
                onSeek={(ms) => {
                  void inlinePlayer.endInlineScrub(ms);
                }}
                onSeekStart={() => {
                  void inlinePlayer.beginInlineScrub();
                }}
                onSeekCancel={() => {
                  void inlinePlayer.cancelInlineScrub();
                }}
                onClose={() => {
                  void inlinePlayer.resetInlinePlayer();
                }}
              />
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
