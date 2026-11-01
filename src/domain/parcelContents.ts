/**
 * What a SongNook Send parcel carries besides the audio (founder, 2026-11-01):
 * "send it with its notes, lyrics, charts and marks". The Send sheet lists,
 * per item, only the kinds of thing it really has, each one simply in or out:
 * no picking two marks of four, no picking takes. Audio always goes.
 *
 * Pure: the sheet reads `ideaParts` / `takeParts` / `sketchSharedParts`, the
 * creator applies the sender's choice with `trimIdea` / `trimClip` to copies,
 * never to the library.
 */
import { getPlayableClipForIdea } from "./clipPresentation";
import type { ClipVersion, SongIdea } from "../types";

/** `takes`: every take (out: the main take alone). `notes`: the idea's and the
 *  takes' notes. `marks`: practice marks and sections. `layers`: overdubs and
 *  their mix (out: the bare take). `lyrics` / `chart`: a sketch's words and chords. */
export type ParcelPart = "takes" | "lyrics" | "chart" | "notes" | "marks" | "layers";

const PART_ORDER: readonly ParcelPart[] = ["takes", "lyrics", "chart", "notes", "marks", "layers"];

const hasText = (value: string | null | undefined) => !!value && value.trim().length > 0;
const clipHasNotes = (clip: ClipVersion) => hasText(clip.notes);
const clipHasMarks = (clip: ClipVersion) =>
  (clip.practiceMarkers?.length ?? 0) > 0 || (clip.sections?.length ?? 0) > 0;
const clipHasLayers = (clip: ClipVersion) => (clip.overdub?.stems?.length ?? 0) > 0;

function inOrder(parts: Set<ParcelPart>): ParcelPart[] {
  return PART_ORDER.filter((part) => parts.has(part));
}

/** What one take carries: chosen inside a sketch, or a loose card's lone take. */
export function takeParts(clip: ClipVersion): ParcelPart[] {
  const parts = new Set<ParcelPart>();
  if (clipHasNotes(clip)) parts.add("notes");
  if (clipHasMarks(clip)) parts.add("marks");
  if (clipHasLayers(clip)) parts.add("layers");
  return inOrder(parts);
}

/** What a whole card carries: a loose clip (its re-records are its takes) or a sketch. */
export function ideaParts(idea: SongIdea): ParcelPart[] {
  const parts = new Set<ParcelPart>();
  if (idea.clips.length > 1) parts.add("takes");
  if (idea.kind === "project") {
    if ((idea.lyrics?.versions.length ?? 0) > 0) parts.add("lyrics");
    if (idea.chordSheet) parts.add("chart");
  }
  if (hasText(idea.notes)) parts.add("notes");
  // Takes out keeps the main take: only its things are on offer then, but the
  // sheet lists the card's whole reach so a part never appears or vanishes as
  // another is switched.
  for (const clip of idea.clips) for (const part of takeParts(clip)) parts.add(part);
  return inOrder(parts);
}

/** The sketch's own things that travel with takes chosen inside it. */
export function sketchSharedParts(sketch: SongIdea): ParcelPart[] {
  const parts = new Set<ParcelPart>();
  if ((sketch.lyrics?.versions.length ?? 0) > 0) parts.add("lyrics");
  if (sketch.chordSheet) parts.add("chart");
  if (hasText(sketch.notes)) parts.add("notes");
  return inOrder(parts);
}

/** A copy of the take without what the sender left out. */
export function trimClip(clip: ClipVersion, leaveOut: ReadonlySet<ParcelPart>): ClipVersion {
  const next: ClipVersion = { ...clip };
  if (leaveOut.has("notes")) next.notes = "";
  if (leaveOut.has("marks")) {
    next.practiceMarkers = undefined;
    next.sections = undefined;
  }
  // The bare take: no layers, no mix, so it plays (and travels) as recorded.
  if (leaveOut.has("layers")) next.overdub = undefined;
  if (leaveOut.has("lyrics")) next.lyricsVersionId = undefined;
  return next;
}

/** A copy of the card without what the sender left out. Takes out keeps the
 *  main take, marked primary so it still leads on the other side. */
export function trimIdea(idea: SongIdea, leaveOut: ReadonlySet<ParcelPart>): SongIdea {
  let clips = idea.clips;
  if (leaveOut.has("takes")) {
    const main = getPlayableClipForIdea(idea) ?? idea.clips[0];
    clips = main ? [{ ...main, isPrimary: true }] : [];
  }
  const next: SongIdea = { ...idea, clips: clips.map((clip) => trimClip(clip, leaveOut)) };
  if (leaveOut.has("notes")) next.notes = "";
  if (leaveOut.has("lyrics")) next.lyrics = undefined;
  if (leaveOut.has("chart")) {
    next.chordSheet = undefined;
    next.chordPalette = undefined;
  }
  return next;
}

/** True when, after trimming, the card holds nothing but its audio. A parcel
 *  of only these goes as plain audio files, exactly as it always has. */
export function carriesOnlyAudio(idea: SongIdea): boolean {
  return idea.kind === "clip" && ideaParts(idea).length === 0;
}
