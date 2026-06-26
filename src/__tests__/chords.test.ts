import {
  buildChordChartHtml,
  buildChordDisplay,
  clampChordIndex,
  paletteKey,
  recordChordInPalette,
  serializeChordChartText,
  serializeChordPro,
  sortedPalette,
} from "../chords";
import type { ChordPlacement, LyricsLine, SongChordPaletteItem } from "../types";

describe("buildChordDisplay", () => {
  it("builds a plain major triad from just a root", () => {
    expect(buildChordDisplay({ root: "C" })).toBe("C");
  });

  it("applies accidental, quality, and slash bass", () => {
    expect(
      buildChordDisplay({
        root: "C",
        accidental: "sharp",
        quality: "m7",
        bassRoot: "G",
        bassAccidental: "sharp",
      })
    ).toBe("C♯m7/G♯");
  });

  it("renders a flat root and a flat slash bass", () => {
    expect(buildChordDisplay({ root: "B", accidental: "flat", bassRoot: "D", bassAccidental: "flat" })).toBe(
      "B♭/D♭"
    );
  });

  it("ignores accidental when natural", () => {
    expect(buildChordDisplay({ root: "A", accidental: "natural", quality: "m" })).toBe("Am");
  });

  it("falls back to the custom suffix when there is no root", () => {
    expect(buildChordDisplay({ customSuffix: "N.C." })).toBe("N.C.");
  });

  it("appends a custom suffix to a built chord", () => {
    expect(buildChordDisplay({ root: "E", quality: "7", customSuffix: "#9" })).toBe("E7#9");
  });
});

describe("clampChordIndex", () => {
  it("clamps within [0, length] and rounds", () => {
    expect(clampChordIndex(-3, 10)).toBe(0);
    expect(clampChordIndex(4.6, 10)).toBe(5);
    expect(clampChordIndex(99, 10)).toBe(10); // index === length is allowed (past last char)
  });

  it("handles non-finite input", () => {
    expect(clampChordIndex(NaN, 10)).toBe(0);
  });
});

describe("recordChordInPalette", () => {
  const chord = (text: string): ChordPlacement => ({ id: "c1", chord: text, at: 0, root: "C" });

  it("adds a new chord to the front", () => {
    const next = recordChordInPalette([], chord("C"), "p1", 100);
    expect(next).toHaveLength(1);
    expect(next[0].displayText).toBe("C");
    expect(next[0].useCount).toBe(1);
    expect(next[0].lastUsedAt).toBe(100);
  });

  it("bumps an existing chord by display text instead of duplicating", () => {
    const existing: SongChordPaletteItem[] = [{ id: "p1", displayText: "C", useCount: 2, lastUsedAt: 50 }];
    const next = recordChordInPalette(existing, chord("C"), "p2", 200);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("p1");
    expect(next[0].useCount).toBe(3);
    expect(next[0].lastUsedAt).toBe(200);
  });

  it("ignores blank chords", () => {
    expect(recordChordInPalette([], chord("  "), "p1", 100)).toEqual([]);
  });
});

describe("sortedPalette", () => {
  it("orders by recency then use count", () => {
    const palette: SongChordPaletteItem[] = [
      { id: "a", displayText: "A", useCount: 1, lastUsedAt: 10 },
      { id: "b", displayText: "G", useCount: 9, lastUsedAt: 30 },
      { id: "c", displayText: "C", useCount: 5, lastUsedAt: 30 },
    ];
    expect(sortedPalette(palette).map((item) => item.displayText)).toEqual(["G", "C", "A"]);
  });
});

describe("paletteKey", () => {
  it("normalizes case and whitespace", () => {
    expect(paletteKey("  Cmaj7 ")).toBe("cmaj7");
  });
});

describe("serializeChordChartText", () => {
  it("renders chords on their own line above the lyric, aligned by char index", () => {
    const lines: LyricsLine[] = [
      {
        id: "l1",
        text: "hello world",
        chords: [
          { id: "c1", chord: "C", at: 0 },
          { id: "c2", chord: "G", at: 6 },
        ],
      },
      { id: "l2", text: "no chords here", chords: [] },
    ];
    expect(serializeChordChartText(lines)).toBe("C     G\nhello world\nno chords here");
  });
});

describe("buildChordChartHtml", () => {
  const lines: LyricsLine[] = [
    { id: "l1", text: "hello world", chords: [{ id: "c1", chord: "C", at: 0 }] },
    { id: "l2", text: "plain", chords: [] },
  ];

  it("includes the title, a chord row for chorded lines, and escapes HTML", () => {
    const html = buildChordChartHtml("My <Song>", "Album · 2026", lines);
    expect(html).toContain("<h1>My &lt;Song&gt;</h1>");
    expect(html).toContain("Album · 2026");
    expect(html).toContain('<pre class="chords">C</pre>');
    expect(html).toContain('<pre class="lyric">hello world</pre>');
    expect(html).toContain('<pre class="lyric">plain</pre>');
  });

  it("omits the chord row for lines without chords", () => {
    const html = buildChordChartHtml("t", "s", [{ id: "l", text: "no chords", chords: [] }]);
    expect(html).not.toContain('class="chords"');
  });
});

describe("serializeChordPro", () => {
  it("inlines chords as bracket notation at their anchors", () => {
    const lines: LyricsLine[] = [
      {
        id: "l1",
        text: "hello world",
        chords: [
          { id: "c1", chord: "C", at: 0 },
          { id: "c2", chord: "G", at: 6 },
        ],
      },
      { id: "l2", text: "plain line", chords: [] },
    ];
    expect(serializeChordPro(lines)).toBe("[C]hello [G]world\nplain line");
  });
});
