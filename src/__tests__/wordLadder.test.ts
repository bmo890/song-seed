import {
  addWord,
  createPairing,
  createWordLadderExercise,
  dropPairingsForRemovedWords,
  getUnpairedWords,
  pairingSeedWords,
  removeWord,
  sanitizeWordLadderExercise,
  sanitizeWordLadders,
  shufflePairings,
  toggleLock,
} from "../domain/wordLadder";
import type { WordLadderExercise } from "../types";

describe("createWordLadderExercise", () => {
  it("starts empty, holding the role and place seeds", () => {
    const exercise = createWordLadderExercise("astronaut", "chapel");
    expect(exercise.roleSeed).toBe("astronaut");
    expect(exercise.placeSeed).toBe("chapel");
    expect(exercise.title).toBe("The astronaut in the chapel");
    expect(exercise.step).toBe("setup");
    expect(exercise.columnA).toEqual([]);
    expect(exercise.columnB).toEqual([]);
    expect(exercise.pairings).toEqual([]);
    expect(exercise.draft).toBe("");
    expect(exercise.revision).toBe("");
  });

  it("derives a title from whichever seeds are present", () => {
    expect(createWordLadderExercise("thief", "").title).toBe("The thief");
    expect(createWordLadderExercise("", "basement").title).toBe("The basement");
    expect(createWordLadderExercise("", "").title).toBe("Untitled Word Ladder");
  });
});

describe("word list editing", () => {
  it("adds and removes words, ignoring blank input", () => {
    let words = addWord([], "heal");
    words = addWord(words, "listen");
    words = addWord(words, "  ");
    expect(words.map((w) => w.text)).toEqual(["heal", "listen"]);

    const [first] = words;
    words = removeWord(words, first.id);
    expect(words.map((w) => w.text)).toEqual(["listen"]);
  });
});

describe("pairing + shuffle", () => {
  function buildSeededExercise(): WordLadderExercise {
    let columnA = addWord([], "heal");
    columnA = addWord(columnA, "listen");
    columnA = addWord(columnA, "drive");
    let columnB = addWord([], "guitar");
    columnB = addWord(columnB, "window");
    columnB = addWord(columnB, "highway");

    const exercise = createWordLadderExercise("drummer", "garage");
    return { ...exercise, columnA, columnB };
  }

  it("creates a pairing referencing both column word ids", () => {
    const exercise = buildSeededExercise();
    const pairing = createPairing(exercise.columnA[0].id, exercise.columnB[0].id);
    expect(pairing.columnAWordId).toBe(exercise.columnA[0].id);
    expect(pairing.columnBWordId).toBe(exercise.columnB[0].id);
    expect(pairing.locked).toBe(false);
  });

  it("reports unpaired words for each column", () => {
    const exercise = buildSeededExercise();
    const pairing = createPairing(exercise.columnA[0].id, exercise.columnB[0].id);
    const unpairedA = getUnpairedWords(exercise.columnA, [pairing], "a");
    const unpairedB = getUnpairedWords(exercise.columnB, [pairing], "b");
    expect(unpairedA.map((w) => w.id)).toEqual([exercise.columnA[1].id, exercise.columnA[2].id]);
    expect(unpairedB.map((w) => w.id)).toEqual([exercise.columnB[1].id, exercise.columnB[2].id]);
  });

  it("never moves a locked pairing during shuffle, regardless of how many times it runs", () => {
    const exercise = buildSeededExercise();
    const locked = { ...createPairing(exercise.columnA[0].id, exercise.columnB[0].id), locked: true };
    let pairings = [locked];

    for (let i = 0; i < 25; i++) {
      pairings = shufflePairings({ ...exercise, pairings });
      const stillLocked = pairings.find((p) => p.id === locked.id);
      expect(stillLocked).toBeDefined();
      expect(stillLocked?.columnAWordId).toBe(locked.columnAWordId);
      expect(stillLocked?.columnBWordId).toBe(locked.columnBWordId);
      expect(stillLocked?.locked).toBe(true);
    }
  });

  it("never re-pairs an already-locked word into a second pairing", () => {
    const exercise = buildSeededExercise();
    const locked = { ...createPairing(exercise.columnA[0].id, exercise.columnB[0].id), locked: true };
    const pairings = shufflePairings({ ...exercise, pairings: [locked] });

    const aUsage = new Map<string, number>();
    const bUsage = new Map<string, number>();
    for (const p of pairings) {
      aUsage.set(p.columnAWordId, (aUsage.get(p.columnAWordId) ?? 0) + 1);
      bUsage.set(p.columnBWordId, (bUsage.get(p.columnBWordId) ?? 0) + 1);
    }
    for (const count of [...aUsage.values(), ...bUsage.values()]) {
      expect(count).toBe(1);
    }
  });

  it("toggles a pairing's lock without touching others", () => {
    const exercise = buildSeededExercise();
    const a = createPairing(exercise.columnA[0].id, exercise.columnB[0].id);
    const b = createPairing(exercise.columnA[1].id, exercise.columnB[1].id);
    const toggled = toggleLock([a, b], a.id);
    expect(toggled.find((p) => p.id === a.id)?.locked).toBe(true);
    expect(toggled.find((p) => p.id === b.id)?.locked).toBe(false);
  });

  it("drops pairings that reference a word removed from either column", () => {
    const exercise = buildSeededExercise();
    const pairing = createPairing(exercise.columnA[0].id, exercise.columnB[0].id);
    const columnAAfterRemoval = removeWord(exercise.columnA, exercise.columnA[0].id);
    const next = dropPairingsForRemovedWords([pairing], columnAAfterRemoval, exercise.columnB);
    expect(next).toEqual([]);
  });
});

describe("pairingSeedWords", () => {
  it("resolves a pairing to its two spark words", () => {
    const columnA = addWord([], "heal");
    const columnB = addWord([], "guitar");
    const pairing = createPairing(columnA[0].id, columnB[0].id);

    expect(pairingSeedWords(pairing, columnA, columnB)).toEqual({ seedA: "heal", seedB: "guitar" });
  });

  it("returns null when a paired word is missing from its column", () => {
    const columnA = addWord([], "heal");
    const columnB = addWord([], "guitar");
    const pairing = createPairing("missing", columnB[0].id);
    expect(pairingSeedWords(pairing, columnA, columnB)).toBeNull();
  });
});

describe("sanitizeWordLadderExercise", () => {
  it("passes through a well-formed exercise", () => {
    const exercise = createWordLadderExercise("ghost", "attic");
    expect(sanitizeWordLadderExercise(exercise)).toEqual(exercise);
  });

  it("rejects non-objects and objects missing an id", () => {
    expect(sanitizeWordLadderExercise(null)).toBeNull();
    expect(sanitizeWordLadderExercise("not an exercise")).toBeNull();
    expect(sanitizeWordLadderExercise({ title: "no id" })).toBeNull();
  });

  it("repairs a partially-completed exercise instead of crashing", () => {
    const partial = {
      id: "ladder-1",
      columnA: [{ id: "a1", text: "heal" }],
      // columnB, pairings, draft, title, seeds, timestamps all missing
    };
    const sanitized = sanitizeWordLadderExercise(partial);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.columnB).toEqual([]);
    expect(sanitized?.pairings).toEqual([]);
    expect(sanitized?.draft).toBe("");
    expect(sanitized?.revision).toBe("");
    expect(sanitized?.title).toBe("Untitled Word Ladder");
    expect(sanitized?.roleSeed).toBe("");
    expect(sanitized?.placeSeed).toBe("");
    expect(sanitized?.step).toBe("setup");
  });

  it("preserves valid steps and maps legacy final-step keys onto 'draft'", () => {
    expect(sanitizeWordLadderExercise({ id: "s1", step: "pairs" })?.step).toBe("pairs");
    expect(sanitizeWordLadderExercise({ id: "s2", step: "draft" })?.step).toBe("draft");
    expect(sanitizeWordLadderExercise({ id: "s3", step: "revise" })?.step).toBe("revise");
    expect(sanitizeWordLadderExercise({ id: "s4", step: "poem" })?.step).toBe("draft");
    expect(sanitizeWordLadderExercise({ id: "s5", step: "lines" })?.step).toBe("draft");
    expect(sanitizeWordLadderExercise({ id: "s6", step: "nonsense" })?.step).toBe("setup");
  });

  it("migrates a legacy poem, then legacy per-pair lines, into the draft", () => {
    expect(sanitizeWordLadderExercise({ id: "p1", poem: "a kept poem" })?.draft).toBe("a kept poem");

    const legacyLines = {
      id: "ladder-legacy-lines",
      lines: [
        { id: "l1", text: "the bottle heals" },
        { id: "l2", text: "  " },
        { id: "l3", text: "the window listens" },
      ],
    };
    expect(sanitizeWordLadderExercise(legacyLines)?.draft).toBe(
      "the bottle heals\nthe window listens"
    );
  });

  it("migrates legacy role-mode data into the role seed", () => {
    const legacy = { id: "ladder-old-role", mode: "role", seedLabel: "doctor" };
    const sanitized = sanitizeWordLadderExercise(legacy);
    expect(sanitized?.roleSeed).toBe("doctor");
    expect(sanitized?.placeSeed).toBe("");
  });

  it("migrates legacy place-mode data into the place seed", () => {
    const legacy = { id: "ladder-old-place", mode: "place", seedLabel: "chapel" };
    const sanitized = sanitizeWordLadderExercise(legacy);
    expect(sanitized?.roleSeed).toBe("");
    expect(sanitized?.placeSeed).toBe("chapel");
  });

  it("drops a pairing that references a word id no longer present in either column", () => {
    const malformed = {
      id: "ladder-2",
      columnA: [{ id: "a1", text: "heal" }],
      columnB: [{ id: "b1", text: "guitar" }],
      pairings: [
        { id: "p1", columnAWordId: "a1", columnBWordId: "b1", locked: false },
        { id: "p2", columnAWordId: "missing", columnBWordId: "b1", locked: false },
      ],
    };
    const sanitized = sanitizeWordLadderExercise(malformed);
    expect(sanitized?.pairings).toEqual([
      { id: "p1", columnAWordId: "a1", columnBWordId: "b1", locked: false },
    ]);
  });
});

describe("sanitizeWordLadders", () => {
  it("filters out garbage entries and keeps valid ones", () => {
    const valid = createWordLadderExercise("thief", "vault");
    const result = sanitizeWordLadders([valid, null, "garbage", 42, { noId: true }]);
    expect(result).toEqual([valid]);
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeWordLadders(undefined)).toEqual([]);
    expect(sanitizeWordLadders({})).toEqual([]);
  });
});
