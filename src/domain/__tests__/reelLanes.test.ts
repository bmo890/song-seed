import {
    PIN_LANE_HEAD_STRIP,
    PIN_LANE_ROW_HEIGHT,
    PIN_LANE_TOP_PAD,
    layoutPinLane,
    listeningReelHeightForBody,
    pinHeadY,
    pinLaneHeight,
    pinLaneRowCount,
    reelHeightForFlow,
    sectionLaneHeight,
} from "../reelLanes";

// 1 px per ms keeps the arithmetic readable: a pin at 100 ms sits at x = 100.
const lay = (markers: { atMs: number; label?: string }[], width: (label?: string) => number = () => 60) =>
    layoutPinLane(markers, 1, 1, 10_000, "full", (marker) => width(marker.label));

describe("layoutPinLane", () => {
    it("puts a lone named pin on the top row", () => {
        const [only] = lay([{ atMs: 100, label: "Intro" }]);
        expect(only.row).toBe(0);
        expect(only.anchor).toBe("start");
    });

    it("staggers a colliding name DOWN so its stem starts below its neighbour", () => {
        const [first, second] = lay([
            { atMs: 100, label: "Drums in" },
            { atMs: 130, label: "Late" },
        ]);
        expect(first.row).toBe(0);
        expect(second.row).toBe(1);
    });

    it("hides a third colliding name rather than opening a third row", () => {
        const placed = lay([
            { atMs: 100, label: "a" },
            { atMs: 120, label: "b" },
            { atMs: 140, label: "c" },
        ]);
        expect(placed.map((p) => p.row)).toEqual([0, 1, -1]);
        expect(pinLaneRowCount(placed)).toBe(2);
    });

    it("keeps a top-row stem out of a name on the row beneath", () => {
        // First takes the top row to x≈167. Second collides and drops to row 1,
        // reaching x≈217. Third (x=200) is clear of the top row but its stem would
        // cut through the second's name, and row 1 is taken there too: it yields.
        const placed = lay([
            { atMs: 100, label: "a" },
            { atMs: 150, label: "b" },
            { atMs: 200, label: "c" },
        ]);
        expect(placed.map((p) => p.row)).toEqual([0, 1, -1]);
    });

    it("returns to the top row once both rows are clear", () => {
        const placed = lay([
            { atMs: 100, label: "a" },
            { atMs: 130, label: "b" },
            { atMs: 400, label: "c" },
        ]);
        expect(placed[2].row).toBe(0);
    });

    it("flies the name to the left near the clip's end", () => {
        const [last] = layoutPinLane([{ atMs: 9_980, label: "Outro" }], 1, 1, 10_000, "full", () => 60);
        expect(last.anchor).toBe("end");
    });

    it("draws no names for an unnamed pin or on the slim reel", () => {
        expect(lay([{ atMs: 100 }])[0].row).toBe(-1);
        const slim = layoutPinLane([{ atMs: 100, label: "Intro" }], 1, 1, 10_000, "slim");
        expect(slim[0].row).toBe(-1);
    });
});

describe("lane heights", () => {
    it("takes no room when there is nothing to show", () => {
        expect(pinLaneHeight(0, 0)).toBe(0);
        expect(sectionLaneHeight(0, "full")).toBe(0);
    });

    it("grows a row at a time and always keeps the head strip", () => {
        expect(pinLaneHeight(3, 0)).toBe(PIN_LANE_TOP_PAD + PIN_LANE_HEAD_STRIP);
        expect(pinLaneHeight(3, 2)).toBe(PIN_LANE_TOP_PAD + 2 * PIN_LANE_ROW_HEIGHT + PIN_LANE_HEAD_STRIP);
    });

    it("seats a hidden pin's head in the strip and a named one beside its name", () => {
        const lane = pinLaneHeight(2, 1);
        expect(pinHeadY(-1, lane)).toBe(lane - PIN_LANE_HEAD_STRIP / 2);
        expect(pinHeadY(0, lane)).toBe(PIN_LANE_TOP_PAD + PIN_LANE_ROW_HEIGHT / 2);
    });

    it("keeps only the rule on the slim reel", () => {
        expect(sectionLaneHeight(2, "slim")).toBeLessThan(sectionLaneHeight(2, "full"));
    });
});

describe("reelHeightForFlow", () => {
    // iPhone 17: 874 window, 62 + 34 insets.
    const tall = 874 - 62 - 34;
    it("gives the reel what the pages and the note leave", () => {
        expect(reelHeightForFlow("listening", tall, { pages: "tiles", note: true })).toBe(260);
        expect(reelHeightForFlow("listening", tall, { pages: "tiles", note: false })).toBe(314);
        expect(reelHeightForFlow("listening", tall, { pages: "slots", note: true })).toBe(332);
    });
    it("caps the reel so it stays a reel, not a wall", () => {
        expect(reelHeightForFlow("listening", tall)).toBe(400);
        expect(reelHeightForFlow("listening", 1200, { pages: "tiles", note: true })).toBe(400);
    });
    it("never drops the listening reel under its floor on a short phone", () => {
        expect(reelHeightForFlow("listening", 568 - 20, { pages: "tiles", note: true })).toBe(120);
    });
    it("pays rent once something opens beneath it", () => {
        expect(reelHeightForFlow("tools", tall)).toBe(112);
        expect(reelHeightForFlow("reading", tall)).toBe(64);
    });
});

describe("the listening reel's half of the page", () => {
    it("takes the top half of the body", () => {
        expect(listeningReelHeightForBody(600)).toBe(300);
    });

    it("shares that half with the layer lanes under it", () => {
        // Two layers used to sit on top of a half-page reel and squeeze the pages.
        expect(listeningReelHeightForBody(600, 130)).toBe(170);
    });

    it("never shrinks below its floor, however many layers", () => {
        expect(listeningReelHeightForBody(600, 400)).toBe(120);
    });
});
