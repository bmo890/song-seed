import { createListGeometry, rowKind, rowKindOf } from "../listGeometry";
import type { IdeaListEntry } from "../types";

const idea = (id: string, divider?: string): IdeaListEntry => ({
  key: `idea:${id}`,
  type: "idea",
  ideaId: id,
  dayLabel: "Today",
  dayDividerLabel: divider ?? null,
  dayStartTs: null,
});
const collapsed = (ts: number): IdeaListEntry => ({
  key: `collapsedDay:created:${ts}`,
  type: "collapsedDay",
  label: "July",
  dayStartTs: ts,
  count: 3,
});

describe("list geometry (behind getItemLayout)", () => {
  it("places rows after the padding, the header cell and its gap, each row followed by a gap", () => {
    const g = createListGeometry({ "idea|comfortable|0": 100, "idea|comfortable|1": 140 });
    g.configure({ entries: [idea("a"), idea("b", "Yesterday"), idea("c")], density: "comfortable", paddingTop: 230, headerLength: 0, gap: 8 });
    expect(g.getItemLayout(0)).toEqual({ length: 108, offset: 238, index: 0 });
    expect(g.getItemLayout(1)).toEqual({ length: 148, offset: 346, index: 1 });
    expect(g.getItemLayout(2)).toEqual({ length: 108, offset: 494, index: 2 });
    expect(g.contentLength()).toBe(602);
  });

  it("adopts the first measurement of a kind for every row of that kind", () => {
    const g = createListGeometry({ "idea|compact|0": 50 });
    g.configure({ entries: [idea("a"), idea("b"), idea("c")], density: "compact", paddingTop: 0, headerLength: 0, gap: 0 });
    expect(g.report("idea:b", rowKind("idea", "compact", false), 72.4)).toBe(true);
    expect(g.offsetOf(2)).toBe(144);
    // The same value again changes nothing.
    expect(g.report("idea:a", rowKind("idea", "compact", false), 72)).toBe(false);
  });

  it("lets one row keep its own height when it measures unlike its kind", () => {
    const g = createListGeometry();
    g.configure({ entries: [idea("a"), idea("b"), idea("c")], density: "comfortable", paddingTop: 0, headerLength: 0, gap: 0 });
    const kind = rowKind("idea", "comfortable", false);
    g.report("idea:a", kind, 110);
    expect(g.report("idea:b", kind, 130)).toBe(true);
    expect(g.offsetOf(1)).toBe(110);
    expect(g.offsetOf(2)).toBe(240);
    // Back in line with its kind: the override is dropped.
    expect(g.report("idea:b", kind, 110)).toBe(true);
    expect(g.offsetOf(2)).toBe(220);
  });

  it("moves every row when the header grows", () => {
    const g = createListGeometry({ "idea|comfortable|0": 100 });
    g.configure({ entries: [idea("a"), idea("b")], density: "comfortable", paddingTop: 10, headerLength: 0, gap: 8 });
    expect(g.offsetOf(0)).toBe(18);
    expect(g.setHeaderLength(60)).toBe(true);
    expect(g.offsetOf(0)).toBe(78);
    expect(g.setHeaderLength(60)).toBe(false);
  });

  it("keys collapsed-day markers and dividered cards as their own kinds", () => {
    expect(rowKindOf(collapsed(1), "compact")).toBe("collapsedDay|compact|0");
    expect(rowKindOf(idea("a", "July"), "comfortable")).toBe("idea|comfortable|1");
    expect(rowKindOf(idea("a"), "comfortable")).toBe("idea|comfortable|0");
  });
});
