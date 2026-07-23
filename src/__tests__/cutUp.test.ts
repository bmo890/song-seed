import {
  assembleDraftText,
  buildBoardItems,
  createCutUpSpark,
  generateChunks,
  generateChunksFromSeams,
  joinSelectedLines,
  mergeChunkWithNext,
  reconcileBoard,
  reorderBoard,
  resetBoardOrder,
  sanitizeCutUpSpark,
  seedCutSeams,
  setBoardItemRemoved,
  shuffleBoard,
  splitBoardItemByTexts,
  splitChunk,
  splitSourceLines,
  stripStripPunctuation,
  toggleChunkIncluded,
  toggleStanzaSelection,
  unitGroups,
  tokenizeWords,
  assembleDraftFromCanvas,
  canvasLines,
  canvasNeedsDeal,
  canvasScrapTexts,
  dealCanvas,
  moveCanvasScrap,
  nextFreeBand,
  shuffleCanvas,
  packSourceLines,
  poolAllScraps,
  restorePooledScraps,
} from "../domain/cutUp";
import type { CutUpBoardItem } from "../types";

const SOURCE = "the doctor waits, by the window\nlistening to the rain";

describe("generateChunks", () => {
  it("phrase mode prefers comma boundaries and produces no empty chunks", () => {
    const chunks = generateChunks(SOURCE, "phrase");
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
    // The comma after "waits" should close a phrase.
    expect(chunks.some((c) => c.text === "the doctor waits,")).toBe(true);
    expect(chunks.every((c) => c.included)).toBe(true);
  });

  it("line mode splits on non-empty lines only", () => {
    const chunks = generateChunks("alpha\n\n  \nbeta", "line");
    expect(chunks.map((c) => c.text)).toEqual(["alpha", "beta"]);
  });

  it("word mode keeps punctuation attached to each word", () => {
    const chunks = generateChunks("hold on, tight", "word");
    expect(chunks.map((c) => c.text)).toEqual(["hold", "on,", "tight"]);
  });

  it("phrase mode recognizes Hebrew sentence punctuation", () => {
    const chunks = generateChunks("שורה ראשונה׃ שורה שנייה, וסיום", "phrase");
    expect(chunks.map((chunk) => chunk.text)).toEqual(["שורה ראשונה׃", "שורה שנייה,", "וסיום"]);
  });

  it("phrase mode breaks a long comma-less line into word groups", () => {
    const long = "one two three four five six seven eight nine ten";
    const chunks = generateChunks(long, "phrase");
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.split(/\s+/).length <= 4)).toBe(true);
  });

  it("assigns unique ids", () => {
    const chunks = generateChunks(SOURCE, "word");
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });
});

describe("seam seeding", () => {
  it("seeds cuts at line breaks and clause punctuation", () => {
    const words = tokenizeWords(SOURCE);
    const seams = seedCutSeams(SOURCE, words);
    // "waits," ends a clause (seam before "by"=3); line break before "listening"=6.
    expect(seams).toContain(3);
    expect(seams).toContain(6);
  });

  it("cuts before a connective word so long runs read as phrases", () => {
    const source = "if my words did glow with the gold of sunshine";
    const words = tokenizeWords(source);
    const seams = seedCutSeams(source, words);
    // A cut lands before "with" (index 5): "if my words did glow" | "with the gold of sunshine".
    expect(seams).toContain(5);
    // No piece is a single stranded word.
    const chunks = generateChunksFromSeams(source, seams);
    expect(chunks.every((c) => c.text.split(/\s+/).length >= 2)).toBe(true);
  });

  it("never leader-cuts to strand a one-word piece at a line end", () => {
    const source = "my tunes were played on\nthe harp unstrung";
    const words = tokenizeWords(source);
    const seams = seedCutSeams(source, words);
    const chunks = generateChunksFromSeams(source, seams);
    expect(chunks.map((c) => c.text)).toContain("my tunes were played on");
  });

  it("seeded seams split at the line break", () => {
    const seams = seedCutSeams(SOURCE, tokenizeWords(SOURCE));
    const chunks = generateChunksFromSeams(SOURCE, seams);
    // The line break (seam 6) is always seeded, so no strip spans both lines.
    expect(chunks.some((c) => c.text.includes("window") && c.text.includes("listening"))).toBe(false);
  });

  it("unitGroups splits words into strips at each cut seam", () => {
    const words = tokenizeWords("a b c d e");
    const groups = unitGroups(words, [2, 4]);
    expect(groups.map((g) => g.words.map((w) => w.text).join(" "))).toEqual(["a b", "c d", "e"]);
    expect(groups.map((g) => g.startSeam)).toEqual([0, 2, 4]);
  });
});

describe("stripStripPunctuation", () => {
  it("drops sentence punctuation but keeps apostrophes and hyphens", () => {
    expect(stripStripPunctuation("glow,")).toBe("glow");
    expect(stripStripPunctuation("music?")).toBe("music");
    expect(stripStripPunctuation("don't half-lit")).toBe("don't half-lit");
    expect(stripStripPunctuation("waits, by the window.")).toBe("waits by the window");
  });

  it("is applied to generated board chunks", () => {
    const chunks = generateChunksFromSeams("would you hear it?", [2]);
    expect(chunks.map((c) => c.text)).toEqual(["would you", "hear it"]);
  });
});

describe("line picker (import from a Lyrics Pad page)", () => {
  const BODY = "verse one line a\nverse one line b\n\nverse two line a\nverse two line b";

  it("splits into stanza-tagged lines, skipping blanks", () => {
    const lines = splitSourceLines(BODY);
    expect(lines.length).toBe(4);
    expect(lines.map((l) => l.stanza)).toEqual([0, 0, 1, 1]);
  });

  it("joins picks with a blank line between different stanzas", () => {
    const lines = splitSourceLines(BODY);
    expect(joinSelectedLines(lines, [0, 1, 2])).toBe(
      "verse one line a\nverse one line b\n\nverse two line a"
    );
  });

  it("keeps original order regardless of selection order", () => {
    const lines = splitSourceLines(BODY);
    expect(joinSelectedLines(lines, [3, 0])).toBe("verse one line a\n\nverse two line b");
  });

  it("toggleStanzaSelection selects a verse, then clears it when whole", () => {
    const lines = splitSourceLines(BODY);
    let selected = toggleStanzaSelection(lines, new Set([0]), 1);
    expect([...selected].sort()).toEqual([0, 2, 3]);
    selected = toggleStanzaSelection(lines, selected, 1);
    expect([...selected]).toEqual([0]);
  });
});

describe("splitBoardItemByTexts", () => {
  it("replaces one strip with its pieces, in place, unlocked", () => {
    const items: CutUpBoardItem[] = [
      { id: "s1", chunkId: "c1", order: 0 },
      { id: "s2", chunkId: "c2", order: 1, locked: true },
      { id: "s3", chunkId: "c3", order: 2 },
    ];
    const next = splitBoardItemByTexts(items, "s2", ["gold of", "sunshine"]);
    expect(next.length).toBe(4);
    expect(next.map((i) => i.order)).toEqual([0, 1, 2, 3]);
    expect(next[1].textOverride).toBe("gold of");
    expect(next[2].textOverride).toBe("sunshine");
    expect(next[1].locked).toBe(false);
    expect(next[1].chunkId).toBe("c2");
    expect(next[3].id).toBe("s3");
  });

  it("is a no-op for fewer than two non-empty pieces or a missing strip", () => {
    const items: CutUpBoardItem[] = [{ id: "s1", chunkId: "c1", order: 0 }];
    expect(splitBoardItemByTexts(items, "s1", ["only"])).toBe(items);
    expect(splitBoardItemByTexts(items, "s1", ["a", "  "])).toBe(items);
    expect(splitBoardItemByTexts(items, "nope", ["a", "b"])).toBe(items);
  });
});

describe("the table (ruled canvas)", () => {
  const item = (id: string, x?: number, y?: number, extra: object = {}) => ({
    id,
    chunkId: `c-${id}`,
    order: 0,
    x,
    y,
    ...extra,
  });

  it("canvasNeedsDeal is true only when an active scrap lacks a position", () => {
    expect(canvasNeedsDeal([item("a", 0, 0), item("b", 10, 2)])).toBe(false);
    expect(canvasNeedsDeal([item("a", 0, 0), item("b")])).toBe(true);
    expect(canvasNeedsDeal([item("a", 0, 0), item("b", undefined, undefined, { removed: true })])).toBe(false);
  });

  it("dealCanvas places one scrap per band by board order, spaced by a rule", () => {
    const dealt = dealCanvas([item("b", undefined, undefined, { order: 1 }), item("a", undefined, undefined, { order: 0 })], null);
    const byId = new Map(dealt.map((it) => [it.id, it]));
    expect(byId.get("a")?.y).toBe(0);
    expect(byId.get("b")?.y).toBe(2); // one breathing rule between
    expect(byId.get("a")?.x).toBe(0);
  });

  it("dealCanvas honors chunk order when given", () => {
    const chunkIndex = new Map([
      ["c-a", 5],
      ["c-b", 1],
    ]);
    const dealt = dealCanvas([item("a"), item("b")], chunkIndex);
    const byId = new Map(dealt.map((it) => [it.id, it]));
    expect(byId.get("b")?.y).toBe(0);
    expect(byId.get("a")?.y).toBe(2);
  });

  it("moveCanvasScrap writes a clamped position", () => {
    const moved = moveCanvasScrap([item("a", 0, 0)], "a", -4, 2.4);
    expect(moved[0].x).toBe(0);
    expect(moved[0].y).toBe(2);
  });

  it("nextFreeBand is one breathing rule below the lowest occupied rule", () => {
    expect(nextFreeBand([item("a", 0, 0), item("b", 0, 4)])).toBe(6);
    expect(nextFreeBand([])).toBe(0);
  });

  it("poolAllScraps then restorePooledScraps round-trips onto spaced rules", () => {
    const pooled = poolAllScraps([item("a", 0, 0), item("b", 20, 2)]);
    expect(pooled.every((it) => it.removed)).toBe(true);
    const back = restorePooledScraps(pooled);
    expect(back.every((it) => !it.removed)).toBe(true);
    expect(back.map((it) => it.y).sort((p, q) => (p ?? 0) - (q ?? 0))).toEqual([0, 2]);
  });

  it("restorePooledScraps brings pooled scraps back below what's already placed", () => {
    const items = [item("a", 0, 0), item("b", undefined, undefined, { removed: true }), item("d", undefined, undefined, { removed: true })];
    const back = restorePooledScraps(items);
    const byId = new Map(back.map((it) => [it.id, it]));
    expect(byId.get("a")?.y).toBe(0);
    // "a" occupies band 0 → next free is band 2; pooled land at 2, then 4.
    expect([byId.get("b")?.y, byId.get("d")?.y].sort((p, q) => (p ?? 0) - (q ?? 0))).toEqual([2, 4]);
    expect(back.every((it) => !it.removed)).toBe(true);
  });

  it("shuffleCanvas re-deals unlocked scraps around locked ones", () => {
    const items = [item("a", 40, 2, { locked: true }), item("b", 0, 0), item("d", 0, 1)];
    const out = shuffleCanvas(items, () => 100, 360, 8);
    const byId = new Map(out.map((it) => [it.id, it]));
    // Locked holds its exact spot; the loose scraps never land on its rule.
    expect(byId.get("a")?.x).toBe(40);
    expect(byId.get("a")?.y).toBe(2);
    for (const id of ["b", "d"]) {
      expect(typeof byId.get(id)?.y).toBe("number");
      expect(byId.get(id)?.y).not.toBe(2);
      expect(byId.get(id)?.x).toBeGreaterThanOrEqual(0);
    }
  });

  it("shuffleCanvas wraps a row rather than overflowing the canvas", () => {
    const items = [item("a"), item("b"), item("d"), item("e")];
    const out = shuffleCanvas(items, () => 200, 360, 8);
    for (const it of out) {
      expect((it.x ?? 0) + 200).toBeLessThanOrEqual(360 + 200); // placed at x=0 or x=208-wrapped
      expect(it.x === 0 || (it.x ?? 0) + 200 <= 360 + 48).toBe(true);
    }
  });

  it("packSourceLines groups scraps by their source line, keeping stanza gaps", () => {
    const sourceText = "one two\nthree\n\nfour";
    const chunks = [
      { id: "c1", text: "one two", sourceStartIndex: 0, sourceEndIndex: 7, included: true, createdAt: 0, updatedAt: 0 },
      { id: "c2", text: "three", sourceStartIndex: 8, sourceEndIndex: 13, included: true, createdAt: 0, updatedAt: 0 },
      { id: "c3", text: "four", sourceStartIndex: 15, sourceEndIndex: 19, included: true, createdAt: 0, updatedAt: 0 },
    ];
    const items = [
      { id: "s1", chunkId: "c1", order: 0 },
      { id: "s2", chunkId: "c2", order: 1 },
      { id: "s3", chunkId: "c3", order: 2 },
    ];
    const out = packSourceLines(items, chunks, sourceText, () => 80, 360, 8);
    const byId = new Map(out.map((it) => [it.id, it]));
    expect(byId.get("s1")?.y).toBe(0);
    expect(byId.get("s2")?.y).toBe(2); // one breathing rule between lines
    // The source stanza gap adds an extra rule (band 5), a real draft blank.
    expect(byId.get("s3")?.y).toBe(5);
  });

  it("packSourceLines packs same-line scraps side by side and wraps overflow", () => {
    const sourceText = "alpha beta gamma";
    const chunks = [
      { id: "c1", text: "alpha", sourceStartIndex: 0, sourceEndIndex: 5, included: true, createdAt: 0, updatedAt: 0 },
      { id: "c2", text: "beta", sourceStartIndex: 6, sourceEndIndex: 10, included: true, createdAt: 0, updatedAt: 0 },
      { id: "c3", text: "gamma", sourceStartIndex: 11, sourceEndIndex: 16, included: true, createdAt: 0, updatedAt: 0 },
    ];
    const items = [
      { id: "s1", chunkId: "c1", order: 0 },
      { id: "s2", chunkId: "c2", order: 1 },
      { id: "s3", chunkId: "c3", order: 2 },
    ];
    const out = packSourceLines(items, chunks, sourceText, () => 150, 360, 8);
    const byId = new Map(out.map((it) => [it.id, it]));
    // First two fit (150 + 8 + 150 = 308 ≤ 360); the third wraps to the next rule.
    expect(byId.get("s1")?.y).toBe(0);
    expect(byId.get("s1")?.x).toBe(0);
    expect(byId.get("s2")?.y).toBe(0);
    expect(byId.get("s2")?.x).toBe(158);
    expect(byId.get("s3")?.y).toBe(1);
    expect(byId.get("s3")?.x).toBe(0);
  });

  it("canvasLines groups by band, orders by x, and marks blank rules", () => {
    const items = [item("a", 60, 0), item("b", 0, 0), item("d", 0, 3)];
    expect(canvasLines(items, false)).toEqual([["b", "a"], [], ["d"]]);
    // RTL reads right-to-left within a band.
    expect(canvasLines(items, true)[0]).toEqual(["a", "b"]);
  });

  it("a run of empty rules collapses to a single blank line", () => {
    const items = [item("a", 0, 0), item("b", 0, 9)];
    expect(canvasLines(items, false)).toEqual([["a"], [], ["b"]]);
  });

  it("assembleDraftFromCanvas: one empty rule is spacing, not a blank line", () => {
    const text: Record<string, string> = { a: "hold on", b: "tight", d: "now" };
    // band 0 (a,b) then band 2 (d) — a single empty rule between → NO blank.
    const spaced = [item("b", 90, 0), item("a", 0, 0), item("d", 0, 2)];
    expect(assembleDraftFromCanvas(spaced, (id) => text[id] ?? "", false)).toBe("hold on tight\nnow");
  });

  it("assembleDraftFromCanvas: a wide gap becomes a draft blank line", () => {
    const text: Record<string, string> = { a: "hold on", b: "tight", d: "now" };
    // band 0 (a,b) then band 3 (d) — two empty rules → one blank line.
    const gapped = [item("b", 90, 0), item("a", 0, 0), item("d", 0, 3)];
    expect(assembleDraftFromCanvas(gapped, (id) => text[id] ?? "", false)).toBe("hold on tight\n\nnow");
  });

  it("canvasScrapTexts flattens in reading order", () => {
    const text: Record<string, string> = { a: "one", b: "two" };
    const items = [item("b", 50, 0), item("a", 0, 0)];
    expect(canvasScrapTexts(items, (id) => text[id] ?? "", false)).toEqual(["one", "two"]);
  });
});


describe("chunk editing", () => {
  it("splits a chunk into two non-empty halves", () => {
    const chunks = generateChunks("alpha beta gamma delta", "line"); // one chunk
    expect(chunks).toHaveLength(1);
    const split = splitChunk(chunks, chunks[0].id);
    expect(split).toHaveLength(2);
    expect(split.every((c) => c.text.trim().length > 0)).toBe(true);
    expect(`${split[0].text} ${split[1].text}`).toBe("alpha beta gamma delta");
  });

  it("merges a chunk with the next one", () => {
    const chunks = generateChunks("hold on tight", "word");
    const merged = mergeChunkWithNext(chunks, chunks[0].id);
    expect(merged).toHaveLength(2);
    expect(merged[0].text).toBe("hold on");
  });

  it("merge is a no-op on the last chunk", () => {
    const chunks = generateChunks("a b", "word");
    const merged = mergeChunkWithNext(chunks, chunks[1].id);
    expect(merged).toHaveLength(2);
  });

  it("toggles inclusion without deleting", () => {
    const chunks = generateChunks("a b", "word");
    const toggled = toggleChunkIncluded(chunks, chunks[0].id);
    expect(toggled).toHaveLength(2);
    expect(toggled[0].included).toBe(false);
  });
});

describe("board", () => {
  it("builds strips only from included chunks", () => {
    let chunks = generateChunks("a b c", "word");
    chunks = toggleChunkIncluded(chunks, chunks[1].id); // exclude "b"
    const board = buildBoardItems(chunks);
    expect(board).toHaveLength(2);
    const chunkIds = board.map((item) => item.chunkId);
    expect(chunkIds).not.toContain(chunks[1].id);
  });

  it("reconcile drops excluded strips and adds newly-included ones", () => {
    const chunks = generateChunks("a b c", "word");
    const board = buildBoardItems(chunks);
    const excluded = toggleChunkIncluded(chunks, chunks[0].id);
    const reconciled = reconcileBoard(excluded, board);
    expect(reconciled.map((i) => i.chunkId)).not.toContain(chunks[0].id);
    expect(reconciled).toHaveLength(2);
  });

  it("shuffle keeps locked strips in place", () => {
    const chunks = generateChunks("a b c d e", "word");
    let board = buildBoardItems(chunks).map((item, index) => ({ ...item, order: index }));
    // Lock the strip at order 0.
    const lockedId = board.find((i) => i.order === 0)!.id;
    board = board.map((i) => (i.id === lockedId ? { ...i, locked: true } : i));
    const shuffled = shuffleBoard(board);
    const lockedAfter = shuffled.find((i) => i.id === lockedId)!;
    expect(lockedAfter.order).toBe(0);
  });

  it("remove keeps the strip (parked) and reorder ignores removed", () => {
    const chunks = generateChunks("a b c", "word");
    let board = buildBoardItems(chunks).map((item, index) => ({ ...item, order: index }));
    const target = board[1].id;
    board = setBoardItemRemoved(board, target, true);
    expect(board.find((i) => i.id === target)?.removed).toBe(true);
    const activeIds = board.filter((i) => !i.removed).map((i) => i.id);
    const reordered = reorderBoard(board, activeIds.slice().reverse());
    expect(reordered.filter((i) => !i.removed)).toHaveLength(2);
    expect(reordered.find((i) => i.id === target)?.removed).toBe(true);
  });

  it("resetBoardOrder restores source order", () => {
    const chunks = generateChunks("a b c", "word");
    const board = buildBoardItems(chunks);
    const reset = resetBoardOrder(board, chunks);
    const orderedChunkIds = reset
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((i) => i.chunkId);
    expect(orderedChunkIds).toEqual(chunks.map((c) => c.id));
  });
});

describe("assembleDraftText", () => {
  it("joins active strips in order, honoring text overrides and skipping removed", () => {
    const chunks = generateChunks("a b c", "word");
    let board: CutUpBoardItem[] = chunks.map((chunk, index) => ({
      id: `s${index}`,
      chunkId: chunk.id,
      order: index,
    }));
    board[1] = { ...board[1], textOverride: "BEE" };
    board = setBoardItemRemoved(board, "s2", true);
    expect(assembleDraftText(chunks, board)).toBe("a\nBEE");
  });
});

describe("sanitizeCutUpSpark", () => {
  it("drops board items referencing missing chunks and coerces enums", () => {
    const raw = {
      id: "cutup-1",
      title: "Test",
      step: "bogus",
      chunkMode: "weird",
      sourceText: "a b",
      chunks: [{ id: "c1", text: "a" }],
      boardItems: [
        { id: "b1", chunkId: "c1", order: 0 },
        { id: "b2", chunkId: "missing", order: 1 },
      ],
      assembledDraftText: "a",
      seenHelpSteps: ["source", "nope"],
    };
    const spark = sanitizeCutUpSpark(raw)!;
    expect(spark.step).toBe("source");
    expect(spark.chunkMode).toBe("phrase");
    expect(spark.chunks).toHaveLength(1);
    expect(spark.boardItems).toHaveLength(1);
    expect(spark.boardItems[0].chunkId).toBe("c1");
    expect(spark.seenHelpSteps).toEqual(["source"]);
  });

  it("returns null for non-objects / missing id", () => {
    expect(sanitizeCutUpSpark(null)).toBeNull();
    expect(sanitizeCutUpSpark({ title: "no id" })).toBeNull();
  });

  it("createCutUpSpark derives a title from the first line", () => {
    const spark = createCutUpSpark("first line here\nsecond");
    expect(spark.title).toContain("first line here");
    expect(spark.step).toBe("source");
    expect(spark.chunkMode).toBe("phrase");
  });
});
