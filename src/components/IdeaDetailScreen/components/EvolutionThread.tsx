import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated as RNAnimated, Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { type ClipLineage } from "../../../domain/clipGraph";
import { getClipPlaybackDurationMs, hasClipPlaybackSource } from "../../../domain/clipPresentation";
import { fmtCardDuration, formatClipDate } from "../../../utils";
import { type ClipVersion } from "../../../types";
import { type ClipCardContextProps } from "./ClipCard";
import { PrimaryInk } from "./clipCard/ClipCardPrimaryIndicator";
import { SongClipCard } from "./SongClipCard";
import { ClipNoteLine } from "../../common/clip/ClipNoteLine";
import { ScrubBar } from "../../common/ScrubBar";
import { haptic } from "../../../design/haptics";
import { collapseIn } from "../../../design/motion";
import { colors } from "../../../design/tokens";

type EvolutionThreadProps = {
  lineage: ClipLineage;
  expanded: boolean;
  onToggleExpanded: (lineageRootId: string) => void;
  context: ClipCardContextProps;
  /** Reports where an older version's row sits (y from the thread's top edge)
   *  so a locate request can scroll that row — not just the thread — into view. */
  onVersionRowLayout?: (clipId: string, y: number) => void;
};

/** One quiet history row on the thread's stem: hollow node, version number,
 *  relative time, duration. Same law as the head card: the play glyph auditions
 *  inline, tapping the row opens the version in the full player, long-press
 *  selects. The note (a clip's own notes field) hangs under it in earned serif. */
function StemVersionRow({
  clip,
  versionNumber,
  ideaId,
  isFirst,
  isLast,
  context,
  shellRef,
  onRowLayout,
}: {
  clip: ClipVersion;
  versionNumber: number;
  ideaId: string;
  /** Bleeds the segment up through the stem's padding to meet the head card. */
  isFirst: boolean;
  /** The origin of the thread: the stem terminates at its node. */
  isLast: boolean;
  context: ClipCardContextProps;
  shellRef: React.RefObject<View | null>;
  onRowLayout?: (clipId: string, y: number) => void;
}) {
  const { t } = useTranslation();
  const { inlinePlayer, getHighlightValue } = context.playback;
  const rowRef = useRef<View>(null);
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const isSelected = useStore((s) => s.selectedClipIds.includes(clip.id));
  const toggleClipSelection = useStore((s) => s.toggleClipSelection);
  const startClipSelection = useStore((s) => s.startClipSelection);
  const setPlayerQueueForScreen = useStore((s) => s.setPlayerQueueForScreen);
  const inlineActive = useStore(
    (s) => s.inlineTarget?.ideaId === ideaId && s.inlineTarget.clipId === clip.id
  );
  const isInlinePlaying = useStore(
    (s) =>
      s.inlineTarget?.ideaId === ideaId &&
      s.inlineTarget.clipId === clip.id &&
      s.inlineIsPlaying
  );
  const durationMs = getClipPlaybackDurationMs(clip);
  const canPlay = hasClipPlaybackSource(clip);
  const note = (clip.notes ?? "").trim();
  // Same "view in context" flash the head card wears — the value is allocated
  // eagerly for every clip in the lineage, so an older version lights up too.
  const highlightValue = getHighlightValue(clip.id);

  const inlinePositionMs = useStore((s) => (inlineActive ? s.inlinePositionMs : 0));
  // While the scrub line is held, the elapsed caption reads the position under the thumb.
  const [scrubPreviewMs, setScrubPreviewMs] = useState<number | null>(null);
  const inlineDurationMs = useStore((s) => (inlineActive ? s.inlineDurationMs : 0));
  const inlineTotalMs = inlineDurationMs || durationMs || 0;

  // The transport is its own target, so it keeps working while you're selecting —
  // you can hear each candidate before committing to it.
  const togglePlayback = () => {
    if (!canPlay) return;
    haptic.tap();
    void inlinePlayer.toggleInlinePlayback(ideaId, clip);
  };
  // Row tap opens this version in the full player — the same door the head
  // card opens — so an older take gets its lyrics, chart, and practice tools too.
  const openPlayer = async () => {
    if (!canPlay) return;
    await inlinePlayer.resetInlinePlayer();
    setPlayerQueueForScreen([{ ideaId, clipId: clip.id }], 0, true);
  };
  const handlePress = () => {
    if (clipSelectionMode) {
      toggleClipSelection(clip.id);
      return;
    }
    void openPlayer();
  };
  const handleLongPress = () => {
    if (clipSelectionMode) {
      toggleClipSelection(clip.id);
      return;
    }
    haptic.grab();
    startClipSelection(clip.id);
  };

  // Measured against the thread shell (a host instance, so Fabric is happy),
  // not summed from parent layouts — the head card's height varies.
  const reportLayout = useCallback(() => {
    const shell = shellRef.current;
    const row = rowRef.current;
    if (!shell || !row || !onRowLayout) return;
    row.measureLayout(shell, (_x, y) => onRowLayout(clip.id, y));
  }, [clip.id, onRowLayout, shellRef]);

  return (
    <Animated.View entering={collapseIn}>
      <Pressable
        ref={rowRef}
        onLayout={reportLayout}
        style={({ pressed }) => [
          styles.songDetailStemRow,
          isSelected ? styles.songDetailStemRowSelected : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={t("clipLineage.versionA11y", { number: versionNumber })}
      >
        {highlightValue != null ? (
          <RNAnimated.View
            style={[styles.songDetailStemRowHighlight, { opacity: highlightValue }]}
            pointerEvents="none"
          />
        ) : null}
        <View
          style={[
            styles.songDetailStemSegmentIn,
            { top: isFirst ? -5.5 : -1.5, height: isFirst ? 25.5 : 21.5 },
          ]}
          pointerEvents="none"
        />
        {/* The stem runs newest → oldest and terminates at the origin (v1). */}
        {!isLast ? <View style={styles.songDetailStemSegmentOn} pointerEvents="none" /> : null}
        <View
          style={[
            styles.songDetailStemNode,
            inlineActive ? styles.songDetailStemNodeActive : null,
          ]}
        />
        {/* Bare glyph transport — same lead treatment as every card in the app. */}
        <Pressable
          style={({ pressed }) => [
            styles.songDetailStemPlay,
            pressed && canPlay ? styles.pressDown : null,
          ]}
          onPress={(e) => {
            e.stopPropagation();
            togglePlayback();
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t(
            inlineActive && isInlinePlaying ? "common.pause" : "common.play"
          )}
        >
          <Ionicons
            name={inlineActive && isInlinePlaying ? "pause" : "play"}
            size={13}
            color={
              !canPlay
                ? colors.textMuted
                : inlineActive
                  ? colors.primaryDeep
                  : colors.textStrong
            }
          />
        </Pressable>

        <View style={styles.songDetailStemRowBody}>
          <View style={styles.songDetailStemRowTop}>
            <Text style={styles.songDetailStemVn}>{t("clipLineage.versionTag", { number: versionNumber })}</Text>
            <Text style={styles.songDetailStemWhen}>{formatClipDate(clip.createdAt)}</Text>
            {clip.isBookmarked ? (
              <Ionicons name="bookmark" size={11} color={colors.primary} />
            ) : null}
            {/* The primary take isn't always the newest — when an older version is
                the sketch's face, the mark travels down to it. */}
            {clip.isPrimary ? <PrimaryInk label={t("common.primary")} /> : null}
            <View style={{ flex: 1 }} />
            <Text style={styles.songDetailStemDur}>
              {durationMs ? fmtCardDuration(durationMs) : "0:00"}
            </Text>
          </View>

          {note ? (
            <ClipNoteLine
              notes={note}
              disabled={clipSelectionMode}
              onOpen={() => context.actions.onOpenNotesSheet?.(clip)}
              onLongPress={handleLongPress}
            />
          ) : null}

          {/* Active preview extends the row into a scrubber — the same on-brand
              track the compact collection rows use. */}
          {inlineActive ? (
            <View style={styles.songDetailStemScrubRow}>
              <Text style={styles.songDetailStemDur}>{fmtCardDuration(scrubPreviewMs ?? inlinePositionMs)}</Text>
              <View style={styles.songDetailStemScrubTrack}>
                <ScrubBar
                  progress={inlineTotalMs > 0 ? Math.min(1, inlinePositionMs / inlineTotalMs) : 0}
                  durationMs={inlineTotalMs}
                  onScrubStart={() => void inlinePlayer.beginInlineScrub()}
                  onScrub={(fraction) => void inlinePlayer.endInlineScrub(fraction * inlineTotalMs)}
                  onScrubCancel={() => void inlinePlayer.cancelInlineScrub()}
                  onScrubPreview={(fraction) =>
                    setScrubPreviewMs(
                      fraction == null ? null : Math.floor((fraction * inlineTotalMs) / 1000) * 1000
                    )
                  }
                />
              </View>
              <Text style={styles.songDetailStemDur}>
                {durationMs ? fmtCardDuration(durationMs) : "0:00"}
              </Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  void inlinePlayer.resetInlinePlayer();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <Ionicons name="close" size={13} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * A multi-version lineage as one object (2026-10-15): the head card wears two
 * paper edges (a take with versions under it) and carries the thread in its
 * footer, "2 older ⌄" and "+ Version". Unfolded, the edges lift away and the
 * older versions hang beneath the card on a stem, newest first, ending at v1.
 */
export const EvolutionThread = React.memo(function EvolutionThread({
  lineage,
  expanded,
  onToggleExpanded,
  context,
  onVersionRowLayout,
}: EvolutionThreadProps) {
  const ideaId = context.mode.idea.id;
  const shellRef = useRef<View>(null);

  const head = lineage.latestClip;
  const olderClips = useMemo(
    () => lineage.clipsNewestToOldest.filter((clip) => clip.id !== head.id),
    [lineage.clipsNewestToOldest, head.id]
  );
  const versionCount = lineage.clipsOldestToNewest.length;
  // v1 = oldest; the head is always vN.
  const versionNumberById = useMemo(
    () => new Map(lineage.clipsOldestToNewest.map((clip, index) => [clip.id, index + 1])),
    [lineage.clipsOldestToNewest]
  );
  // The head card is memoized on its entry; a fresh literal per render defeated it.
  const headEntry = useMemo(
    () => ({
      kind: "evolution" as const,
      clip: head,
      lineageRootId: lineage.root.id,
      compactPreview: false,
      indented: false,
      continuesThreadBelow: false,
      hasOlderVersions: true,
      versionNumber: versionNumberById.get(head.id),
      versionCount,
    }),
    [head, lineage.root.id, versionNumberById, versionCount]
  );
  const rootId = lineage.root.id;
  const fold = useMemo(
    () => ({
      count: olderClips.length,
      expanded,
      onToggle: () => onToggleExpanded(rootId),
    }),
    [olderClips.length, expanded, onToggleExpanded, rootId]
  );

  return (
    <View ref={shellRef}>
      <SongClipCard entry={headEntry} context={context} fold={fold} stacked={!expanded} />

      {expanded ? (
        <View style={styles.songDetailStem}>
          {olderClips.map((clip, index) => (
            <StemVersionRow
              key={clip.id}
              clip={clip}
              versionNumber={versionNumberById.get(clip.id) ?? 1}
              ideaId={ideaId}
              isFirst={index === 0}
              isLast={index === olderClips.length - 1}
              context={context}
              shellRef={shellRef}
              onRowLayout={onVersionRowLayout}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});
