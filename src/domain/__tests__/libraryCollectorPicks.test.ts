import { resolveCollectorPicks } from "../libraryCollectorPicks";
import type { Workspace } from "../../types";

function workspace(id: string, ideaIds: string[]): Workspace {
  return {
    id,
    title: id,
    ideas: ideaIds.map((ideaId) => ({ id: ideaId, title: ideaId })),
  } as unknown as Workspace;
}

describe("resolveCollectorPicks", () => {
  const workspaces = [workspace("A", ["a1", "a2"]), workspace("B", ["b1"])];

  it("resolves picks from several workspaces, in pick order", () => {
    const resolved = resolveCollectorPicks(workspaces, [
      { workspaceId: "B", ideaId: "b1" },
      { workspaceId: "A", ideaId: "a2" },
      { workspaceId: "A", ideaId: "a1" },
    ]);
    expect(resolved.map((r) => `${r.workspace.id}/${r.idea.id}`)).toEqual(["B/b1", "A/a2", "A/a1"]);
  });

  it("drops picks whose idea no longer exists", () => {
    const resolved = resolveCollectorPicks(workspaces, [
      { workspaceId: "A", ideaId: "gone" },
      { workspaceId: "A", ideaId: "a1" },
    ]);
    expect(resolved.map((r) => r.idea.id)).toEqual(["a1"]);
  });

  it("finds an idea that moved to another workspace since it was picked", () => {
    const resolved = resolveCollectorPicks(workspaces, [{ workspaceId: "A", ideaId: "b1" }]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].workspace.id).toBe("B");
  });
});
