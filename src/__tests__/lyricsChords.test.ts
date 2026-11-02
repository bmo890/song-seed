import { lyricsTextToDocument } from "../domain/lyrics";
import type { LyricsDocument } from "../types";

describe("lyricsTextToDocument chord preservation", () => {
  const previous: LyricsDocument = {
    lines: [
      {
        id: "l1",
        text: "hello world",
        chords: [
          { id: "c1", chord: "C", at: 0, root: "C" },
          { id: "c2", chord: "G", at: 6, root: "G" },
        ],
      },
    ],
  };

  it("keeps chords (and structured fields) unchanged when the line text is unchanged", () => {
    const next = lyricsTextToDocument("hello world", previous);
    expect(next.lines[0].id).toBe("l1");
    expect(next.lines[0].chords).toEqual(previous.lines[0].chords);
    expect(next.lines[0].chords[0].root).toBe("C");
  });

  it("clamps chord anchors into the new length instead of dropping them when text changes", () => {
    const next = lyricsTextToDocument("hi", previous); // length 2
    expect(next.lines[0].chords).toHaveLength(2);
    expect(next.lines[0].chords[0].at).toBe(0); // was 0, still fits
    expect(next.lines[0].chords[1].at).toBe(2); // was 6, clamped to length 2
    expect(next.lines[0].chords[1].chord).toBe("G");
  });

  it("drops all chords for an emptied document", () => {
    const next = lyricsTextToDocument("", previous);
    expect(next.lines).toEqual([]);
  });
});

/** 12b B-H2: chords follow their line's words, not its index. */
describe("lyricsTextToDocument line alignment", () => {
  const chord = (id: string, name: string, at: number) => ({ id, chord: name, at, graphemeAt: at });
  const verse: LyricsDocument = {
    lines: [
      { id: "a", text: "Down by the river", chords: [chord("g", "G", 0), chord("d", "D", 12)] },
      { id: "b", text: "where the water runs", chords: [chord("em", "Em", 6)] },
      { id: "c", text: "I left my heart", chords: [chord("c", "C", 2)] },
      { id: "d", text: "and it never came home", chords: [chord("g2", "G", 17)] },
    ],
  };
  const chordsOf = (doc: LyricsDocument) =>
    doc.lines.map((line) => `${line.text} <- ${line.chords.map((c) => `${c.chord}@${c.graphemeAt}`).join(",")}`);
  const verseText = verse.lines.map((line) => line.text);

  it("keeps every chord on its words when a line is inserted at the top", () => {
    const next = lyricsTextToDocument(["Verse one", ...verseText].join("\n"), verse);
    expect(chordsOf(next)).toEqual([
      "Verse one <- ",
      "Down by the river <- G@0,D@12",
      "where the water runs <- Em@6",
      "I left my heart <- C@2",
      "and it never came home <- G@17",
    ]);
    expect(next.lines.slice(1).map((line) => line.id)).toEqual(["a", "b", "c", "d"]);
    expect(next.lines[0].id).not.toMatch(/^[abcd]$/);
  });

  it("keeps the last line's chords when a blank line is inserted between couplets", () => {
    const next = lyricsTextToDocument([verseText[0], verseText[1], "", verseText[2], verseText[3]].join("\n"), verse);
    expect(chordsOf(next)).toEqual([
      "Down by the river <- G@0,D@12",
      "where the water runs <- Em@6",
      " <- ",
      "I left my heart <- C@2",
      "and it never came home <- G@17",
    ]);
  });

  it("drops only the deleted line's chords when a middle line is cut", () => {
    const next = lyricsTextToDocument([verseText[0], verseText[2], verseText[3]].join("\n"), verse);
    expect(chordsOf(next)).toEqual([
      "Down by the river <- G@0,D@12",
      "I left my heart <- C@2",
      "and it never came home <- G@17",
    ]);
  });

  it("keeps an edited line's chords over the same words", () => {
    const next = lyricsTextToDocument(
      [verseText[0], "where the cold water runs", verseText[2], verseText[3]].join("\n"),
      verse
    );
    expect(next.lines[1].id).toBe("b");
    // Em sits over "the" (6), before the edit point (10): it stays put.
    expect(next.lines[1].chords.map((c) => c.graphemeAt)).toEqual([6]);
    const shifted = lyricsTextToDocument(["Oh, Down by the river", ...verseText.slice(1)].join("\n"), verse);
    // "Oh, " pushed the words right by 4; the chords ride with them.
    expect(shifted.lines[0].chords.map((c) => `${c.chord}@${c.graphemeAt}`)).toEqual(["G@4", "D@16"]);
    expect(shifted.lines[0].chords[1].at).toBe(16);
  });

  it("keeps an edited line's chords when a line is also inserted beside it", () => {
    const next = lyricsTextToDocument(
      [verseText[0], "where the waters run", "a brand new line here", verseText[2], verseText[3]].join("\n"),
      verse
    );
    expect(chordsOf(next)).toEqual([
      "Down by the river <- G@0,D@12",
      "where the waters run <- Em@6",
      "a brand new line here <- ",
      "I left my heart <- C@2",
      "and it never came home <- G@17",
    ]);
  });

  it("round-trips Enter then Backspace mid-line without moving a chord", () => {
    // Enter between "where the " and "water runs".
    const split = lyricsTextToDocument(
      [verseText[0], "where the ", "water runs", verseText[2], verseText[3]].join("\n"),
      { lines: verse.lines.map((line) => (line.id === "b" ? { ...line, chords: [chord("em", "Em", 6), chord("a", "A", 14)] } : line)) }
    );
    expect(chordsOf(split)).toEqual([
      "Down by the river <- G@0,D@12",
      "where the  <- Em@6",
      "water runs <- A@4",
      "I left my heart <- C@2",
      "and it never came home <- G@17",
    ]);
    const merged = lyricsTextToDocument(verseText.join("\n"), split);
    expect(chordsOf(merged)).toEqual([
      "Down by the river <- G@0,D@12",
      "where the water runs <- Em@6,A@14",
      "I left my heart <- C@2",
      "and it never came home <- G@17",
    ]);
    expect(merged.lines[1].id).toBe("b");
  });

  it("keeps each of two identical lines' own chords when a line goes between them", () => {
    const chorus: LyricsDocument = {
      lines: [
        { id: "x", text: "la la la", chords: [chord("x1", "G", 0)] },
        { id: "y", text: "la la la", chords: [chord("y1", "C", 3)] },
      ],
    };
    const next = lyricsTextToDocument("la la la\nhey\nla la la", chorus);
    expect(chordsOf(next)).toEqual(["la la la <- G@0", "hey <- ", "la la la <- C@3"]);
    expect(next.lines.map((line) => line.id).filter((id) => id === "x" || id === "y")).toEqual(["x", "y"]);
    // A pasted duplicate never clones chords.
    const duplicated = lyricsTextToDocument("la la la\nla la la\nla la la", chorus);
    expect(duplicated.lines.flatMap((line) => line.chords.map((c) => c.id)).sort()).toEqual(["x1", "y1"]);
  });

  it("keeps chords on charted empty lines and does not hand them to new empty lines", () => {
    const withBreak: LyricsDocument = {
      lines: [
        { id: "p", text: "one", chords: [] },
        { id: "q", text: "", chords: [chord("q1", "Am", 0)] },
        { id: "r", text: "two", chords: [chord("r1", "F", 1)] },
      ],
    };
    const next = lyricsTextToDocument("\none\n\ntwo\n", withBreak);
    expect(chordsOf(next)).toEqual([" <- ", "one <- ", " <- Am@0", "two <- F@1", " <- "]);
  });

  it("carries a moved line's chords with it", () => {
    const next = lyricsTextToDocument([verseText[1], verseText[0], verseText[2], verseText[3]].join("\n"), verse);
    expect(chordsOf(next)).toEqual([
      "where the water runs <- Em@6",
      "Down by the river <- G@0,D@12",
      "I left my heart <- C@2",
      "and it never came home <- G@17",
    ]);
    expect(new Set(next.lines.map((line) => line.id)).size).toBe(4);
  });
});
