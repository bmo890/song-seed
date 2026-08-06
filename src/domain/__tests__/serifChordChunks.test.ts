import { buildWordChunks } from "../serifChordChunks";
import type { ChordPlacement, LyricsLine } from "../../types";

const chord = (chordText: string, at: number): ChordPlacement => ({
  id: `${chordText}@${at}`,
  chord: chordText,
  at,
});

const line = (text: string, chords: ChordPlacement[]): LyricsLine => ({
  id: "line",
  text,
  chords,
});

describe("buildWordChunks", () => {
  it("chunks a line into words and attaches each chord to the word its anchor falls inside", () => {
    const chunks = buildWordChunks(
      line("Hello porch light", [chord("Am", 0), chord("C", 6)])
    );
    expect(chunks.map((c) => c.text)).toEqual(["Hello", "porch", "light"]);
    expect(chunks[0].chords).toEqual(["Am"]);
    expect(chunks[1].chords).toEqual(["C"]);
    expect(chunks[2].chords).toEqual([]);
  });

  it("leans an anchor in the gap between words on the NEXT word", () => {
    // Index 5 is the space after "Hello" — the chord belongs to the word ahead.
    const chunks = buildWordChunks(line("Hello porch", [chord("F", 5)]));
    expect(chunks[0].chords).toEqual([]);
    expect(chunks[1].chords).toEqual(["F"]);
  });

  it("clamps an anchor past the end of the line onto the last word", () => {
    const chunks = buildWordChunks(line("Hello", [chord("G", 40)]));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chords).toEqual(["G"]);
  });

  it("stacks chords that share a word, in anchor order", () => {
    const chunks = buildWordChunks(
      line("sunshine", [chord("F", 4), chord("D", 0), chord("E", 2)])
    );
    expect(chunks[0].chords).toEqual(["D", "E", "F"]);
  });
});
