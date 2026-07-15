import type {
  WordLadderExercise,
  WordLadderPairing,
  WordLadderStep,
  WordLadderWord,
} from "../types";

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Column A is always the role's verbs; column B is always the room's nouns. */
export const COLUMN_A_LABEL = "Verbs";
export const COLUMN_B_LABEL = "Nouns";

export const ROLE_SEED_PLACEHOLDER = "e.g. doctor";
export const PLACE_SEED_PLACEHOLDER = "e.g. bedroom";

export function getColumnAPlaceholder(_roleSeed: string) {
  return "Add a verb";
}

export function getColumnBPlaceholder(_placeSeed: string) {
  return "Add a noun";
}

export function deriveExerciseTitle(roleSeed: string, placeSeed: string) {
  const role = roleSeed.trim();
  const place = placeSeed.trim();
  if (role && place) return `The ${role} in the ${place}`;
  if (role) return `The ${role}`;
  if (place) return `The ${place}`;
  return "Untitled Word Ladder";
}

export function createWordLadderExercise(
  roleSeed: string = "",
  placeSeed: string = ""
): WordLadderExercise {
  const now = Date.now();
  return {
    id: randomId("ladder"),
    title: deriveExerciseTitle(roleSeed, placeSeed),
    createdAt: now,
    updatedAt: now,
    step: "setup",
    roleSeed,
    placeSeed,
    columnA: [],
    columnB: [],
    pairings: [],
    seenHelpSteps: [],
    usedSparkIds: [],
    draft: "",
    revision: "",
  };
}

/** A pairing's two words, looked up for display as a spark in the poem step. */
export function pairingSeedWords(
  pairing: WordLadderPairing,
  columnA: WordLadderWord[],
  columnB: WordLadderWord[]
): { seedA: string; seedB: string } | null {
  const wordA = columnA.find((w) => w.id === pairing.columnAWordId);
  const wordB = columnB.find((w) => w.id === pairing.columnBWordId);
  if (!wordA || !wordB) return null;
  return { seedA: wordA.text, seedB: wordB.text };
}

export function addWord(words: WordLadderWord[], text: string): WordLadderWord[] {
  const trimmed = text.trim();
  if (!trimmed) return words;
  return [...words, { id: randomId("word"), text: trimmed }];
}

export function updateWordText(words: WordLadderWord[], wordId: string, text: string): WordLadderWord[] {
  return words.map((word) => (word.id === wordId ? { ...word, text } : word));
}

export function removeWord(words: WordLadderWord[], wordId: string): WordLadderWord[] {
  return words.filter((word) => word.id !== wordId);
}

/** Drops any pairing that references a word no longer present in either column. */
export function dropPairingsForRemovedWords(
  pairings: WordLadderPairing[],
  columnA: WordLadderWord[],
  columnB: WordLadderWord[]
): WordLadderPairing[] {
  const aIds = new Set(columnA.map((w) => w.id));
  const bIds = new Set(columnB.map((w) => w.id));
  return pairings.filter((p) => aIds.has(p.columnAWordId) && bIds.has(p.columnBWordId));
}

export function createPairing(columnAWordId: string, columnBWordId: string): WordLadderPairing {
  return { id: randomId("pair"), columnAWordId, columnBWordId, locked: false };
}

export function getUnpairedWords(words: WordLadderWord[], pairings: WordLadderPairing[], column: "a" | "b") {
  const pairedIds = new Set(
    pairings.map((p) => (column === "a" ? p.columnAWordId : p.columnBWordId))
  );
  return words.filter((word) => !pairedIds.has(word.id));
}

export function toggleLock(pairings: WordLadderPairing[], pairingId: string): WordLadderPairing[] {
  return pairings.map((p) => (p.id === pairingId ? { ...p, locked: !p.locked } : p));
}

export function removePairing(pairings: WordLadderPairing[], pairingId: string): WordLadderPairing[] {
  return pairings.filter((p) => p.id !== pairingId);
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Reshuffles only the unlocked pairings, redistributing across whatever
 * Column A / Column B words aren't already claimed by a locked pairing.
 * Locked pairings are left untouched. Leftover words (uneven column
 * lengths) simply go unpaired — never forced together. */
export function shufflePairings(exercise: Pick<WordLadderExercise, "columnA" | "columnB" | "pairings">) {
  const locked = exercise.pairings.filter((p) => p.locked);
  const lockedAIds = new Set(locked.map((p) => p.columnAWordId));
  const lockedBIds = new Set(locked.map((p) => p.columnBWordId));

  const freeA = shuffle(exercise.columnA.filter((w) => !lockedAIds.has(w.id)));
  const freeB = shuffle(exercise.columnB.filter((w) => !lockedBIds.has(w.id)));

  const reshuffled: WordLadderPairing[] = [];
  const count = Math.min(freeA.length, freeB.length);
  for (let i = 0; i < count; i++) {
    reshuffled.push(createPairing(freeA[i].id, freeB[i].id));
  }

  return [...locked, ...reshuffled];
}

export function exerciseSummary(exercise: WordLadderExercise) {
  const pairCount = exercise.pairings.length;
  const parts = [`${pairCount} pair${pairCount === 1 ? "" : "s"}`];
  if (exercise.revision.trim()) parts.push("revised");
  else if (exercise.draft.trim()) parts.push("draft started");
  return parts.join(" · ");
}

// ── Defensive sanitization (persisted data may be partial/corrupt) ─────────

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string";
}

function sanitizeWords(raw: unknown): WordLadderWord[] {
  if (!Array.isArray(raw)) return [];
  const out: WordLadderWord[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && isNonEmptyString((item as any).id) && isNonEmptyString((item as any).text)) {
      out.push({ id: (item as any).id, text: (item as any).text });
    }
  }
  return out;
}

function sanitizePairings(raw: unknown, columnA: WordLadderWord[], columnB: WordLadderWord[]): WordLadderPairing[] {
  if (!Array.isArray(raw)) return [];
  const aIds = new Set(columnA.map((w) => w.id));
  const bIds = new Set(columnB.map((w) => w.id));
  const out: WordLadderPairing[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      isNonEmptyString((item as any).id) &&
      isNonEmptyString((item as any).columnAWordId) &&
      isNonEmptyString((item as any).columnBWordId) &&
      aIds.has((item as any).columnAWordId) &&
      bIds.has((item as any).columnBWordId)
    ) {
      out.push({
        id: (item as any).id,
        columnAWordId: (item as any).columnAWordId,
        columnBWordId: (item as any).columnBWordId,
        locked: (item as any).locked === true,
      });
    }
  }
  return out;
}

/** Migration: the draft once lived under `poem`, and before that as an array of
 * per-pair `lines`; fold whichever exists into the draft so nothing is lost. */
function sanitizeDraft(draftRaw: unknown, poemRaw: unknown, legacyLines: unknown): string {
  if (isNonEmptyString(draftRaw)) return draftRaw;
  if (isNonEmptyString(poemRaw)) return poemRaw;
  if (Array.isArray(legacyLines)) {
    const texts = legacyLines
      .map((item) =>
        item && typeof item === "object" && isNonEmptyString((item as any).text)
          ? (item as any).text.trim()
          : ""
      )
      .filter((text) => text.length > 0);
    if (texts.length > 0) return texts.join("\n");
  }
  return "";
}

export function sanitizeWordLadderExercise(raw: unknown): WordLadderExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.id)) return null;

  const columnA = sanitizeWords(obj.columnA);
  const columnB = sanitizeWords(obj.columnB);

  // Migration: older exercises stored a single `seedLabel` under a `mode`
  // toggle ("role" | "place"). Fold that value into whichever new seed matches.
  const legacySeed = isNonEmptyString(obj.seedLabel) ? obj.seedLabel : "";
  const roleSeed = isNonEmptyString(obj.roleSeed)
    ? obj.roleSeed
    : obj.mode === "place"
      ? ""
      : legacySeed;
  const placeSeed = isNonEmptyString(obj.placeSeed)
    ? obj.placeSeed
    : obj.mode === "place"
      ? legacySeed
      : "";

  // Map legacy final-step keys ("poem", "lines") onto the new "draft" step.
  const step: WordLadderStep =
    obj.step === "pairs"
      ? "pairs"
      : obj.step === "revise"
        ? "revise"
        : obj.step === "draft" || obj.step === "poem" || obj.step === "lines"
          ? "draft"
          : "setup";

  return {
    id: obj.id,
    title: isNonEmptyString(obj.title) && obj.title.trim() ? obj.title : "Untitled Word Ladder",
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    step,
    roleSeed,
    placeSeed,
    columnA,
    columnB,
    pairings: sanitizePairings(obj.pairings, columnA, columnB),
    seenHelpSteps: Array.isArray(obj.seenHelpSteps)
      ? obj.seenHelpSteps.filter(
          (s): s is WordLadderStep =>
            s === "setup" || s === "pairs" || s === "draft" || s === "revise"
        )
      : [],
    usedSparkIds: Array.isArray(obj.usedSparkIds)
      ? obj.usedSparkIds.filter((id): id is string => isNonEmptyString(id))
      : [],
    draft: sanitizeDraft(obj.draft, obj.poem, obj.lines),
    revision: isNonEmptyString(obj.revision) ? obj.revision : "",
  };
}

export function sanitizeWordLadders(raw: unknown): WordLadderExercise[] {
  if (!Array.isArray(raw)) return [];
  const out: WordLadderExercise[] = [];
  for (const item of raw) {
    const sanitized = sanitizeWordLadderExercise(item);
    if (sanitized) out.push(sanitized);
  }
  return out;
}
