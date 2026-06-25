import type {
  WordLadderExercise,
  WordLadderLine,
  WordLadderMode,
  WordLadderPairing,
  WordLadderWord,
} from "./types";

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getColumnALabel(mode: WordLadderMode) {
  return mode === "role" ? "Verbs" : "Adjectives";
}

export function getColumnBLabel() {
  return "Nouns";
}

export function getSeedPlaceholder(mode: WordLadderMode) {
  return mode === "role" ? "doctor, astronaut, thief…" : "bedroom, highway, chapel…";
}

export function getColumnAPlaceholder(mode: WordLadderMode) {
  return mode === "role" ? "A verb this role does" : "An adjective for this place";
}

export function deriveExerciseTitle(mode: WordLadderMode, seedLabel: string) {
  const trimmed = seedLabel.trim();
  if (!trimmed) return "Untitled Word Ladder";
  return mode === "role" ? `The ${trimmed}` : trimmed.replace(/^the\s+/i, (m) => m);
}

export function createWordLadderExercise(
  mode: WordLadderMode = "role",
  seedLabel: string = ""
): WordLadderExercise {
  const now = Date.now();
  return {
    id: randomId("ladder"),
    title: deriveExerciseTitle(mode, seedLabel),
    createdAt: now,
    updatedAt: now,
    mode,
    seedLabel,
    columnALabel: getColumnALabel(mode),
    columnA: [],
    columnB: [],
    pairings: [],
    lines: [],
  };
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

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function conjugateThirdPerson(verb: string): string {
  const v = verb.trim().toLowerCase();
  if (!v) return v;
  if (v.endsWith("y") && v.length > 1 && !VOWELS.has(v[v.length - 2])) {
    return `${v.slice(0, -1)}ies`;
  }
  if (/(s|sh|ch|x|z|o)$/.test(v)) {
    return `${v}es`;
  }
  return `${v}s`;
}

/** Naive line-seed templating — deliberately mechanical (no AI), just enough
 * of a nudge to spark an edit. "heal" + "guitar" -> "the guitar heals". */
export function buildLineTextFromPairing(
  mode: WordLadderMode,
  columnAText: string,
  columnBText: string
): string {
  const noun = columnBText.trim().toLowerCase();
  const other = columnAText.trim().toLowerCase();
  if (!noun || !other) return "";

  if (mode === "role") {
    return `the ${noun} ${conjugateThirdPerson(other)}`;
  }
  return `the ${other} ${noun}`;
}

export function createLineFromPairing(
  mode: WordLadderMode,
  pairing: WordLadderPairing,
  columnA: WordLadderWord[],
  columnB: WordLadderWord[]
): WordLadderLine | null {
  const wordA = columnA.find((w) => w.id === pairing.columnAWordId);
  const wordB = columnB.find((w) => w.id === pairing.columnBWordId);
  if (!wordA || !wordB) return null;
  return {
    id: randomId("line"),
    text: buildLineTextFromPairing(mode, wordA.text, wordB.text),
    pairingId: pairing.id,
    starred: false,
  };
}

export function exerciseSummary(exercise: WordLadderExercise) {
  const lineCount = exercise.lines.length;
  const pairCount = exercise.pairings.length;
  const parts = [`${pairCount} pair${pairCount === 1 ? "" : "s"}`];
  if (lineCount > 0) parts.push(`${lineCount} line${lineCount === 1 ? "" : "s"}`);
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

function sanitizeLines(raw: unknown): WordLadderLine[] {
  if (!Array.isArray(raw)) return [];
  const out: WordLadderLine[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && isNonEmptyString((item as any).id) && isNonEmptyString((item as any).text)) {
      out.push({
        id: (item as any).id,
        text: (item as any).text,
        pairingId: isNonEmptyString((item as any).pairingId) ? (item as any).pairingId : null,
        starred: (item as any).starred === true,
      });
    }
  }
  return out;
}

export function sanitizeWordLadderExercise(raw: unknown): WordLadderExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.id)) return null;

  const mode: WordLadderMode = obj.mode === "place" ? "place" : "role";
  const columnA = sanitizeWords(obj.columnA);
  const columnB = sanitizeWords(obj.columnB);

  return {
    id: obj.id,
    title: isNonEmptyString(obj.title) && obj.title.trim() ? obj.title : "Untitled Word Ladder",
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    mode,
    seedLabel: isNonEmptyString(obj.seedLabel) ? obj.seedLabel : "",
    columnALabel: isNonEmptyString(obj.columnALabel) ? obj.columnALabel : getColumnALabel(mode),
    columnA,
    columnB,
    pairings: sanitizePairings(obj.pairings, columnA, columnB),
    lines: sanitizeLines(obj.lines),
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
