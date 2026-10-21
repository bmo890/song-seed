import type { ClipKeptPractice } from "../types";

/**
 * The player's Keep switch (2026-10-21): practice settings saved with a take so
 * it opens the way it was left. Pure helpers; the store holds the value on the
 * clip and the player reads and writes it.
 */
const COUNT_INS = new Set<ClipKeptPractice["countIn"]>(["off", "3s", "1b", "2b"]);

/** A stored value made safe to use, or undefined when there is nothing usable. */
export function normalizeKeptPractice(value: unknown): ClipKeptPractice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const pitch = typeof v.pitchSemitones === "number" && Number.isFinite(v.pitchSemitones) ? v.pitchSemitones : 0;
  const rate = typeof v.playbackRate === "number" && v.playbackRate > 0 ? v.playbackRate : 1;
  const countIn = COUNT_INS.has(v.countIn as ClipKeptPractice["countIn"])
    ? (v.countIn as ClipKeptPractice["countIn"])
    : "off";
  const loopRaw = v.loop as Record<string, unknown> | undefined;
  const loop =
    loopRaw &&
    typeof loopRaw.startMs === "number" &&
    typeof loopRaw.endMs === "number" &&
    loopRaw.endMs > loopRaw.startMs &&
    loopRaw.startMs >= 0
      ? { startMs: loopRaw.startMs, endMs: loopRaw.endMs }
      : undefined;
  return {
    pitchSemitones: Math.max(-12, Math.min(12, Math.round(pitch))),
    playbackRate: Math.max(0.5, Math.min(2, rate)),
    clickEnabled: v.clickEnabled === true,
    countIn,
    ...(loop ? { loop } : {}),
  };
}

export function sameKeptPractice(a: ClipKeptPractice | undefined, b: ClipKeptPractice | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.pitchSemitones === b.pitchSemitones &&
    Math.abs(a.playbackRate - b.playbackRate) < 0.001 &&
    a.clickEnabled === b.clickEnabled &&
    a.countIn === b.countIn &&
    (a.loop?.startMs ?? -1) === (b.loop?.startMs ?? -1) &&
    (a.loop?.endMs ?? -1) === (b.loop?.endMs ?? -1)
  );
}
