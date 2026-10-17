import { visibleStepLabels } from "../stepLabels";

// Five steps, 18 pt dots, 11 pt chevrons, 4 pt row gaps, 5 pt dot→name gap:
// fixed = 5*18 + 4*11 + 8*4 = 166.
const words = [40, 44, 30, 36, 44]; // Verbs, Nouns, Pair, Draft, Revise

test("every name shows when they all fit", () => {
  expect(visibleStepLabels(words, 1, 500)).toEqual([true, true, true, true, true]);
});

test("names drop furthest-first, never the current step", () => {
  // all names need 166 + 5*5 + 194 = 385; one dropped is enough at 350
  expect(visibleStepLabels(words, 0, 350)).toEqual([true, true, true, true, false]);
  expect(visibleStepLabels(words, 4, 350)).toEqual([false, true, true, true, true]);
});

test("at equal distance the later step loses its name first", () => {
  expect(visibleStepLabels(words, 2, 350)).toEqual([true, true, true, true, false]);
});

test("a very narrow row keeps only the current name", () => {
  expect(visibleStepLabels(words, 2, 100)).toEqual([false, false, true, false, false]);
});
