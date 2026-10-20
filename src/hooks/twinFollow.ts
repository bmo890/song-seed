/**
 * The muted twin (useNativePitchTransport) runs the same clip as the pitch
 * engine so the dock, lock screen and headset stay truthful. Its position can
 * move for two very different reasons, and the engine must only follow one:
 *
 *  - a scrub: someone dragged the lock-screen bar, so the twin JUMPED. The
 *    engine, which is what you hear, follows it.
 *  - drift: two clocks running side by side slowly part (or the engine stalls).
 *    The engine is the truth; the silent twin is pulled back to it. Following
 *    drift would make what you hear skip.
 *
 * A jump is told from drift by where the twin should be by now, not by how far
 * it is from the engine.
 */
export type TwinMove = "scrub" | "drift" | "none";

/** How far the twin must land from where it should be to count as a scrub. */
export const TWIN_JUMP_MS = 2000;
/** How far the twin may wander from the engine before it is pulled back. */
export const TWIN_DRIFT_MS = 1500;

export function classifyTwinMove(input: {
  previousMs: number;
  previousAt: number;
  positionMs: number;
  at: number;
  /** The twin's rate while it plays; 0 while paused. */
  rate: number;
  engineMs: number;
}): TwinMove {
  const expectedMs = input.previousMs + Math.max(0, input.at - input.previousAt) * input.rate;
  if (Math.abs(input.positionMs - expectedMs) >= TWIN_JUMP_MS) return "scrub";
  if (Math.abs(input.positionMs - input.engineMs) >= TWIN_DRIFT_MS) return "drift";
  return "none";
}
