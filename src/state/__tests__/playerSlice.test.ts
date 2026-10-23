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

describe("queue mutation actions", () => {
    const q = (n: number) => ({ ideaId: `idea-${n}`, clipId: `clip-${n}` });

    it("appends items to the end of the running queue", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1), q(2)], 0, true);

        store.getState().appendToPlayerQueue([q(3), q(4)]);

        expect(store.getState().playerQueue).toEqual([q(1), q(2), q(3), q(4)]);
        // Append never moves the playhead or the current target.
        expect(store.getState().playerQueueIndex).toBe(0);
        expect(store.getState().playerTarget).toEqual(q(1));
    });

    it("keeps the playing item selected after a reorder", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1), q(2), q(3)], 1, true); // playing q(2)

        // Move q(2) from the middle to the front.
        store.getState().reorderPlayerQueue([q(2), q(1), q(3)]);

        expect(store.getState().playerQueue).toEqual([q(2), q(1), q(3)]);
        expect(store.getState().playerQueueIndex).toBe(0);
        expect(store.getState().playerTarget).toEqual(q(2));
    });

    it("keeps the playing copy of a clip queued twice after a reorder", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        // A setlist that repeats a song: two rows with the same ids.
        const first = q(1);
        const again = q(1);
        const other = q(2);
        store.getState().setPlayerQueue([first, other, again], 2, true); // playing the repeat

        // Drag the playing repeat to the front; the rows are the live items.
        store.getState().reorderPlayerQueue([again, first, other]);

        expect(store.getState().playerQueueIndex).toBe(0);
        expect(store.getState().playerQueue[0]).toBe(again);
        expect(store.getState().playerTarget).toBe(again);
    });

    it("shifts the index down when removing an item above the playhead", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1), q(2), q(3)], 2, true); // playing q(3)

        store.getState().removeFromPlayerQueue(0); // remove q(1)

        expect(store.getState().playerQueue).toEqual([q(2), q(3)]);
        expect(store.getState().playerQueueIndex).toBe(1);
        expect(store.getState().playerTarget).toEqual(q(3));
    });

    it("advances to the next track when removing the currently playing item", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1), q(2), q(3)], 1, true);
        store.getState().setPlayerPlaybackState({ positionMs: 10, durationMs: 100, isPlaying: true });

        store.getState().removeFromPlayerQueue(1); // remove q(2), the current

        expect(store.getState().playerQueue).toEqual([q(1), q(3)]);
        expect(store.getState().playerQueueIndex).toBe(1);
        expect(store.getState().playerTarget).toEqual(q(3));
        expect(store.getState().playerShouldAutoplay).toBe(true);
    });

    it("ends the session when the last queue item is removed", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1)], 0, true);

        store.getState().removeFromPlayerQueue(0);

        expect(store.getState().playerQueue).toEqual([]);
        expect(store.getState().playerTarget).toBeNull();
        expect(store.getState().playerShouldAutoplay).toBe(false);
    });

    it("removing the last item while docked still requests a close", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1)], 0, true);
        store.getState().setPlayerPlaybackState({ positionMs: 10, durationMs: 100, isPlaying: true });
        expect(store.getState().isPlayerScreenMounted).toBe(false); // docked
        const token = store.getState().playerCloseRequestToken;

        store.getState().removeFromPlayerQueue(0);

        // The root provider stops the engine on this token; without it the dock
        // and sheet unmounted and the clip played on with no UI.
        expect(store.getState().playerCloseRequestToken).toBe(token + 1);
        expect(store.getState().playerTarget).toBeNull();
        expect(store.getState().playerIsPlaying).toBe(false);
    });
});

describe("playback numbers follow the target", () => {
    const q = (n: number) => ({ ideaId: `idea-${n}`, clipId: `clip-${n}` });
    const loaded = { positionMs: 12_000, durationMs: 34 * 60_000, isPlaying: false };

    it("clears the previous clip's position and duration when a different clip is opened", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1)], 0, true);
        store.getState().setPlayerPlaybackState(loaded);

        store.getState().setPlayerQueueForScreen([q(2)], 0, true);

        expect(store.getState()).toMatchObject({ playerTarget: q(2), playerPositionMs: 0, playerDurationMs: 0 });
    });

    it("keeps them when the queue changes around the same clip", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1)], 0, true);
        store.getState().setPlayerPlaybackState(loaded);

        store.getState().setPlayerQueue([q(1), q(2)], 0, false);

        expect(store.getState()).toMatchObject({ playerTarget: q(1), playerPositionMs: 12_000, playerDurationMs: 34 * 60_000 });
    });

    it("clears them on next/previous and when the playing item is removed", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1), q(2), q(3)], 0, true);
        store.getState().setPlayerPlaybackState(loaded);

        store.getState().advancePlayerQueue("next");
        expect(store.getState()).toMatchObject({ playerTarget: q(2), playerDurationMs: 0 });

        store.getState().setPlayerPlaybackState(loaded);
        store.getState().removeFromPlayerQueue(1);
        expect(store.getState()).toMatchObject({ playerTarget: q(3), playerDurationMs: 0 });
    });
});

describe("no-op requests do not notify", () => {
    const q = (n: number) => ({ ideaId: `idea-${n}`, clipId: `clip-${n}` });

    it("requestPlayerClose with no session leaves the state object untouched", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        const before = store.getState();
        store.getState().requestPlayerClose();
        expect(store.getState()).toBe(before);
    });

    it("requestPlayerClose with a session bumps the token", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1)], 0, false);
        const token = store.getState().playerCloseRequestToken;
        store.getState().requestPlayerClose();
        expect(store.getState().playerCloseRequestToken).toBe(token + 1);
    });

    it("requestPlayerClose with the screen mounted but no target still bumps the token", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerScreenMounted(true);
        const token = store.getState().playerCloseRequestToken;
        store.getState().requestPlayerClose();
        expect(store.getState().playerCloseRequestToken).toBe(token + 1);
    });

    it("requestInlineStop with nothing previewing leaves the state object untouched", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        const before = store.getState();
        store.getState().requestInlineStop();
        expect(store.getState()).toBe(before);
    });

    it("requestInlineStop with a preview clears it and bumps the token", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setInlineTarget(q(1));
        store.getState().setInlinePlaybackState({ positionMs: 500, durationMs: 1000, isPlaying: true });
        const token = store.getState().inlineStopRequestToken;
        store.getState().requestInlineStop();
        expect(store.getState()).toMatchObject({
            inlineStopRequestToken: token + 1,
            inlineTarget: null,
            inlinePositionMs: 0,
            inlineIsPlaying: false,
        });
    });

    it("setInlineTarget with an equal target leaves the state object untouched", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setInlineTarget(q(1));
        const before = store.getState();
        store.getState().setInlineTarget({ ...q(1) });
        expect(store.getState()).toBe(before);
        store.getState().setInlineTarget(q(2));
        expect(store.getState().inlineTarget).toEqual(q(2));
        store.getState().setInlineTarget(null);
        expect(store.getState().inlineTarget).toBeNull();
        const cleared = store.getState();
        store.getState().setInlineTarget(null);
        expect(store.getState()).toBe(cleared);
    });
});

describe("queue shuffle", () => {
    const q = (n: number) => ({ ideaId: `idea-${n}`, clipId: `clip-${n}` });
    const queue = [q(1), q(2), q(3), q(4), q(5), q(6), q(7), q(8)];

    it("shuffles around the playing item without changing what plays", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue(queue, 4, true);
        const target = store.getState().playerTarget;

        store.getState().togglePlayerQueueShuffle();

        const state = store.getState();
        expect(state.playerQueueUnshuffled).toBe(queue);
        expect(state.playerQueueIndex).toBe(0);
        expect(state.playerQueue[0]).toBe(queue[4]);
        expect(state.playerTarget).toBe(target);
        expect(state.playerQueue).toHaveLength(queue.length);
    });

    it("turning shuffle off restores the order and the playing item", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue(queue, 2, true);
        store.getState().togglePlayerQueueShuffle();
        store.getState().advancePlayerQueue("next", true);
        const playing = store.getState().playerTarget!;

        store.getState().togglePlayerQueueShuffle();

        const state = store.getState();
        expect(state.playerQueueUnshuffled).toBeNull();
        expect(state.playerQueue.map((item) => item.clipId)).toEqual(queue.map((item) => item.clipId));
        expect(state.playerQueue[state.playerQueueIndex].clipId).toBe(playing.clipId);
    });

    it("keeps shuffle when jumping within the queue, drops it for a new queue", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue(queue, 0, true);
        store.getState().togglePlayerQueueShuffle();

        const state = store.getState();
        state.setPlayerQueue(state.playerQueue, 3, true);
        expect(store.getState().playerQueueUnshuffled).not.toBeNull();

        store.getState().setPlayerQueue([q(9), q(10)], 0, true);
        expect(store.getState().playerQueueUnshuffled).toBeNull();
    });

    it("shuffle play starts a new queue already shuffled", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueueShuffled(queue, true);

        const state = store.getState();
        expect(state.playerQueueUnshuffled).toBe(queue);
        expect(state.playerQueueIndex).toBe(0);
        expect(state.playerTarget).toBe(state.playerQueue[0]);
        expect(state.playerShouldAutoplay).toBe(true);
    });

    it("emptying the queue ends shuffle", () => {
        const store = createStore<PlayerSlice>()(createPlayerSlice);
        store.getState().setPlayerQueue([q(1), q(2)], 0, true);
        store.getState().togglePlayerQueueShuffle();
        store.getState().clearPlayerQueue();
        expect(store.getState().playerQueueUnshuffled).toBeNull();
    });
});
