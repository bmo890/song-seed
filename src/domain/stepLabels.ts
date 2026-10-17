/** The spark step row's geometry and its fitting rule (SparkFrame.SparkSteps). */
// Fixed geometry of the step row, for fitting the names (must match styles).
export const STEP_NUM = 18;
export const STEP_GAP = 5; // number → name
export const ROW_GAP = 4; // between steps and chevrons
export const CHEVRON = 11;

/** Which step names fit: every one if they can, otherwise drop names furthest
 *  from the current step first (later steps before earlier at equal distance),
 *  never the current one. */
export function visibleStepLabels(
  labelWidths: number[],
  current: number,
  rowWidth: number
): boolean[] {
  const n = labelWidths.length;
  const shown = labelWidths.map(() => true);
  const fixed = n * STEP_NUM + (n - 1) * CHEVRON + (2 * n - 2) * ROW_GAP;
  const width = () =>
    fixed + labelWidths.reduce((sum, w, i) => (shown[i] ? sum + STEP_GAP + w : sum), 0);
  const order = labelWidths
    .map((_, i) => i)
    .filter((i) => i !== current)
    .sort((a, b) => Math.abs(b - current) - Math.abs(a - current) || b - a);
  for (const i of order) {
    if (width() <= rowWidth) break;
    shown[i] = false;
  }
  return shown;
}
