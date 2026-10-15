import { buildClipLineages, buildEvolutionListRowsFromLineages } from "../domain/clipGraph";
import type { ClipVersion } from "../types";

function clip(id: string, createdAt: number): ClipVersion {
  return { id, title: id, notes: "", createdAt, isPrimary: false } as ClipVersion;
}

describe("evolution rows and groups", () => {
  const clips = [clip("a", 1), clip("b", 2)];
  const lineages = buildClipLineages(clips);
  const groups = [
    { id: "g-full", name: "Chorus tries", collapsed: false, createdAt: 1, updatedAt: 1 },
    { id: "g-empty", name: "Group 2", collapsed: false, createdAt: 1, updatedAt: 1 },
  ];

  it("heads a group that holds a take, with its count", () => {
    const rows = buildEvolutionListRowsFromLineages(lineages, {}, "desc", groups, { a: "g-full" });
    const heads = rows.filter((row) => row.kind === "group");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toMatchObject({ groupId: "g-full", lineageCount: 1 });
  });

  it("never draws a heading for an empty group (no more 0 takes)", () => {
    const rows = buildEvolutionListRowsFromLineages(lineages, {}, "desc", groups, {});
    expect(rows.some((row) => row.kind === "group")).toBe(false);
    expect(rows.filter((row) => row.kind === "clip")).toHaveLength(2);
  });
});
