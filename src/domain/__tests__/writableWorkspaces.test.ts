import { personalWorkspaces, writableWorkspaces } from "../workspaceVisibility";
import type { Workspace } from "../../types";

function ws(id: string, extra: Partial<Workspace> = {}): Workspace {
  return { id, title: id, collections: [], ideas: [], ...extra } as unknown as Workspace;
}

describe("writableWorkspaces", () => {
  const own = ws("own");
  const archived = ws("archived", { isArchived: true });
  const received = ws("received", { origin: "received" } as Partial<Workspace>);

  it("offers only the user's own, unarchived workspaces as places to save or move into", () => {
    expect(writableWorkspaces([own, archived, received]).map((w) => w.id)).toEqual(["own"]);
  });

  it("leaves the workspace list's view alone: archived ones still show there", () => {
    expect(personalWorkspaces([own, archived, received]).map((w) => w.id)).toEqual(["own", "archived"]);
  });
});
