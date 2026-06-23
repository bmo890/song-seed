import {
    getRestoreRestartState,
    markRestoreReloadFailed,
    markRestoreReloading,
    requireRestoreRestart,
    resetRestoreRuntimeForTests,
    subscribeRestoreRestart,
} from "../restoreRuntime";

describe("restoreRuntime", () => {
    beforeEach(() => resetRestoreRuntimeForTests());

    it("publishes a required restart and retains failures for retry", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeRestoreRestart(listener);

        requireRestoreRestart(
            { workspaces: 1, collections: 2, ideas: 3, clips: 4 },
            1
        );
        expect(getRestoreRestartState()).toEqual({
            counts: { workspaces: 1, collections: 2, ideas: 3, clips: 4 },
            missingCount: 1,
            reloadStatus: "pending",
            reloadError: null,
        });

        markRestoreReloading();
        expect(getRestoreRestartState()?.reloadStatus).toBe("reloading");

        markRestoreReloadFailed(new Error("reload unavailable"));
        expect(getRestoreRestartState()).toEqual(
            expect.objectContaining({
                reloadStatus: "failed",
                reloadError: "reload unavailable",
            })
        );
        expect(listener).toHaveBeenCalledTimes(3);
        unsubscribe();
    });
});
