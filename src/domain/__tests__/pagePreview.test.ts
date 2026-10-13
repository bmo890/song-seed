import { buildChartPreview, buildLyricPreview, chartBarText, countChartBars } from "../pagePreview";
import type { ChordSheet } from "../../types";

const bar = (id: string, ...chords: string[]) => ({ id, chords });
const sheet = (sections: ChordSheet["sections"]): ChordSheet => ({ sections, updatedAt: 0 });

describe("buildLyricPreview", () => {
    it("prints the top of the page and keeps stanza breaks", () => {
        expect(buildLyricPreview("\n\nOne\nTwo\n\n\nThree\n")).toBe("One\nTwo\n\nThree");
    });
    it("stops at what the tile holds and never ends on a blank", () => {
        expect(buildLyricPreview("a\nb\n\nc\nd", 3)).toBe("a\nb");
    });
    it("is empty for a blank page", () => {
        expect(buildLyricPreview("  \n \n")).toBe("");
    });
});

describe("buildChartPreview", () => {
    it("lays a section out as its name and two-bar systems", () => {
        const rows = buildChartPreview(
            sheet([{ id: "v", label: "Verse", notes: "", measures: [bar("1", "C"), bar("2", "Am"), bar("3", "F")] }])
        );
        expect(rows).toEqual([
            { kind: "label", key: "v-label", text: "Verse" },
            { kind: "bars", key: "v-0", cells: ["C", "Am"] },
            { kind: "bars", key: "v-1", cells: ["F"] },
        ]);
    });
    it("shows only the first two systems of a long section, then the next section", () => {
        const long = Array.from({ length: 8 }, (_, i) => bar(`m${i}`, "G"));
        const rows = buildChartPreview(
            sheet([
                { id: "a", label: "A", notes: "", measures: long },
                { id: "b", label: "B", notes: "", measures: [bar("x", "D")] },
            ])
        );
        expect(rows.map((row) => row.kind)).toEqual(["label", "bars", "bars", "label", "bars"]);
    });
    it("keeps a text block and skips an empty section", () => {
        const rows = buildChartPreview(
            sheet([
                { id: "t", label: "", notes: "", measures: [], kind: "text", text: " Spoken intro " },
                { id: "e", label: "Empty", notes: "", measures: [] },
            ])
        );
        expect(rows).toEqual([{ kind: "text", key: "t", text: "Spoken intro" }]);
    });
    it("is empty with no chart", () => {
        expect(buildChartPreview(null)).toEqual([]);
    });
});

describe("chart bars", () => {
    it("draws an empty bar as a rest and a split bar as both chords", () => {
        expect(chartBarText([])).toBe("—");
        expect(chartBarText(["C", " G7 "])).toBe("C  G7");
    });
    it("counts bars, not text blocks", () => {
        expect(
            countChartBars(
                sheet([
                    { id: "a", label: "A", notes: "", measures: [bar("1", "C"), bar("2", "F")] },
                    { id: "t", label: "", notes: "", measures: [], kind: "text", text: "x" },
                ])
            )
        ).toBe(2);
    });
});
