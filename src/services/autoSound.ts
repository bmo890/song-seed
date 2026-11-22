import SongNookPitchShiftModule from "../../modules/songnook-pitch-shift";
import { decideAutoSound, type AutoSound } from "../domain/autoSound";

/**
 * The Sound drawer's Auto: measure a clip natively (one decode pass), then decide
 * (domain/autoSound.ts). Measured once per file per session: a file's sound never
 * changes, and a long rehearsal takes a few seconds to read.
 */
const measured = new Map<string, Promise<AutoSound | null>>();

/** The native measurer is in this build (a newer binary than the JS can be). */
export function isAutoSoundAvailable(): boolean {
  return typeof SongNookPitchShiftModule?.analyzeSound === "function";
}

/** What Auto would set for this file, or null when there is nothing to hear. Rejects
 *  when the file can't be read. */
export function suggestAutoSound(audioUri: string): Promise<AutoSound | null> {
  const known = measured.get(audioUri);
  if (known) return known;
  const analyze = SongNookPitchShiftModule?.analyzeSound;
  if (!analyze) return Promise.reject(new Error("Sound analysis is not in this build."));
  const pending = analyze({ inputUri: audioUri }).then(decideAutoSound);
  measured.set(audioUri, pending);
  // A failed read is not remembered: the next tap tries again.
  pending.catch(() => measured.delete(audioUri));
  return pending;
}
