import { resolveShareImportDestinations } from "../hooks/useShareImportDestinations";
import type { Workspace } from "../../../types";

/** 12f F-H1: share import listed archived workspaces and received parcels. */

const ws = (id: string, extra: Partial<Workspace> = {}): Workspace =>
  ({
    id,
    title: id,
    collections: [{ id: `${id}-col`, title: "Ideas", workspaceId: id, parentCollectionId: null, createdAt: 0, updatedAt: 0 }],
    ideas: [],
    ...extra,
  }) as unknown as Workspace;

const workspaces = [
  ws("pkg", { origin: "received" }),
  ws("mine"),
  ws("old", { isArchived: true }),
];

describe("share import destinations", () => {
  it("offers only your own live workspaces", () => {
    const result = resolveShareImportDestinations({ workspaces, activeWorkspaceId: "mine", fallbackCollectionId: null });
    expect(result.otherCollectionDestinations.map((d) => d.workspaceId)).toEqual(["mine"]);
  });

  it("never treats a parcel's collection as the current one", () => {
    const result = resolveShareImportDestinations({ workspaces, activeWorkspaceId: "mine", fallbackCollectionId: "pkg-col" });
    expect(result.currentCollection).toBeNull();
    expect(result.targetWorkspace?.id).toBe("mine");
  });
});
