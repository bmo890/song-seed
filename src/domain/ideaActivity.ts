import type { ClipVersion, SongIdea } from "../types";

/**
 * What moves an idea's "updated" time (founder's rule, 2026-10-12, one rule
 * for clips and sketches alike): the idea's CONTENT changed — something a
 * listener or reader of it would notice, and something you'd lose if the edit
 * were undone. Practising (loop, speed, pitch, step-up, transpose), organising
 * (bookmark, hide, move, groups) and housekeeping (mix re-renders, waveform
 * hydration, grid self-align, imports) are not work on the idea.
 *
 * Counts: title, notes, stage, lyrics, chords and chart, sections, pins, tags,
 * takes added / removed / re-parented / made primary, layers recorded or
 * removed, a layer's gain, offset or tone, the base take's gain or tone.
 * Does not count: a layer's name, colour or mute; rendered-mix files;
 * waveforms, durations, analysis, recording grids; bookmarks; groups; the
 * planned song grid; collection; draft and serif flags.
 *
 * Plan: docs/product-plan/founder-pass-2026-10-03.md ("Updated means work").
 */

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function clipWork(clip: ClipVersion) {
  return {
    id: clip.id,
    title: clip.title,
    notes: clip.notes,
    tags: clip.tags,
    isPrimary: clip.isPrimary,
    parentClipId: clip.parentClipId,
    editRegions: clip.editRegions,
    sections: clip.sections,
    practiceMarkers: clip.practiceMarkers,
    root: clip.overdub?.root,
    stems: clip.overdub?.stems.map((stem) => ({
      id: stem.id,
      gainDb: stem.gainDb,
      offsetMs: stem.offsetMs,
      tonePreset: stem.tonePreset,
    })),
  };
}

/** True when `next` differs from `prev` in a way that counts as work on the idea. */
export function ideaWorkChanged(prev: SongIdea, next: SongIdea): boolean {
  if (prev === next) return false;
  if (
    prev.kind !== next.kind ||
    prev.title !== next.title ||
    prev.notes !== next.notes ||
    prev.status !== next.status ||
    prev.completionPct !== next.completionPct
  ) {
    return true;
  }
  if (!same(prev.lyrics, next.lyrics) || !same(prev.chordSheet, next.chordSheet)) return true;
  if (prev.clips.length !== next.clips.length) return true;
  return next.clips.some((clip, index) => {
    const prevClip = prev.clips[index];
    if (!prevClip) return true;
    if (prevClip === clip) return false;
    return !same(clipWork(prevClip), clipWork(clip));
  });
}
