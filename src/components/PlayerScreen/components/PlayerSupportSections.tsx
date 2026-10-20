import React, { memo, useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ChordSheet } from "../../../types";
import { PlayerArtifactDoors } from "./PlayerArtifactDoors";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { QUEUE_SHEET_COLLAPSED_HEIGHT, QueuePanel } from "../../QueuePanel";
import { BottomSheet } from "../../common/BottomSheet";
import { spacing } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";

/** Total sheet height at rest: handle + queue header + eight rows + bottom
 *  inset on a standard phone. The sheet caps this at 72% of the window. */

type PlayerSupportSectionsProps = {
  /** Doors — only sketches carry readable artifacts. */
  canAuthor: boolean;
  /** Standalone clip: the Sketch door's tap (grow this clip into a sketch). */
  onGrowSketch?: () => void;
  hasLyrics: boolean;
  lyricsPreview: string;
  lyricsChordSummary: string;
  lyricsMeta: string | null;
  lyricsEditedSinceTake?: boolean;
  hasChart: boolean;
  chordSheet: ChordSheet | null | undefined;
  onOpenLyrics: () => void;
  onOpenChart: () => void;
  onWriteLyrics: () => void;
  onBuildChart: () => void;
  clipNotes: string;
  /** "Notes" on a clip, "Take notes" on a sketch's take. */
  notesLabel: string;
  /** Write the recording's note (the Notes page edits it in place, no sketch needed). */
  onSaveNotes: (notes: string) => void;
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
  lyricsPreview,
  lyricsChordSummary,
  lyricsMeta,
  lyricsEditedSinceTake,
  hasChart,
  chordSheet,
  onOpenLyrics,
  onOpenChart,
  onWriteLyrics,
  onBuildChart,
  clipNotes,
  notesLabel,
  onSaveNotes,
  notesExpanded,
  hasQueue,
  queueExpanded,
  onToggleNotesExpanded,
  onToggleQueueExpanded,
  onQueueOpenIdea,
}: PlayerSupportSectionsProps) {

  const [notesDraft, setNotesDraft] = useState(clipNotes);
  const openNotes = useCallback(() => {
    setNotesDraft(clipNotes);
    onToggleNotesExpanded(true);
  }, [clipNotes, onToggleNotesExpanded]);
  const saveNotes = useCallback(() => {
    if (notesDraft !== clipNotes) onSaveNotes(notesDraft);
    onToggleNotesExpanded(false);
  }, [clipNotes, notesDraft, onSaveNotes, onToggleNotesExpanded]);

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
    <View style={playerScreenStyles.listenStack}>
      {/* The pages float centred in the bottom half (founder, 2026-10-20). */}
      <View style={chipStyles.air} />

      {/* Closed rung of the reading ladder: the pages, anchored above the transport. */}
      <PlayerArtifactDoors
        canAuthor={canAuthor}
        onGrowSketch={onGrowSketch}
        hasLyrics={hasLyrics}
        lyricsPreview={lyricsPreview}
        lyricsChordSummary={lyricsChordSummary}
        lyricsMeta={lyricsMeta}
        lyricsEditedSinceTake={lyricsEditedSinceTake}
        hasChart={hasChart}
        chordSheet={chordSheet}
        onOpenLyrics={onOpenLyrics}
        onOpenChart={onOpenChart}
        onWriteLyrics={onWriteLyrics}
        onBuildChart={onBuildChart}
        notes={clipNotes}
        notesLabel={notesLabel}
        onOpenNotes={openNotes}
      />
      {/* Air on both sides: the pages sit centred between the toolbar and the transport. */}
      <View style={chipStyles.air} />

      {/* No chip row: the layer lane under the reel is the bench's door, the
          margin note above is the notes door, and the transport bar's list
          button is the queue's. Doors live where their subjects do.
          Layer editing itself moved to the bench (layers mode) — the sheet died
          with the mixer metaphor (2026-08-07). */}

      {/* The Notes page opens the note itself, to write in place. */}
      <ClipNotesSheet
        visible={notesExpanded}
        heading={notesLabel}
        titleDraft=""
        notesDraft={notesDraft}
        onChangeNotes={setNotesDraft}
        onSave={saveNotes}
        onCancel={() => onToggleNotesExpanded(false)}
      />

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
  air: {
    flex: 1,
    minHeight: spacing.sm,
  },
});
