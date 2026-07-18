import {
  clampTransposeOffset,
  formatTransposeOffset,
  parseChordSymbol,
  transposeChordSheet,
  transposeChordSymbol,
  transposeLyricsLines,
} from "../transpose";
import type { ChordSheet, LyricsLine } from "../../types";

describe("parseChordSymbol", () => {
  it("parses plain, accidental, and quality-bearing symbols", () => {
    expect(parseChordSymbol("C")).toMatchObject({ rootPitchClass: 0, rest: "" });
    expect(parseChordSymbol("F♯m7")).toMatchObject({ rootPitchClass: 6, rest: "m7" });
    expect(parseChordSymbol("Bb")).toMatchObject({ rootPitchClass: 10 });
    expect(parseChordSymbol("Ebmaj7")).toMatchObject({ rootPitchClass: 3, rest: "maj7" });
    expect(parseChordSymbol("Asus4")).toMatchObject({ rootPitchClass: 9, rest: "sus4" });
    expect(parseChordSymbol("G#dim")).toMatchObject({ rootPitchClass: 8, rest: "dim" });
  });

  it("parses slash basses only when the tail is exactly a note", () => {
    expect(parseChordSymbol("C/G")).toMatchObject({ rootPitchClass: 0, bassPitchClass: 7 });
    expect(parseChordSymbol("E♭/G")).toMatchObject({ rootPitchClass: 3, bassPitchClass: 7 });
    expect(parseChordSymbol("D/F♯")).toMatchObject({ bassPitchClass: 6 });
    // "/9" is an extension, not a bass note.
    expect(parseChordSymbol("C6/9")).toMatchObject({ rest: "6/9", bassPitchClass: undefined });
  });

  it("rejects prose and non-chords", () => {
    expect(parseChordSymbol("hello")).toBeNull();
    expect(parseChordSymbol("go home")).toBeNull();
    expect(parseChordSymbol("")).toBeNull();
    expect(parseChordSymbol("H7")).toBeNull();
    expect(parseChordSymbol("Chorus riff")).toBeNull(); // space in tail = prose
  });
});

describe("transposeChordSymbol", () => {
  it("shifts roots and basses, preferring idiomatic spellings from naturals", () => {
    // The mockup's C → E♭ family at +3.
    expect(transposeChordSymbol("C", 3)).toBe("E♭");
    expect(transposeChordSymbol("F", 3)).toBe("A♭");
    expect(transposeChordSymbol("G", 3)).toBe("B♭");
    expect(transposeChordSymbol("Am", 3)).toBe("Cm");
    expect(transposeChordSymbol("Em", 3)).toBe("Gm");
    expect(transposeChordSymbol("C/E", 3)).toBe("E♭/G");
    expect(transposeChordSymbol("G7", 3)).toBe("B♭7");
  });

  it("keeps the source accidental family", () => {
    expect(transposeChordSymbol("F♯m", 2)).toBe("G♯m");
    expect(transposeChordSymbol("B♭", 2)).toBe("C");
    expect(transposeChordSymbol("E♭maj7", -1)).toBe("Dmaj7");
    // ASCII accidentals normalize to the app's unicode glyphs.
    expect(transposeChordSymbol("Bb7", 1)).toBe("B7");
    expect(transposeChordSymbol("F#m7/A", 0)).toBe("F#m7/A"); // zero = untouched
  });

  it("round-trips ±12 to an equivalent symbol", () => {
    for (const symbol of ["C", "F♯m7", "E♭/G", "Asus4", "B♭maj7"]) {
      expect(transposeChordSymbol(symbol, 12)).toBe(transposeChordSymbol(symbol, 0));
      const up = transposeChordSymbol(transposeChordSymbol(symbol, 5), -5);
      // Same pitch content parses back to the same classes.
      expect(parseChordSymbol(up)!.rootPitchClass).toBe(parseChordSymbol(symbol)!.rootPitchClass);
    }
  });

  it("passes unparseable text through unchanged", () => {
    expect(transposeChordSymbol("(let ring)", 4)).toBe("(let ring)");
    expect(transposeChordSymbol("N.C.", 4)).toBe("N.C.");
    expect(transposeChordSymbol("whatever text", 4)).toBe("whatever text");
  });
});

describe("structure helpers", () => {
  const sheet: ChordSheet = {
    updatedAt: 1,
    sections: [
      {
        id: "s1",
        label: "Verse",
        notes: "",
        measures: [
          { id: "m1", chords: ["C", "Am"] },
          { id: "m2", chords: ["riff here"] },
        ],
      },
    ],
  };

  it("transposes a chord sheet non-destructively", () => {
    const shifted = transposeChordSheet(sheet, 2);
    expect(shifted.sections[0]!.measures[0]!.chords).toEqual(["D", "Bm"]);
    expect(shifted.sections[0]!.measures[1]!.chords).toEqual(["riff here"]);
    // Original untouched.
    expect(sheet.sections[0]!.measures[0]!.chords).toEqual(["C", "Am"]);
    // Zero offset returns the same reference (cheap no-op).
    expect(transposeChordSheet(sheet, 0)).toBe(sheet);
  });

  it("transposes chord-over-lyrics lines without touching lyric text", () => {
    const lines: LyricsLine[] = [
      {
        id: "l1",
        text: "Hollow moon above",
        chords: [
          { id: "c1", chord: "E", at: 0 },
          { id: "c2", chord: "B7", at: 12 },
        ],
      },
    ];
    const shifted = transposeLyricsLines(lines, 1);
    expect(shifted[0]!.chords.map((c) => c.chord)).toEqual(["F", "C7"]);
    expect(shifted[0]!.text).toBe("Hollow moon above");
    expect(lines[0]!.chords[0]!.chord).toBe("E");
  });

  it("clamps and formats offsets", () => {
    expect(clampTransposeOffset(15)).toBe(11);
    expect(clampTransposeOffset(-15)).toBe(-11);
    expect(clampTransposeOffset(NaN)).toBe(0);
    expect(formatTransposeOffset(3)).toBe("+3");
    expect(formatTransposeOffset(-2)).toBe("−2");
    expect(formatTransposeOffset(0)).toBe("0");
  });
});
