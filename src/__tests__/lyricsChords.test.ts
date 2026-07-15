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
