import type { ClipKeptPractice } from "../types";

/**
 * The player's Keep switches (2026-10-21; one per drawer since 2026-10-24):
 * practice settings saved with a take so it opens the way it was left. Pure
 * helpers; the store holds the value on the clip and the player reads and
 * writes it.
 */
type KeptSound = NonNullable<ClipKeptPractice["sound"]>;
type KeptLoop = NonNullable<ClipKeptPractice["loop"]>;
type Region = NonNullable<KeptLoop["region"]>;

const COUNT_INS = new Set<KeptLoop["countIn"]>(["off", "3s", "1b", "2b"]);

function normalizeSound(v: Record<string, unknown>): KeptSound {
  const pitch = typeof v.pitchSemitones === "number" && Number.isFinite(v.pitchSemitones) ? v.pitchSemitones : 0;
  const rate = typeof v.playbackRate === "number" && v.playbackRate > 0 ? v.playbackRate : 1;
  return {
    pitchSemitones: Math.max(-12, Math.min(12, Math.round(pitch))),
    playbackRate: Math.max(0.5, Math.min(2, rate)),
    clickEnabled: v.clickEnabled === true,
  };
}

function normalizeRegion(value: unknown): Region | undefined {
  const r = value as Record<string, unknown> | undefined;
  return r &&
    typeof r.startMs === "number" &&
    typeof r.endMs === "number" &&
    r.endMs > r.startMs &&
    r.startMs >= 0
    ? { startMs: r.startMs, endMs: r.endMs }
    : undefined;
}

function normalizeLoop(countInRaw: unknown, regionRaw: unknown): KeptLoop {
  const countIn = COUNT_INS.has(countInRaw as KeptLoop["countIn"]) ? (countInRaw as KeptLoop["countIn"]) : "off";
  const region = normalizeRegion(regionRaw);
  return { countIn, ...(region ? { region } : {}) };
}

/** A stored value made safe to use, or undefined when there is nothing usable. */
export function normalizeKeptPractice(value: unknown): ClipKeptPractice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  // Before 2026-10-24 one switch kept everything, flat: it reads as both kept.
  if ("pitchSemitones" in v || "playbackRate" in v || "countIn" in v || "clickEnabled" in v) {
    return { sound: normalizeSound(v), loop: normalizeLoop(v.countIn, v.loop) };
  }
  const soundRaw = v.sound && typeof v.sound === "object" ? (v.sound as Record<string, unknown>) : undefined;
  const loopRaw = v.loop && typeof v.loop === "object" ? (v.loop as Record<string, unknown>) : undefined;
  const sound = soundRaw ? normalizeSound(soundRaw) : undefined;
  const loop = loopRaw ? normalizeLoop(loopRaw.countIn, loopRaw.region) : undefined;
  if (!sound && !loop) return undefined;
  return { ...(sound ? { sound } : {}), ...(loop ? { loop } : {}) };
}

function sameSound(a: KeptSound | undefined, b: KeptSound | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.pitchSemitones === b.pitchSemitones &&
    Math.abs(a.playbackRate - b.playbackRate) < 0.001 &&
    a.clickEnabled === b.clickEnabled
  );
}

function sameLoop(a: KeptLoop | undefined, b: KeptLoop | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.countIn === b.countIn &&
    (a.region?.startMs ?? -1) === (b.region?.startMs ?? -1) &&
    (a.region?.endMs ?? -1) === (b.region?.endMs ?? -1)
  );
}

export function sameKeptPractice(a: ClipKeptPractice | undefined, b: ClipKeptPractice | undefined): boolean {
  if (!a || !b) return a === b;
  return sameSound(a.sound, b.sound) && sameLoop(a.loop, b.loop);
}

/** One drawer's Keep flipped: its part joins or leaves, the other is untouched. */
export function toggleKeptPart(
  stored: ClipKeptPractice | undefined,
  part: "sound" | "loop",
  now: { sound: KeptSound; loop: KeptLoop }
): ClipKeptPractice | undefined {
  const next: ClipKeptPractice = { ...stored };
  if (stored?.[part]) delete next[part];
  else if (part === "sound") next.sound = now.sound;
  else next.loop = now.loop;
  return next.sound || next.loop ? next : undefined;
}
