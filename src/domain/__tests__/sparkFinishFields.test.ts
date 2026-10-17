import { sanitizeWordLadderExercise } from "../wordLadder";
import { sanitizeCutUpSpark } from "../cutUp";
import { sanitizeMagpieSpark } from "../magpie";

// 2026-10-17: finishing keeps a spark (finishedAt) and sending records the
// Lyric Pad page (savedLyricId). Both must survive a reload; Word Ladder's
// sanitizer used to drop savedLyricId.
const fields = { finishedAt: 1_700_000_000_000, savedLyricId: "note-1" };

test.each([
  ["Word Ladder", () => sanitizeWordLadderExercise({ id: "w", ...fields })],
  ["Cut-Up", () => sanitizeCutUpSpark({ id: "c", ...fields })],
  ["Borrowed Words", () => sanitizeMagpieSpark({ id: "m", ...fields })],
])("%s keeps finishedAt and savedLyricId", (_name, run) => {
  const spark = run();
  expect(spark?.finishedAt).toBe(fields.finishedAt);
  expect(spark?.savedLyricId).toBe("note-1");
});

test("junk finishedAt is dropped", () => {
  expect(sanitizeWordLadderExercise({ id: "w", finishedAt: "soon" })?.finishedAt).toBeUndefined();
});
