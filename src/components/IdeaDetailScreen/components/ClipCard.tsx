import React from "react";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { getClipOverdubStemCount, getClipPlaybackDurationMs, hasClipPlaybackSource } from "../../../domain/clipPresentation";
import { fmtDuration, formatClipDate } from "../../../utils";
import { type EvolutionListClipEntry, type TimelineClipEntry } from "../../../domain/clipGraph";
import { type SongIdea, type ClipVersion, type CustomTagDefinition, type InlinePlayerControls } from "../../../types";
import { getTagColor, getTagLabel, suggestedSectionTagsForClip } from "../songClipControls";
import { ClipCardEditForm } from "./clipCard/ClipCardEditForm";
import { ClipCardEvolutionGuide } from "./clipCard/ClipCardEvolutionGuide";
import { ClipCardInlinePlayer } from "./clipCard/ClipCardInlinePlayer";
import { ClipCardPrimaryIndicator } from "./clipCard/ClipCardPrimaryIndicator";
import { ClipCardReplyButton } from "./clipCard/ClipCardReplyButton";
import { ClipNotesPreview } from "../../common/clip/ClipNotesPreview";
import { ClipTagBadges } from "../../common/clip/ClipTagBadges";
import { IdeaCard } from "../../common/IdeaCard";
import type { GestureResponderEvent } from "react-native";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";

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

// Memoized: entries come from memoized lineage rows and `context` keeps referential
// stability (stable-handle callbacks + useMemo in ClipList/SongClipListContent), so a
// song-screen render only re-renders the cards whose data actually changed.
export const ClipCard = React.memo(function ClipCard({
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

  const { clip } = entry;
  const navigation = useNavigation();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const isSelected = useStore((s) => s.selectedClipIds.includes(clip.id));
  const isMoving = useStore((s) => s.movingClipId === clip.id);
  const startClipSelection = useStore((s) => s.startClipSelection);
  const toggleClipSelection = useStore((s) => s.toggleClipSelection);
  const setPendingPrimaryClipId = useStore((s) => s.setPendingPrimaryClipId);
  const setRecordingParentClipId = useStore((s) => s.setRecordingParentClipId);
  const setRecordingIdeaId = useStore((s) => s.setRecordingIdeaId);
  const setPlayerQueueForScreen = useStore((s) => s.setPlayerQueueForScreen);
  const inlineActive = useStore(
    (s) => s.inlineTarget?.ideaId === idea.id && s.inlineTarget.clipId === clip.id
  );
  const isInlinePlaying = useStore(
    (s) =>
      s.inlineTarget?.ideaId === idea.id &&
      s.inlineTarget.clipId === clip.id &&
      s.inlineIsPlaying
  );
  // This clip is the active dock / full-player session target.
  const sessionActive = useStore(
    (s) => s.playerTarget?.ideaId === idea.id && s.playerTarget.clipId === clip.id
  );
  const sessionPlaying = useStore((s) => s.playerIsPlaying);
  // Now-playing treatment is reserved for the durable dock / full-player session.
  // A clip-card inline preview keeps its own plain look (its play/pause + scrubber).
  const nowPlaying = sessionActive;
  const nowPlayingIsPlaying = sessionActive && sessionPlaying;
  const highlightValue = getHighlightValue(clip.id);
  const isPrimaryCandidate = displayPrimaryId === clip.id;
  const compactDensity = entry.kind === "evolution" ? entry.compactPreview : false;
  const isParentPickSource = parentPickSourceIdSet.has(clip.id);
  const isInvalidParentTarget = isParentPicking && parentPickInvalidTargetIdSet.has(clip.id);
  const isValidParentTarget = isParentPicking && !isInvalidParentTarget;
  // Memoized: cards re-render often (store selectors, parent renders during playback),
  // and rebuilding tag colours + running the section-tag TITLE STRING MATCHER on every
  // render of every card was pure waste — the collection list precomputes its card meta
  // for the same reason.
  const tagBadges = React.useMemo(
    () =>
      (clip.tags ?? []).map((tagKey) => {
        const color = getTagColor(tagKey, idea.customTags, globalCustomTags);
        const label = getTagLabel(tagKey, idea.customTags, globalCustomTags);
        return {
          key: tagKey,
          label,
          backgroundColor: color.bg,
          textColor: color.text,
        };
      }),
    [clip.tags, globalCustomTags, idea.customTags]
  );
  const canEditTags =
    !displayOnly && !isEditMode && !isDraftProject && !isParentPicking && !clipSelectionMode;
  const visibleTagBadges = tagBadges;
  // The add affordance is always offered while editable (labeled "Tag" when the
  // clip has none yet), so tagging is discoverable whether or not tags exist.
  const showAddTagButton = canEditTags;
  const tagSuggestions = React.useMemo(
    () =>
      canEditTags
        ? suggestedSectionTagsForClip(clip.title, clip.tags ?? []).map((suggestion) => {
            const color = getTagColor(suggestion.key, idea.customTags, globalCustomTags);
            return { key: suggestion.key, label: suggestion.label, textColor: color.text };
          })
        : [],
    [canEditTags, clip.tags, clip.title, globalCustomTags, idea.customTags]
  );
  const applyTag = (tagKey: string) => {
    haptic.tap();
    const current = clip.tags ?? [];
    if (current.includes(tagKey)) return;
    useStore.getState().setClipTags(idea.id, clip.id, [...current, tagKey]);
  };
  const playbackDurationMs = getClipPlaybackDurationMs(clip);
  const overdubStemCount = getClipOverdubStemCount(clip);
  const durationLabel = playbackDurationMs ? fmtDuration(playbackDurationMs) : "0:00";
  const createdAtLabel =
    overdubStemCount > 0
      ? `${formatClipDate(clip.createdAt)} • ${overdubStemCount} ${overdubStemCount === 1 ? "layer" : "layers"}`
      : formatClipDate(clip.createdAt);
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
    setPlayerQueueForScreen([{ ideaId: idea.id, clipId: clip.id }], 0, true);
  };

  const beginActions = () => {
    onOpenActions(clip);
  };
  const beginSelection = () => {
    haptic.grab();
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
        accentBorderColor={displayPrimary || isPrimaryCandidate ? colors.primary : undefined}
        selected={isSelected || isMoving || isParentPickSource}
        inlineActive={inlineActive}
        isInlinePlaying={isInlinePlaying}
        nowPlaying={nowPlaying}
        nowPlayingIsPlaying={nowPlayingIsPlaying}
        compact={compactDensity}
        highlightValue={highlightValue ?? null}
        cornerBadge={
          clip.isBookmarked ? <Ionicons name="bookmark" size={15} color={colors.primary} /> : undefined
        }
        canPlay={hasClipPlaybackSource(clip)}
        durationLabel={durationLabel}
        onPressLead={() => {
          if (!canToggleInlinePlayback) return;
          if (!hasClipPlaybackSource(clip)) return;
          haptic.tap();
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
                <Ionicons name="git-branch-outline" size={14} color={colors.textMuted} />
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
                accessibilityRole="button"
                accessibilityLabel="View version history for this thread"
              >
                <Ionicons name="git-commit-outline" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
            {/* Record-a-new-take (mic) stays farthest right — the primary forward action. */}
            <ClipCardReplyButton
              visible={showReplyButton}
              compact={compactDensity}
              onPress={handleReply}
            />
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
            suggestions={tagSuggestions}
            onApplySuggestion={applyTag}
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
});
