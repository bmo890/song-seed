import React, { memo, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PlayerArtifactDoors } from "./PlayerArtifactDoors";
import { QueuePanel } from "../../QueuePanel";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, spacing, text as textTokens } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

/** Total sheet height at rest: handle + queue header + eight rows + bottom
 *  inset on a standard phone. The sheet caps this at 72% of the window. */
const QUEUE_SHEET_COLLAPSED_HEIGHT = 470;

type PlayerSupportSectionsProps = {
  /** Doors — only sketches carry readable artifacts. */
  canAuthor: boolean;
  /** Standalone clip: the Sketch door's tap (grow this clip into a sketch). */
  onGrowSketch?: () => void;
  hasLyrics: boolean;
  lyricsPreviewLine: string;
  lyricsChordSummary: string;
  lyricsMeta: string | null;
  lyricsEditedSinceTake?: boolean;
  hasChart: boolean;
  chartHandle: string;
  onOpenLyrics: () => void;
  onOpenChart: () => void;
  onWriteLyrics: () => void;
  onBuildChart: () => void;
  clipNotes: string;
  notesExpanded: boolean;
  /** A queue exists (even one item): the footer's queue button is never a dead tap. */
  hasQueue: boolean;
  queueExpanded: boolean;
  onToggleNotesExpanded: (value: boolean) => void;
  onToggleQueueExpanded: (value: boolean) => void;
  onQueueOpenIdea: (ideaId: string) => void;
};

export const PlayerSupportSections = memo(PlayerSupportSectionsInner);

function PlayerSupportSectionsInner({
  canAuthor,
  onGrowSketch,
  hasLyrics,
  lyricsPreviewLine,
  lyricsChordSummary,
  lyricsMeta,
  lyricsEditedSinceTake,
  hasChart,
  chartHandle,
  onOpenLyrics,
  onOpenChart,
  onWriteLyrics,
  onBuildChart,
  clipNotes,
  notesExpanded,
  hasQueue,
  queueExpanded,
  onToggleNotesExpanded,
  onToggleQueueExpanded,
  onQueueOpenIdea,
}: PlayerSupportSectionsProps) {
  const { t } = useTranslation();

  const hasNotes = clipNotes.trim().length > 0;

  // Stable identities so the memoized QueuePanel isn't re-rendered by this
  // section's own playback-tick renders while the queue sheet is open.
  const closeQueueSheet = useCallback(() => onToggleQueueExpanded(false), [onToggleQueueExpanded]);
  const openIdeaFromQueue = useCallback(
    (ideaId: string) => {
      onToggleQueueExpanded(false);
      // Minimize on the NEXT frame: the minimize starts the sheet's motion, and the
      // player's freeze wall returns its last frame while the sheet moves — closing
      // and minimizing in one render left the queue sheet frozen open over the
      // collection it had just jumped to (2026-10-05). One frame lets the close land.
      requestAnimationFrame(() => onQueueOpenIdea(ideaId));
    },
    [onQueueOpenIdea, onToggleQueueExpanded]
  );

  return (
    <View style={playerScreenStyles.supportStack}>
      {/* Closed rung of the reading ladder: one door per artifact. */}
      <PlayerArtifactDoors
        canAuthor={canAuthor}
        onGrowSketch={onGrowSketch}
        hasLyrics={hasLyrics}
        lyricsPreviewLine={lyricsPreviewLine}
        lyricsChordSummary={lyricsChordSummary}
        lyricsMeta={lyricsMeta}
        lyricsEditedSinceTake={lyricsEditedSinceTake}
        hasChart={hasChart}
        chartHandle={chartHandle}
        onOpenLyrics={onOpenLyrics}
        onOpenChart={onOpenChart}
        onWriteLyrics={onWriteLyrics}
        onBuildChart={onBuildChart}
      />

      {/* No chip row: the layer lane under the reel is the bench's door, the
          Notes shelf above the transport is the notes door, and the transport
          bar's list button is the queue's. Doors live where their subjects do.
          Layer editing itself moved to the bench (layers mode) — the sheet died
          with the mixer metaphor (2026-08-07). */}

      {/* Notes — read-only here; editing lives on the song's Notes tab. */}
      <BottomSheet visible={notesExpanded} onClose={() => onToggleNotesExpanded(false)}>
        <Text style={chipStyles.sheetTitle}>{t("player.clipNotes")}</Text>
        <Text style={chipStyles.sheetMeta}>
          {hasNotes ? t("player.notesAttached") : t("player.noNotesSaved")}
        </Text>
        <ScrollView style={chipStyles.sheetScroll} showsVerticalScrollIndicator={false}>
          <UserText align="content" value={clipNotes.trim()} style={hasNotes ? chipStyles.notesText : chipStyles.notesPlaceholder}>
            {hasNotes ? clipNotes.trim() : t("player.noNotesBody")}
          </UserText>
        </ScrollView>
      </BottomSheet>

      {/* Queue — the SAME surface as the dock's queue panel (jump on tap,
          go-to-song), hosted in a bottom sheet here. Opens at half height
          (about eight rows), pulls up to the full screen, drags down to close —
          the resizable queue sheet of the music players people already know. */}
      {hasQueue ? (
        <BottomSheet
          visible={queueExpanded}
          onClose={closeQueueSheet}
          expandable
          collapsedHeight={QUEUE_SHEET_COLLAPSED_HEIGHT}
        >
          <QueuePanel framed={false} onOpenIdea={openIdeaFromQueue} />
        </BottomSheet>
      ) : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  sheetTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  sheetMeta: {
    ...textTokens.supporting,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  sheetScroll: {
    maxHeight: 420,
  },
  notesText: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  notesPlaceholder: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
