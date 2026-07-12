jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { createInitialWorkspace } from "../dataSlice";

/**
 * The starter library is the first-run guarantee: createInitialWorkspace is BOTH the
 * store's initial slice state and the fallback sanitizePersistedState substitutes when
 * no workspaces are present. A fresh user must land on "My Songs" with an "Ideas"
 * collection so the record button has a destination on the very first tap. (Regression
 * guard for the review finding where the separate seedStarterLibrary path was dead code.)
 */
describe("createInitialWorkspace (starter library)", () => {
    it("is titled 'My Songs' and contains one 'Ideas' collection", () => {
        const ws = createInitialWorkspace();
        expect(ws.title).toBe("My Songs");
        expect(ws.collections).toHaveLength(1);
        expect(ws.collections[0]?.title).toBe("Ideas");
        expect(ws.ideas).toHaveLength(0);
    });

    it("wires the collection to its workspace and gives both stable ids", () => {
        const ws = createInitialWorkspace();
        expect(ws.id).toBeTruthy();
        expect(ws.collections[0]?.workspaceId).toBe(ws.id);
        expect(ws.collections[0]?.parentCollectionId).toBeNull();
        expect(ws.collections[0]?.id).toBeTruthy();
    });
});
