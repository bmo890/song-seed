import { buildSaveDestinations } from "../collectionManagement";
import type { Workspace } from "../../types";

function collection(id: string, workspaceId: string, updatedAt: number, parentCollectionId: string | null = null) {
  return { id, title: id, workspaceId, parentCollectionId, createdAt: 0, updatedAt, ideasListState: {} };
}

function idea(id: string, collectionId: string) {
  return { id, collectionId, kind: "clip", title: id, createdAt: 0, clips: [] };
}

const band = {
  id: "ws-band",
  title: "Band",
  color: "#B87D6B",
  avatarKey: 7,
  collections: [
    collection("Demos", "ws-band", 100),
    collection("Rehearsals", "ws-band", 300),
    collection("March", "ws-band", 50, "Rehearsals"),
    collection("April", "ws-band", 200, "Rehearsals"),
  ],
  ideas: [idea("a", "Demos"), idea("b", "Demos"), idea("c", "April")],
} as unknown as Workspace;

const solo = {
  id: "ws-solo",
  title: "Solo",
  collections: [collection("Sketches", "ws-solo", 10)],
  ideas: [],
} as unknown as Workspace;

describe("buildSaveDestinations", () => {
  it("puts the active workspace first and nests children under their parent", () => {
    const destinations = buildSaveDestinations([solo, band], "ws-band");
    expect(destinations.map((d) => [d.collectionId, d.depth])).toEqual([
      ["Rehearsals", 0],
      ["April", 1],
      ["March", 1],
      ["Demos", 0],
      ["Sketches", 0],
    ]);
  });

  it("carries workspace identity and direct idea counts", () => {
    const destinations = buildSaveDestinations([band], "ws-band");
    const demos = destinations.find((d) => d.collectionId === "Demos")!;
    expect(demos.workspaceColor).toBe("#B87D6B");
    expect(demos.workspaceAvatarKey).toBe(7);
    expect(demos.itemCount).toBe(2);
    expect(destinations.find((d) => d.collectionId === "Rehearsals")!.itemCount).toBe(0);
    expect(destinations.find((d) => d.collectionId === "April")!.pathLabel).toBe("Rehearsals / April");
  });

  it("surfaces an orphaned collection at the top level", () => {
    const orphaned = {
      ...solo,
      collections: [collection("Lost", "ws-solo", 5, "missing-parent")],
    } as unknown as Workspace;
    expect(buildSaveDestinations([orphaned], null).map((d) => d.depth)).toEqual([0]);
  });
});
