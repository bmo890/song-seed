import { createStore } from "zustand/vanilla";
import { createPlayerSlice, type PlayerSlice } from "../playerSlice";

describe("player queue screen ownership", () => {
    it("suppresses the dock atomically when preparing a queue for the Player screen", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        const queue = [{ ideaId: "idea-1", clipId: "clip-1" }];

        store.getState().setPlayerDockPresentationHold(true);
        store.getState().setPlayerQueueForScreen(queue, 0, true);

        expect(store.getState()).toMatchObject({
            playerQueue: queue,
            playerTarget: queue[0],
            playerShouldAutoplay: true,
            isPlayerScreenMounted: true,
            playerDockPresentationHold: false,
        });
    });

    it("does not change screen ownership for ordinary queue updates", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);

        store.getState().setPlayerQueue([{ ideaId: "idea-1", clipId: "clip-1" }], 0, true);

        expect(store.getState().isPlayerScreenMounted).toBe(false);
    });
});
