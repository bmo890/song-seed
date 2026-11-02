import {
  collectionOwnerWorkspaceId,
  ideaOwnerWorkspaceId,
  isCollectionReadOnly,
  isIdeaReadOnly,
  locateIdea,
} from "../itemLocator";
import { firstWritableWorkspaceId, isReadOnlyWorkspace, isWritableWorkspaceId } from "../workspaceVisibility";
import type { Workspace } from "../../types";

const ws = (id: string, extra: Partial<Workspace> = {}): Workspace =>
  ({
    id,
    title: id,
    collections: [{ id: `${id}-col`, title: "c", workspaceId: id, parentCollectionId: null, createdAt: 0, updatedAt: 0 }],
    ideas: [{ id: `${id}-idea`, title: "i", kind: "clip", collectionId: `${id}-col`, clips: [] }],
    ...extra,
  }) as unknown as Workspace;

const library = [ws("pkg", { origin: "received" }), ws("mine"), ws("old", { isArchived: true })];

describe("item locator", () => {
  it("finds the workspace that owns an idea or a collection, wherever it is", () => {
    expect(ideaOwnerWorkspaceId(library, "mine-idea")).toBe("mine");
    expect(ideaOwnerWorkspaceId(library, "pkg-idea")).toBe("pkg");
    expect(collectionOwnerWorkspaceId(library, "old-col")).toBe("old");
    expect(locateIdea(library, "nowhere")).toBeNull();
    expect(ideaOwnerWorkspaceId(library, null)).toBeNull();
  });

  it("calls received parcels and archived workspaces read-only", () => {
    expect(isReadOnlyWorkspace(library[0])).toBe(true);
    expect(isReadOnlyWorkspace(library[1])).toBe(false);
    expect(isReadOnlyWorkspace(library[2])).toBe(true);
    expect(isIdeaReadOnly(library, "pkg-idea")).toBe(true);
    expect(isIdeaReadOnly(library, "mine-idea")).toBe(false);
    expect(isCollectionReadOnly(library, "old-col")).toBe(true);
    expect(isWritableWorkspaceId(library, "mine")).toBe(true);
    expect(isWritableWorkspaceId(library, "pkg")).toBe(false);
    expect(isWritableWorkspaceId(library, "gone")).toBe(false);
  });

  it("never picks a parcel or an archive as the fallback home", () => {
    expect(firstWritableWorkspaceId(library)).toBe("mine");
    expect(firstWritableWorkspaceId(library, "mine")).toBeNull();
  });
});
