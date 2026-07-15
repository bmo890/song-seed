import {
  buildChordSheetHtml,
  cloneChordSheet,
  createChordSheet,
  createSection,
  isChordSheetEmpty,
  sanitizeChordSheet,
  serializeChordSheetText,
} from "../domain/chordSheet";
import type { ChordSheet } from "../types";

function sampleSheet(): ChordSheet {
  return {
    updatedAt: 1,
    sections: [
      {
        id: "s1",
        label: "Verse",
        notes: "let it breathe",
        measures: [
          { id: "m1", chords: ["C"] },
          { id: "m2", chords: ["Am"] },
          { id: "m3", chords: ["F"] },
          { id: "m4", chords: ["G", "G7"] },
        ],
      },
    ],
  };
}

describe("createSection", () => {
  it("starts with the requested number of empty bars", () => {
    const section = createSection("Intro", 8);
    expect(section.label).toBe("Intro");
    expect(section.measures).toHaveLength(8);
    expect(section.measures.every((m) => m.chords.length === 0)).toBe(true);
  });
});

describe("isChordSheetEmpty", () => {
  it("treats empty/blank sheets as empty", () => {
    expect(isChordSheetEmpty(undefined)).toBe(true);
    expect(isChordSheetEmpty(createChordSheet())).toBe(true);
    expect(isChordSheetEmpty({ updatedAt: 1, sections: [createSection("Verse", 4)] })).toBe(true);
  });

  it("is non-empty once a chord or note exists", () => {
    expect(isChordSheetEmpty(sampleSheet())).toBe(false);
  });
});

describe("serializeChordSheetText", () => {
  it("renders bars in rows with the label and notes", () => {
    expect(serializeChordSheetText(sampleSheet())).toBe(
      "VERSE\n| C | Am | F | G G7 |\nlet it breathe"
    );
  });

  it("wraps long sections into multiple rows", () => {
    const sheet: ChordSheet = {
      updatedAt: 1,
      sections: [
        {
          id: "s",
          label: "A",
          notes: "",
          measures: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, chords: ["C"] })),
        },
      ],
    };
    expect(serializeChordSheetText(sheet)).toBe("A\n| C | C | C | C |\n| C | C |");
  });

  it("renders empty bars as a closed '| - |'", () => {
    const sheet: ChordSheet = {
      updatedAt: 1,
      sections: [
        {
          id: "s",
          label: "Intro",
          notes: "",
          measures: [
            { id: "m1", chords: ["C"] },
            { id: "m2", chords: ["C", "Fmaj"] },
            { id: "m3", chords: [] },
          ],
        },
      ],
    };
    expect(serializeChordSheetText(sheet)).toBe("INTRO\n| C | C Fmaj | - |");
  });
});

describe("sanitizeChordSheet", () => {
  it("drops malformed measures/sections and returns undefined when nothing valid", () => {
    expect(sanitizeChordSheet(null)).toBeUndefined();
    expect(sanitizeChordSheet({ sections: [{ noId: true }] })).toBeUndefined();
  });

  it("keeps valid structure and coerces missing fields", () => {
    const cleaned = sanitizeChordSheet({
      sections: [{ id: "s1", measures: [{ id: "m1", chords: ["C", 5] }] }],
    });
    expect(cleaned?.sections).toHaveLength(1);
    expect(cleaned?.sections[0].label).toBe("Section");
    expect(cleaned?.sections[0].notes).toBe("");
    expect(cleaned?.sections[0].measures[0].chords).toEqual(["C"]);
  });
});

describe("cloneChordSheet", () => {
  it("deep-clones with fresh ids", () => {
    const original = sampleSheet();
    const clone = cloneChordSheet(original)!;
    expect(clone.sections[0].id).not.toBe(original.sections[0].id);
    expect(clone.sections[0].measures[0].id).not.toBe(original.sections[0].measures[0].id);
    expect(clone.sections[0].measures[3].chords).toEqual(["G", "G7"]);
  });
});

describe("buildChordSheetHtml", () => {
  it("includes the title, section label, and bar cells; escapes HTML", () => {
    const html = buildChordSheetHtml("A <song>", "sub", sampleSheet());
    expect(html).toContain("A &lt;song&gt;");
    expect(html).toContain("Verse");
    expect(html).toContain("G G7");
  });
});
