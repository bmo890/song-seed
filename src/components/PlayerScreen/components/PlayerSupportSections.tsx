import React, { memo, useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ChordSheet } from "../../../types";
import { PlayerArtifactDoors } from "./PlayerArtifactDoors";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { QUEUE_SHEET_COLLAPSED_HEIGHT, QueuePanel } from "../../QueuePanel";
import { BottomSheet } from "../../common/BottomSheet";
import { spacing } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";
import { editorDraftKey } from "../../../domain/editorDrafts";

/** The take a note is written about: the one on screen when the Notes page opened. */
export type NotesTarget = { ideaId: string; clipId: string };

/** Total sheet height at rest: handle + queue header + eight rows + bottom
 *  inset on a standard phone. The sheet caps this at 72% of the window. */

type PlayerSupportSectionsProps = {
  /** Doors — only sketches carry readable artifacts. */
  canAuthor: boolean;
  /** Standalone clip: the Sketch door's tap (grow this clip into a sketch). */
  onGrowSketch?: () => void;
  /** A parcel's (until Keep) or an archived take: pages read, none are written. */
  readOnly?: boolean;
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
  /** The idea and take on screen now; the Notes page holds on to them as it opens. */
  notesIdeaId: string | null;
  notesClipId: string | null;
  /** "Notes" on a clip, "Take notes" on a sketch's take. */
  notesLabel: string;
  /** Write the recording's note (the Notes page edits it in place, no sketch needed). */
  onSaveNotes: (target: NotesTarget, notes: string) => void;
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
  readOnly = false,
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
  notesIdeaId,
  notesClipId,
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
  // The Notes page belongs to the take it was opened on. The queue moves on under
  // the sheet (a clip ends, the next one plays); the note still lands on the take it
  // was written about, never on whatever is playing at Save (12a A-H2).
  const [notesTarget, setNotesTarget] = useState<NotesTarget | null>(null);
  const openedNotesRef = useRef("");
  const openNotes = useCallback(() => {
    if (!notesIdeaId || !notesClipId) return;
    setNotesTarget({ ideaId: notesIdeaId, clipId: notesClipId });
    openedNotesRef.current = clipNotes;
    setNotesDraft(clipNotes);
    onToggleNotesExpanded(true);
  }, [clipNotes, notesClipId, notesIdeaId, onToggleNotesExpanded]);
  const saveNotes = useCallback(() => {
    if (notesTarget && notesDraft !== openedNotesRef.current) onSaveNotes(notesTarget, notesDraft);
    onToggleNotesExpanded(false);
  }, [notesDraft, notesTarget, onSaveNotes, onToggleNotesExpanded]);

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
        readOnly={readOnly}
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

      {/* No chip row: a layer lane under the reel opens that layer's sheet, the
          margin note above is the notes door, and the transport bar's list
          button is the queue's. Doors live where their subjects do. */}

      {/* The Notes page opens the note itself, to write in place. */}
      <ClipNotesSheet
        visible={notesExpanded && !!notesTarget}
        heading={notesLabel}
        titleDraft=""
        notesDraft={notesDraft}
        onChangeNotes={setNotesDraft}
        onSave={saveNotes}
        onCancel={() => onToggleNotesExpanded(false)}
        draftKey={notesTarget ? editorDraftKey("clipText", notesTarget.ideaId, notesTarget.clipId) : null}
        // A parcel's or an archived take's note opens to be read in full.
        readOnly={readOnly}
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
