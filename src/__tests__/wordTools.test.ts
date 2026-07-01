import {
  buildWordLookupUrl,
  extractWordRange,
  insertWordIntoText,
  parseWordSuggestions,
} from "../wordTools";

describe("extractWordRange", () => {
  const text = "Dancing in the moonlight, don't stop";

  it("expands a collapsed cursor to the word around it", () => {
    expect(extractWordRange(text, 17, 17)).toEqual({ word: "moonlight", start: 15, end: 24 });
  });

  it("finds the word just typed when the cursor sits after it", () => {
    expect(extractWordRange(text, 24, 24)).toEqual({ word: "moonlight", start: 15, end: 24 });
  });

  it("keeps contractions whole", () => {
    expect(extractWordRange(text, 28, 28)?.word).toBe("don't");
  });

  it("trims punctuation and whitespace from a selection", () => {
    // " moonlight, " selected sloppily
    expect(extractWordRange(text, 14, 25)).toEqual({ word: "moonlight", start: 15, end: 24 });
  });

  it("returns null on whitespace with no adjacent word start", () => {
    expect(extractWordRange("hello  world", 6, 6)).toBeNull();
  });

  it("returns null for empty text and numeric-only content", () => {
    expect(extractWordRange("", 0, 0)).toBeNull();
    expect(extractWordRange("1234", 2, 2)).toBeNull();
  });

  it("clamps out-of-range positions", () => {
    expect(extractWordRange("hey", 10, 10)?.word).toBe("hey");
  });
});

describe("insertWordIntoText", () => {
  it("replaces a selection without adding spaces", () => {
    const result = insertWordIntoText("the fire tonight", 4, 8, "flame");
    expect(result.text).toBe("the flame tonight");
    expect(result.caret).toBe(9);
  });

  it("adds a leading space when inserting right after a word", () => {
    const result = insertWordIntoText("shine so bright", 15, 15, "tonight");
    expect(result.text).toBe("shine so bright tonight");
  });

  it("adds both spaces when inserting between fused words", () => {
    const result = insertWordIntoText("shine bright", 6, 6, "so");
    expect(result.text).toBe("shine so bright");
  });

  it("does not add a leading space at line starts", () => {
    const result = insertWordIntoText("first line\n", 11, 11, "second");
    expect(result.text).toBe("first line\nsecond");
  });

  it("inserts plainly into empty text", () => {
    expect(insertWordIntoText("", 0, 0, "hello").text).toBe("hello");
  });
});

describe("buildWordLookupUrl", () => {
  it("maps each mode to its Datamuse parameter", () => {
    expect(buildWordLookupUrl("rhymes", "love", "https://example.com")).toContain("rel_rhy=love");
    expect(buildWordLookupUrl("near", "love", "https://example.com")).toContain("rel_nry=love");
    expect(buildWordLookupUrl("similar", "love", "https://example.com")).toContain("ml=love");
    expect(buildWordLookupUrl("related", "love", "https://example.com")).toContain("rel_trg=love");
  });

  it("lowercases and encodes the word", () => {
    const url = buildWordLookupUrl("rhymes", "Don't", "https://example.com");
    expect(url).toContain("rel_rhy=don%27t");
  });

  it("requests syllable metadata and caps results", () => {
    const url = buildWordLookupUrl("rhymes", "love", "https://example.com");
    expect(url).toContain("md=s");
    expect(url).toContain("max=40");
  });
});

describe("parseWordSuggestions", () => {
  it("parses valid Datamuse entries", () => {
    const parsed = parseWordSuggestions([
      { word: "above", score: 1849, numSyllables: 2 },
      { word: "dove", score: 900 },
    ]);
    expect(parsed).toEqual([
      { word: "above", score: 1849, numSyllables: 2 },
      { word: "dove", score: 900, numSyllables: undefined },
    ]);
  });

  it("drops malformed entries and tolerates non-array payloads", () => {
    expect(parseWordSuggestions([{ score: 1 }, null, { word: "  " }, { word: "ok" }])).toEqual([
      { word: "ok", score: 0, numSyllables: undefined },
    ]);
    expect(parseWordSuggestions({ error: "nope" })).toEqual([]);
    expect(parseWordSuggestions(undefined)).toEqual([]);
  });
});
