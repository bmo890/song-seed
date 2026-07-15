import { useState } from "react";
import { appActions } from "../../../../state/actions";
import type { ChordParts } from "../../../../domain/chords";
import type { ChordPlacement, SongChordPaletteItem } from "../../../../types";

function partsFromPaletteItem(item: SongChordPaletteItem): ChordParts {
  if (!item.root) return { customSuffix: item.displayText };
  return {
    root: item.root,
    accidental: item.accidental,
    quality: item.quality,
    extension: item.extension,
    bassRoot: item.bassRoot,
    bassAccidental: item.bassAccidental,
    customSuffix: item.customSuffix,
  };
}

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
  // An "armed" palette chord places directly on tap (fast repeated insertion);
  // with nothing armed, tapping a lyric opens the full picker instead.
  const [armed, setArmed] = useState<SongChordPaletteItem | null>(null);

  const toggleArmed = (item: SongChordPaletteItem) => {
    setArmed((prev) => (prev?.id === item.id ? null : item));
  };
  const disarm = () => setArmed(null);

  const openAdd = (lineId: string, at: number) => {
    setTarget({ mode: "add", lineId, at, initial: null });
  };

  /** Tap-to-add dispatch: drop the armed chord directly, or open the picker. */
  const addAt = (lineId: string, at: number) => {
    if (armed && versionId) {
      appActions.upsertChordPlacement(ideaId, versionId, lineId, { ...partsFromPaletteItem(armed), at });
      return;
    }
    openAdd(lineId, at);
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

  return { target, armed, toggleArmed, disarm, openAdd, addAt, openEdit, close, save, remove, move };
}
