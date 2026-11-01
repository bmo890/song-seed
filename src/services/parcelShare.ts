/**
 * SongNook Send with what travels beside the audio (founder, 2026-11-01): the
 * Send sheet lists each item's notes, marks, layers, takes, lyrics and chart,
 * each one in or out, and these creators apply that choice to copies.
 *
 * A parcel that is nothing but loose audio goes as plain audio files, exactly
 * as it always has. Anything carrying more goes as one SongNook package, with
 * a plain copy of each item's audio beside it: the link page's quiet raw-files
 * list for someone without the app. The app imports the package alone.
 */
import { getClipPlaybackUri, getPlayableClipForIdea } from "../domain/clipPresentation";
import { orderByKeys } from "../domain/parcelOrder";
import {
  carriesOnlyAudio,
  sketchSharedParts,
  takeParts,
  trimClip,
  trimIdea,
  type ParcelPart,
} from "../domain/parcelContents";
import type { SentLink } from "../domain/sentLinks";
import type { ClipVersion, ShareKind, SongIdea } from "../types";
import type { ShareableAudioClip } from "./audioStorage";
import { clipFiles, createClipsShareLink } from "./clipShareLink";
import { buildIdeasExportArgs } from "./ideasShare";
import { createShareLink } from "./shareLink";
import type { ShareLinkParcel } from "./setlistShare";
import { buildSketchExportArgs } from "./sketchShare";

/** The sender's choice on the sheet: running order, and what each item leaves
 *  home (by item key), plus what a sketch's own line leaves home. */
export type ParcelChoice = {
  order?: string[];
  leaveOut?: Record<string, ParcelPart[]>;
  sharedLeaveOut?: ParcelPart[];
};

type Parcel = ShareLinkParcel & ParcelChoice;

const leaveOutOf = (parcel: Parcel, key: string) => new Set<ParcelPart>(parcel.leaveOut?.[key] ?? []);

function audioOfIdea(idea: SongIdea): ShareableAudioClip | null {
  const clip = getPlayableClipForIdea(idea);
  const audioUri = clip ? getClipPlaybackUri(clip) : undefined;
  if (!clip || !audioUri) return null;
  return { title: idea.kind === "project" ? idea.title : clip.title || idea.title, audioUri };
}

function audioOfTake(clip: ClipVersion): ShareableAudioClip | null {
  const audioUri = getClipPlaybackUri(clip);
  return audioUri ? { title: clip.title, audioUri } : null;
}

const present = <T,>(value: T | null): value is T => value != null;

/** Cards from a collection (loose clips, sketches, or both), in the sender's order. */
export function createCardsShareLink(
  entries: { key: string; idea: SongIdea }[],
  label: string,
  parcel: Parcel
): Promise<SentLink> {
  const ideas = orderByKeys(entries, parcel.order, (entry) => entry.key).map((entry) =>
    trimIdea(entry.idea, leaveOutOf(parcel, entry.key))
  );
  const audio = ideas.map(audioOfIdea).filter(present);
  if (ideas.every(carriesOnlyAudio)) return createClipsShareLink(audio, label, parcel);

  const kind: ShareKind =
    ideas.length === 1 && ideas[0]!.kind === "project"
      ? "sketch"
      : ideas.every((idea) => idea.kind === "clip")
        ? "clips"
        : "collection";
  return createShareLink({
    title: parcel.title || label,
    kind,
    senderName: parcel.senderName,
    message: parcel.message ?? undefined,
    progress: parcel.progress,
    browserCopies: clipFiles(audio),
    buildArgs: (transferId) =>
      buildIdeasExportArgs(ideas, label, { transferId, senderName: parcel.senderName, title: parcel.title }, kind),
  });
}

/** Takes chosen inside a sketch. With anything beyond their audio they arrive
 *  as a small sketch of just those takes, carrying the sketch's lyrics and
 *  chart when those stay in. */
export function createTakesShareLink(
  sketch: SongIdea,
  entries: { key: string; clip: ClipVersion }[],
  label: string,
  parcel: Parcel
): Promise<SentLink> {
  // A loose clip's own takes are just that card, trimmed the same way.
  if (sketch.kind !== "project") {
    const ordered = orderByKeys(entries, parcel.order, (entry) => entry.key);
    const out = [...new Set(ordered.flatMap((entry) => parcel.leaveOut?.[entry.key] ?? []))];
    return createCardsShareLink(
      [{ key: "card", idea: { ...sketch, clips: ordered.map((entry) => entry.clip) } }],
      label,
      { ...parcel, order: undefined, leaveOut: { card: out } }
    );
  }
  const sharedOut = new Set<ParcelPart>(parcel.sharedLeaveOut ?? []);
  // The takes' own lyric stamps follow the sketch's lyrics in or out.
  const takeOut = (key: string) => {
    const out = leaveOutOf(parcel, key);
    if (sharedOut.has("lyrics")) out.add("lyrics");
    return out;
  };
  const takes = orderByKeys(entries, parcel.order, (entry) => entry.key).map((entry) =>
    trimClip(entry.clip, takeOut(entry.key))
  );
  const audio = takes.map(audioOfTake).filter(present);
  const sketchOwn = trimIdea({ ...sketch, clips: [] }, sharedOut);
  const nothingMore = takes.every((take) => takeParts(take).length === 0) && sketchSharedParts(sketchOwn).length === 0;
  if (nothingMore) return createClipsShareLink(audio, label, parcel);

  const leadId = takes.some((take) => take.isPrimary) ? null : takes[0]?.id;
  const cut: SongIdea = {
    ...sketchOwn,
    clips: takes.map((take) => (take.id === leadId ? { ...take, isPrimary: true } : take)),
  };
  return createShareLink({
    title: parcel.title || label,
    kind: "sketch",
    senderName: parcel.senderName,
    message: parcel.message ?? undefined,
    progress: parcel.progress,
    browserCopies: clipFiles(audio),
    buildArgs: (transferId) =>
      buildSketchExportArgs(cut, { transferId, senderName: parcel.senderName, title: parcel.title }),
  });
}
