import { resolveStartupWorkspaceId } from "../libraryNavigation";
import type { Workspace } from "../../types";

const ws = (id: string, extra: Partial<Workspace> = {}) =>
    ({ id, title: id, collections: [], ideas: [], ...extra }) as unknown as Workspace;

describe("startup workspace", () => {
    const mine = ws("mine");
    const parcel = ws("parcel", { origin: "received" } as Partial<Workspace>);
    const archived = ws("old", { isArchived: true });

    it("never opens a received parcel, even when it was the last one looked at", () => {
        expect(
            resolveStartupWorkspaceId({
                workspaces: [mine, parcel],
                primaryWorkspaceId: null,
                lastUsedWorkspaceId: "parcel",
                preference: "last-used",
            })
        ).toBe("mine");
    });

    it("never opens an archived workspace", () => {
        expect(
            resolveStartupWorkspaceId({
                workspaces: [archived, mine],
                primaryWorkspaceId: "old",
                lastUsedWorkspaceId: "old",
                preference: "primary",
            })
        ).toBe("mine");
    });
});
