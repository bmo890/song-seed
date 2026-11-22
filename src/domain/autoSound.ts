import type { NativeSoundAnalysis } from "../../modules/songnook-pitch-shift";
import { clampSoundLevelDb, formatToneFlags, type OverdubToneFlag } from "./overdub";

/**
 * The Sound drawer's Auto (founder, 2026-11-22: "scans the raw audio, levels out things
 * to a more balanced and desirable level. This would help when recording a rehearsal").
 *
 * Auto only sets the controls the drawer already has, where you can see them: the level,
 * and the Low cut and Hi cut keys. The file is never touched. What it listens for:
 *
 *   Level    the take's loudness, measured over the parts that are playing (quiet gaps
 *            and silence don't drag it down), brought toward a comfortable level. The
 *            engine's limiter catches the peaks a lift pushes over, but never more than
 *            a few dB of them, so a loud drum hit can't decide the whole level.
 *   Low cut  rumble: a large share of the sound below ~60 Hz (thumps on the table, a
 *            hand on the phone, a room's boom, air conditioning).
 *   Hi cut   harshness (a large share above ~6 kHz while it plays: cymbals close to the
 *            phone) or hiss (the quiet parts are mostly high noise, loud enough to hear
 *            once the level comes up).
 *
 * Low boost and Mid boost are matters of taste, so Auto leaves them off. Gentle
 * compression (evening out a loud drum kit against a quiet voice) is the next step and
 * not part of this.
 */
export type AutoSound = { gainDb: number; tonePreset: string };

/** Where the level lands: a lively phone-take loudness, not mastered-loud. */
export const AUTO_TARGET_DB = -18;
/** The limiter may take at most this much off the loudest peak after the lift. */
const LIMITER_ALLOWANCE_DB = 6;
/** Peaks aim just under full scale. */
const PEAK_CEILING_DB = -1;
/** Quieter windows are silence: they say nothing about the take. */
const SILENCE_DB = -60;
/** Windows this far below the take's average loudness are gaps, not playing. */
const GATE_DB = 10;
/** A level change smaller than this isn't worth making. */
const MIN_CHANGE_DB = 2;
/** Shares of the playing's energy (power ratios). */
const RUMBLE_SHARE = 0.25;
const HARSH_SHARE = 0.25;
const HISS_SHARE = 0.5;
/** Hiss this loud after the lift is heard. */
const AUDIBLE_HISS_DB = -50;

const toDb = (linear: number) => 20 * Math.log10(Math.max(linear, 1e-9));
const powerDb = (power: number) => 10 * Math.log10(Math.max(power, 1e-18));

/** What Auto would set, or null when there is nothing to hear (a silent clip). */
export function decideAutoSound(analysis: NativeSoundAnalysis): AutoSound | null {
  const count = Math.min(analysis.rms.length, analysis.sub.length, analysis.high.length);
  const sounding: number[] = [];
  for (let i = 0; i < count; i++) if (toDb(analysis.rms[i]) > SILENCE_DB) sounding.push(i);
  if (sounding.length === 0) return null;

  const meanPower = (indices: number[], series: number[]) =>
    indices.reduce((sum, i) => sum + series[i] * series[i], 0) / Math.max(1, indices.length);

  // Gate out the gaps, the way loudness meters do: measure the playing.
  const ungatedDb = powerDb(meanPower(sounding, analysis.rms));
  const playing = sounding.filter((i) => toDb(analysis.rms[i]) >= ungatedDb - GATE_DB);
  const playingPower = meanPower(playing, analysis.rms);
  const loudnessDb = powerDb(playingPower);

  // Level: toward the target, held back so the limiter never takes more than its share.
  const peakDb = toDb(analysis.peak);
  const peakRoom = PEAK_CEILING_DB - peakDb + LIMITER_ALLOWANCE_DB;
  let gain = Math.min(AUTO_TARGET_DB - loudnessDb, peakRoom);
  if (Math.abs(gain) < MIN_CHANGE_DB) gain = 0;
  const gainDb = clampSoundLevelDb(gain);

  const flags: OverdubToneFlag[] = [];
  if (meanPower(playing, analysis.sub) / playingPower > RUMBLE_SHARE) flags.push("low-cut");

  const harsh = meanPower(playing, analysis.high) / playingPower > HARSH_SHARE;
  // The quiet parts: sounding, but below the playing. Hiss lives there.
  const quiet = sounding.filter((i) => toDb(analysis.rms[i]) < ungatedDb - GATE_DB);
  let hiss = false;
  if (quiet.length > 0) {
    const quietPower = meanPower(quiet, analysis.rms);
    const quietHighShare = meanPower(quiet, analysis.high) / Math.max(quietPower, 1e-18);
    hiss = quietHighShare > HISS_SHARE && powerDb(quietPower) + gainDb > AUDIBLE_HISS_DB;
  }
  if (harsh || hiss) flags.push("hi-cut");

  return { gainDb, tonePreset: formatToneFlags(flags) };
}
