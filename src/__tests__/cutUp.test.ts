import {
  assembleDraftText,
  buildBoardItems,
  createCutUpSpark,
  generateChunks,
  mergeChunkWithNext,
  reconcileBoard,
  reorderBoard,
  resetBoardOrder,
  sanitizeCutUpSpark,
  setBoardItemRemoved,
  shuffleBoard,
  splitChunk,
  toggleChunkIncluded,
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
