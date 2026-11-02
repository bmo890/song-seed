/**
 * Dates of what the editor produces (07-M3, 2026-11-02).
 *
 * A Replace is the same recording, trimmed: it keeps when it was recorded (and
 * so its place in the take list, the sketch's created date, its date group
 * and the lyrics "edited since this take" check). Only Save-as-new is a new
 * thing made now. Several parts from one Replace keep the source's moment,
 * a millisecond apart so their order holds.
 */
export function editResultCreatedAt(options: {
  replace: boolean;
  sourceCreatedAt: number | undefined;
  now: number;
  index: number;
}): number {
  const { replace, sourceCreatedAt, now, index } = options;
  if (replace && typeof sourceCreatedAt === "number" && Number.isFinite(sourceCreatedAt)) {
    return sourceCreatedAt + index;
  }
  return now + index;
}
