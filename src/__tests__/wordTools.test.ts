import {
  applyPickedWord,
  buildWordLookupUrl,
  extractWordRange,
  groupBySyllableCount,
  insertWordIntoText,
  parseWordSuggestions,
  sanitizeThemeWords,
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

describe("applyPickedWord", () => {
  const text = "the fire tonight";

  it("replaces an explicit selection trimmed to word characters", () => {
    // " fire " selected sloppily with surrounding spaces
    expect(applyPickedWord(text, 3, 9, "flame").text).toBe("the flame tonight");
  });

  it("replaces the whole word when the caret sits strictly inside it", () => {
    // caret between "fi|re"
    expect(applyPickedWord(text, 6, 6, "flame").text).toBe("the flame tonight");
  });

  it("inserts at the caret when it sits at a word end", () => {
    // caret right after "fire" — the common just-typed position
    const result = applyPickedWord(text, 8, 8, "flame");
    expect(result.text).toBe("the fire flame tonight");
  });

  it("inserts plainly on whitespace with no adjacent word", () => {
    expect(applyPickedWord("hello  world", 6, 6, "big").text).toBe("hello big world");
  });
});

describe("buildWordLookupUrl", () => {
  const base = { baseUrl: "https://example.com" };

  it("maps each quick mode to its Datamuse parameter", () => {
    expect(buildWordLookupUrl("rhymes", "love", base)).toContain("rel_rhy=love");
    expect(buildWordLookupUrl("near", "love", base)).toContain("rel_nry=love");
    expect(buildWordLookupUrl("similar", "love", base)).toContain("ml=love");
    expect(buildWordLookupUrl("related", "love", base)).toContain("rel_trg=love");
  });

  it("maps each extended mode to its Datamuse parameter", () => {
    expect(buildWordLookupUrl("homophones", "course", base)).toContain("rel_hom=course");
    expect(buildWordLookupUrl("consonance", "sample", base)).toContain("rel_cns=sample");
    expect(buildWordLookupUrl("soundsLike", "fizix", base)).toContain("sl=fizix");
    expect(buildWordLookupUrl("opposite", "love", base)).toContain("rel_ant=love");
    expect(buildWordLookupUrl("synonyms", "happy", base)).toContain("rel_syn=happy");
    expect(buildWordLookupUrl("describe", "ocean", base)).toContain("rel_jjb=ocean");
    expect(buildWordLookupUrl("kinds", "bird", base)).toContain("rel_gen=bird");
    expect(buildWordLookupUrl("parts", "car", base)).toContain("rel_com=car");
  });

  it("lowercases and encodes the word", () => {
    const url = buildWordLookupUrl("rhymes", "Don't", base);
    expect(url).toContain("rel_rhy=don%27t");
  });

  it("requests syllable metadata and caps results", () => {
    const url = buildWordLookupUrl("rhymes", "love", base);
    expect(url).toContain("md=s");
    expect(url).toContain("max=40");
  });

  it("adds sanitized theme words as topics", () => {
    const url = buildWordLookupUrl("rhymes", "night", { ...base, theme: "Love, leaving " });
    expect(url).toContain("topics=love%2Cleaving");
  });

  it("omits topics when the theme is empty or junk", () => {
    expect(buildWordLookupUrl("rhymes", "night", base)).not.toContain("topics");
    expect(buildWordLookupUrl("rhymes", "night", { ...base, theme: " , 123 " })).not.toContain("topics");
  });
});

describe("sanitizeThemeWords", () => {
  it("splits on commas and whitespace, lowercases, strips junk", () => {
    expect(sanitizeThemeWords("Love, leaving  TOWN!")).toEqual(["love", "leaving", "town"]);
  });

  it("caps at five words", () => {
    expect(sanitizeThemeWords("a b c d e f g")).toHaveLength(5);
  });

  it("drops entries without letters", () => {
    expect(sanitizeThemeWords("123, --, love")).toEqual(["love"]);
  });
});

describe("groupBySyllableCount", () => {
  it("buckets ascending by syllables, unknown last, keeping order within groups", () => {
    const groups = groupBySyllableCount([
      { word: "above", score: 5, numSyllables: 2 },
      { word: "dove", score: 4, numSyllables: 1 },
      { word: "thereof", score: 3, numSyllables: 2 },
      { word: "mystery", score: 2 },
      { word: "glove", score: 1, numSyllables: 1 },
    ]);
    expect(groups.map((g) => g.syllables)).toEqual([1, 2, null]);
    expect(groups[0].suggestions.map((s) => s.word)).toEqual(["dove", "glove"]);
    expect(groups[1].suggestions.map((s) => s.word)).toEqual(["above", "thereof"]);
  });

  it("returns a single bucket when all counts match", () => {
    const groups = groupBySyllableCount([
      { word: "dove", score: 2, numSyllables: 1 },
      { word: "glove", score: 1, numSyllables: 1 },
    ]);
    expect(groups).toHaveLength(1);
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
