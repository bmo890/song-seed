import { useEffect, useRef } from "react";
import type { CountInOption } from "./usePlayerScreenUi";

/** What a clip's practice sounds like: the bends a musician sets on one clip. */
export type ClipPracticeSettings = {
  pitchSemitones: number;
  playbackRate: number;
  clickEnabled: boolean;
  countIn: CountInOption;
};

export const NEUTRAL_CLIP_PRACTICE: ClipPracticeSettings = {
  pitchSemitones: 0,
  playbackRate: 1,
  clickEnabled: false,
  countIn: "off",
};

/**
 * Speed, pitch, click and count-in belong to the clip they were set on
 * (founder, 2026-10-21): "changing speed and tone etc should only be relevant
 * for the clip it was done on". They used to live once per player session, so
 * a pitch set on one song followed the queue into the next until the session
 * was closed. Now each clip keeps its own for the length of the session: the
 * clip you leave is remembered, the clip you arrive at gets its own back, or
 * neutral if it was never bent. The loop and step-up keep theirs in their own
 * controllers. Closing the session (the dock's x) forgets them all, except what
 * a take keeps with it (the Keep switch): a clip the session has not met yet
 * opens with its kept settings.
 */
/**
 * The clip on screen changes from `previousId` to `nextId`: remember what the
 * clip being left sounded like, and say what the arriving one should get
 * (null when there is no clip to apply to).
 */
export function switchClipPractice(
  saved: Map<string, ClipPracticeSettings>,
  previousId: string | null | undefined,
  live: ClipPracticeSettings,
  nextId: string | null | undefined,
  keptFor?: (clipId: string) => ClipPracticeSettings | undefined
): ClipPracticeSettings | null {
  if (previousId) saved.set(previousId, live);
  if (!nextId) return null;
  return saved.get(nextId) ?? keptFor?.(nextId) ?? NEUTRAL_CLIP_PRACTICE;
}

export function usePerClipPractice({
  clipId,
  current,
  apply,
  keptFor,
}: {
  clipId: string | null | undefined;
  /** This render's live values for the clip on screen. */
  current: ClipPracticeSettings;
  /** Puts a clip's values in force. */
  apply: (settings: ClipPracticeSettings) => void;
  /** What a take keeps with it, read when the session has not met it yet. */
  keptFor?: (clipId: string) => ClipPracticeSettings | undefined;
}) {
  const savedRef = useRef(new Map<string, ClipPracticeSettings>());
  const currentRef = useRef(current);
  currentRef.current = current;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const clipIdRef = useRef<string | null | undefined>(undefined);
  const keptForRef = useRef(keptFor);
  keptForRef.current = keptFor;

  useEffect(() => {
    if (clipId === clipIdRef.current) return;
    const next = switchClipPractice(
      savedRef.current,
      clipIdRef.current,
      currentRef.current,
      clipId,
      keptForRef.current
    );
    clipIdRef.current = clipId;
    if (next) applyRef.current(next);
  }, [clipId]);
}
