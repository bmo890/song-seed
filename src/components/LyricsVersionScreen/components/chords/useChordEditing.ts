import { useState } from "react";
import { appActions } from "../../../../state/actions";
import type { ChordParts } from "../../../../chords";
import type { ChordPlacement } from "../../../../types";

type PickerTarget = {
  mode: "add" | "edit";
  lineId: string;
  at: number;
  chordId?: string;
  initial: ChordParts | null;
};

function partsFromChord(chord: ChordPlacement): ChordParts {
  // Legacy chords (typed as free text before structured fields existed) carry no
  // root — seed the custom suffix with their display so the picker shows and can
  // re-save them rather than starting blank.
  if (!chord.root) {
    return { customSuffix: chord.chord };
  }
  return {
    root: chord.root,
    accidental: chord.accidental,
    quality: chord.quality,
    extension: chord.extension,
    bassRoot: chord.bassRoot,
    bassAccidental: chord.bassAccidental,
    customSuffix: chord.customSuffix,
  };
}

/** Owns the chord-picker target + wires add/edit/move/remove to store actions
 * for a specific lyric version. */
export function useChordEditing(ideaId: string, versionId: string | undefined) {
  const [target, setTarget] = useState<PickerTarget | null>(null);

  const openAdd = (lineId: string, at: number) => {
    setTarget({ mode: "add", lineId, at, initial: null });
  };

  const openEdit = (lineId: string, chord: ChordPlacement) => {
    setTarget({ mode: "edit", lineId, at: chord.at, chordId: chord.id, initial: partsFromChord(chord) });
  };

  const close = () => setTarget(null);

  const save = (parts: ChordParts) => {
    if (!versionId || !target) return;
    appActions.upsertChordPlacement(ideaId, versionId, target.lineId, {
      ...parts,
      at: target.at,
      id: target.chordId,
    });
    close();
  };

  const remove = () => {
    if (!versionId || !target?.chordId) return;
    appActions.removeChordPlacement(ideaId, versionId, target.lineId, target.chordId);
    close();
  };

  const move = (lineId: string, chordId: string, at: number) => {
    if (!versionId) return;
    appActions.moveChordPlacement(ideaId, versionId, lineId, chordId, at);
  };

  return { target, openAdd, openEdit, close, save, remove, move };
}
