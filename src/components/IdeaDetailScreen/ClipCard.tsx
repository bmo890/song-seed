import React from "react";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { styles } from "./styles";
import { useStore } from "../../state/useStore";
import { getClipOverdubStemCount, getClipPlaybackDurationMs, hasClipPlaybackSource } from "../../clipPresentation";
import { fmtDuration, formatClipCardDate } from "../../utils";
import { type EvolutionListClipEntry, type TimelineClipEntry } from "../../clipGraph";
import { type SongIdea, type ClipVersion, type CustomTagDefinition, type InlinePlayerControls } from "../../types";
import { getTagColor, getTagLabel } from "./songClipControls";
import { ClipCardEditForm } from "./components/clipCard/ClipCardEditForm";
import { ClipCardEvolutionGuide } from "./components/clipCard/ClipCardEvolutionGuide";
import { ClipCardInlinePlayer } from "./components/clipCard/ClipCardInlinePlayer";
import { ClipCardPrimaryIndicator } from "./components/clipCard/ClipCardPrimaryIndicator";
import { ClipCardReplyButton } from "./components/clipCard/ClipCardReplyButton";
import { ClipNotesPreview } from "../common/clip/ClipNotesPreview";
import { ClipTagBadges } from "../common/clip/ClipTagBadges";
import { IdeaCard } from "../common/IdeaCard";
import type { GestureResponderEvent } from "react-native";

export type ClipCardEntry = TimelineClipEntry | EvolutionListClipEntry;

function ClipCardInlinePlayerFromStore({
  inlinePlayer,
  fallbackDurationMs,
}: {
  inlinePlayer: InlinePlayerControls;
  fallbackDurationMs: number;
}) {
  const inlinePosition = useStore((s) => s.inlinePositionMs);
  const inlineDuration = useStore((s) => s.inlineDurationMs);

  return (
    <ClipCardInlinePlayer
      currentMs={inlinePosition}
      durationMs={inlineDuration || fallbackDurationMs}
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
  );
}

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
  onViewLineageHistory?: (rootClipId: string) => void;
  onLocateClip?: (clipId: string) => void;
};

export type ClipCardPlaybackProps = {
  globalCustomTags: CustomTagDefinition[];
  inlinePlayer: InlinePlayerControls;
  getHighlightValue: (clipId: string) => import("react-native").Animated.Value | null | undefined;
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
  displayPrimary?: boolean;
};

export function ClipCard({
  entry,
  context,
  displayOnly,
  displayPrimary,
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
      onViewLineageHistory,
      onLocateClip,
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
  const inlineTarget = useStore((s) => s.inlineTarget);
  const isInlinePlaying = useStore((s) => s.inlineIsPlaying);
  const highlightValue = getHighlightValue(entry.clip.id);
  const { clip } = entry;
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
  const visibleTagBadges = tagBadges;
  const showAddTagButton = canEditTags && tagBadges.length === 0;
  const playbackDurationMs = getClipPlaybackDurationMs(clip);
  const overdubStemCount = getClipOverdubStemCount(clip);
  const durationLabel = playbackDurationMs ? fmtDuration(playbackDurationMs) : "0:00";
  const createdAtLabel =
    overdubStemCount > 0
      ? `${formatClipCardDate(clip.createdAt)} • ${overdubStemCount} ${overdubStemCount === 1 ? "layer" : "layers"}`
      : formatClipCardDate(clip.createdAt);
  const canToggleInlinePlayback = !clipSelectionMode && !isDraftProject && !isParentPicking;
  const canShowTrailingAction =
    !displayOnly && !clipSelectionMode && !isEditMode && !isDraftProject && !isParentPicking;
  // Reply (record a new version) belongs only to the most recent take of a thread —
  // the Evolution head. Indented children are part of one thread, so no reply there.
  const showReplyButton =
    canShowTrailingAction && entry.kind === "evolution" && !entry.indented;
  // Timeline cards swap reply for a "jump to Evolution" locate action.
  const showLocateButton =
    canShowTrailingAction && entry.kind === "timeline" && !!onLocateClip;
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
    useStore.getState().requestPlayerClose();
    setRecordingParentClipId(clip.id);
    setRecordingIdeaId(idea.id);
    navigation.navigate("Recording" as never);
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

  // Compute container extra style for parent-picking visual states
  const parentPickContainerStyle = isValidParentTarget
    ? styles.songDetailVersionCardParentTarget
    : isParentPicking && !isParentPickSource && isInvalidParentTarget
      ? styles.songDetailVersionCardParentTargetDisabled
      : undefined;

  return (
    <View style={styles.songDetailClipRowWrap}>
      <ClipCardEvolutionGuide entry={entry.kind === "evolution" ? entry : null} />

      <IdeaCard
        containerStyle={[{ flex: 1 }, parentPickContainerStyle ?? null]}
        accentBorderColor={displayPrimary || isPrimaryCandidate ? "#B87D6B" : undefined}
        selected={isSelected || isMoving || isParentPickSource}
        inlineActive={inlineActive}
        isInlinePlaying={isInlinePlaying}
        nowPlaying={inlineActive}
        compact={compactDensity}
        highlightValue={highlightValue ?? null}
        cornerBadge={
          clip.isBookmarked ? <Ionicons name="bookmark" size={15} color="#B87D6B" /> : undefined
        }
        canPlay={hasClipPlaybackSource(clip)}
        durationLabel={durationLabel}
        onPressLead={() => {
          if (!canToggleInlinePlayback) return;
          if (!hasClipPlaybackSource(clip)) return;
          void Haptics.selectionAsync();
          void inlinePlayer.toggleInlinePlayback(idea.id, clip);
        }}
        onLongPressLead={displayOnly ? undefined : handleLongPress}
        onPress={handlePress}
        onLongPress={handleLongPress}
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
              visible={showReplyButton}
              compact={compactDensity}
              onPress={handleReply}
            />
            {showLocateButton ? (
              <Pressable
                style={({ pressed }) => [
                  styles.songDetailVersionHistoryBtn,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onLocateClip?.(clip.id);
                }}
                accessibilityRole="button"
                accessibilityLabel="Find in Evolution view"
              >
                <Ionicons name="git-branch-outline" size={14} color="#a89994" />
              </Pressable>
            ) : null}
            {entry.kind === "evolution" &&
              !entry.indented &&
              entry.hasOlderVersions &&
              onViewLineageHistory ? (
              <Pressable
                style={({ pressed }) => [
                  styles.songDetailVersionHistoryBtn,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onViewLineageHistory(entry.lineageRootId);
                }}
              >
                <Ionicons name="time-outline" size={14} color="#a89994" />
              </Pressable>
            ) : null}
          </>
        }
        bodyContent={
          clip.notes ? (
            <ClipNotesPreview
              notes={clip.notes ?? ""}
              disabled={!!displayOnly}
              onPress={!displayOnly ? () => onOpenNotesSheet?.(clip) : undefined}
            />
          ) : undefined
        }
        editContent={
          !displayOnly && editingClipId === clip.id ? (
            <ClipCardEditForm
              titleDraft={editingClipDraft}
              notesDraft={editingClipNotesDraft}
              onChangeTitle={setEditingClipDraft}
              onChangeNotes={setEditingClipNotesDraft}
              onSave={() => onSaveEditing(clip.id)}
              onCancel={onCancelEditing}
            />
          ) : undefined
        }
        footerDate={createdAtLabel}
        footerRightContent={
          <ClipTagBadges
            tags={visibleTagBadges}
            disabled={!!displayOnly}
            showAddButton={showAddTagButton}
            onPress={displayOnly ? undefined : handleTagsPress}
            containerStyle={styles.clipCardTagsRowFooter}
          />
        }
        inlinePlayerContent={
          inlineActive && !displayOnly ? (
            <ClipCardInlinePlayerFromStore
              inlinePlayer={inlinePlayer}
              fallbackDurationMs={playbackDurationMs || 0}
            />
          ) : undefined
        }
      />
    </View>
  );
}
