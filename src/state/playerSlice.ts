import { StateCreator } from "zustand";
import { PlayerTarget, InlineTarget, PlaybackQueueItem } from "../types";

export type PlayerSlice = {
    playerTarget: PlayerTarget;
    setPlayerTarget: (target: PlayerTarget) => void;
    playerQueue: PlaybackQueueItem[];
    playerQueueIndex: number;
    playerShouldAutoplay: boolean;
    playerPositionMs: number;
    playerDurationMs: number;
    playerIsPlaying: boolean;
    setPlayerPlaybackState: (state: { positionMs: number; durationMs: number; isPlaying: boolean }) => void;
    playerToggleRequestToken: number;
    requestPlayerToggle: () => void;
    playerCloseRequestToken: number;
    requestPlayerClose: () => void;
    setPlayerQueue: (queue: PlaybackQueueItem[], startIndex: number, shouldAutoplay?: boolean) => void;
    /** Sets the queue while atomically suppressing the dock during navigation to Player. */
    setPlayerQueueForScreen: (
        queue: PlaybackQueueItem[],
        startIndex: number,
        shouldAutoplay?: boolean
    ) => void;
    clearPlayerQueue: () => void;
    advancePlayerQueue: (direction: "next" | "previous", shouldAutoplay?: boolean) => void;
    consumePlayerAutoplay: () => void;
    /** True while the full Player screen is opening or mounted. When false (minimized
     *  to the dock), the root provider drives queue auto-advance + source loading. */
    isPlayerScreenMounted: boolean;
    setPlayerScreenMounted: (mounted: boolean) => void;
    /** Measured height of the media dock surface (0 when not visible). Used by
     *  SelectionDock and other bottom-anchored UI to avoid being covered. */
    playerDockHeight: number;
    setPlayerDockHeight: (height: number) => void;
    /** Keeps an existing dock visible while its full Player transition is opening. */
    playerDockPresentationHold: boolean;
    setPlayerDockPresentationHold: (hold: boolean) => void;
    /** Measured height of the active selection toolbar (0 when not visible). Used by
     *  GlobalMediaDock to sit above the selection bar rather than overlap it. */
    activeSelectionDockHeight: number;
    setActiveSelectionDockHeight: (height: number) => void;

    inlineTarget: InlineTarget;
    setInlineTarget: (target: InlineTarget) => void;
    inlinePositionMs: number;
    inlineDurationMs: number;
    inlineIsPlaying: boolean;
    setInlinePlaybackState: (state: { positionMs: number; durationMs: number; isPlaying: boolean }) => void;
    inlineStopRequestToken: number;
    requestInlineStop: () => void;
};

export const createPlayerSlice: StateCreator<PlayerSlice> = (set) => ({
    playerTarget: null,
    setPlayerTarget: (target) => set({ playerTarget: target }),
    playerQueue: [],
    playerQueueIndex: 0,
    playerShouldAutoplay: false,
    playerPositionMs: 0,
    playerDurationMs: 0,
    playerIsPlaying: false,
    setPlayerPlaybackState: ({ positionMs, durationMs, isPlaying }) =>
        set((state) => {
            if (
                state.playerPositionMs === positionMs &&
                state.playerDurationMs === durationMs &&
                state.playerIsPlaying === isPlaying
            ) {
                return state;
            }
            return {
                playerPositionMs: positionMs,
                playerDurationMs: durationMs,
                playerIsPlaying: isPlaying,
            };
        }),
    playerToggleRequestToken: 0,
    requestPlayerToggle: () =>
        set((state) => ({
            playerToggleRequestToken: state.playerToggleRequestToken + 1,
        })),
    playerCloseRequestToken: 0,
    requestPlayerClose: () =>
        set((state) => ({
            playerCloseRequestToken: state.playerCloseRequestToken + 1,
        })),
    setPlayerQueue: (queue, startIndex, shouldAutoplay = false) => {
        const clampedIndex = Math.max(0, Math.min(startIndex, Math.max(queue.length - 1, 0)));
        set({
            playerQueue: queue,
            playerQueueIndex: clampedIndex,
            playerTarget: queue[clampedIndex] ?? null,
            playerShouldAutoplay: shouldAutoplay && queue.length > 0,
        });
    },
    setPlayerQueueForScreen: (queue, startIndex, shouldAutoplay = false) => {
        const clampedIndex = Math.max(0, Math.min(startIndex, Math.max(queue.length - 1, 0)));
        set({
            playerQueue: queue,
            playerQueueIndex: clampedIndex,
            playerTarget: queue[clampedIndex] ?? null,
            playerShouldAutoplay: shouldAutoplay && queue.length > 0,
            isPlayerScreenMounted: true,
            playerDockPresentationHold: false,
        });
    },
    clearPlayerQueue: () =>
        set({
            playerQueue: [],
            playerQueueIndex: 0,
            playerTarget: null,
            playerShouldAutoplay: false,
            playerPositionMs: 0,
            playerDurationMs: 0,
            playerIsPlaying: false,
        }),
    advancePlayerQueue: (direction, shouldAutoplay = true) =>
        set((state) => {
            if (state.playerQueue.length === 0) return state;
            const delta = direction === "next" ? 1 : -1;
            const nextIndex = state.playerQueueIndex + delta;
            if (nextIndex < 0 || nextIndex >= state.playerQueue.length) return state;
            return {
                playerQueueIndex: nextIndex,
                playerTarget: state.playerQueue[nextIndex] ?? null,
                playerShouldAutoplay: shouldAutoplay,
            };
        }),
    consumePlayerAutoplay: () => set({ playerShouldAutoplay: false }),
    isPlayerScreenMounted: false,
    setPlayerScreenMounted: (mounted) => set({ isPlayerScreenMounted: mounted }),
    playerDockHeight: 0,
    setPlayerDockHeight: (height) => set({ playerDockHeight: height }),
    playerDockPresentationHold: false,
    setPlayerDockPresentationHold: (hold) => set({ playerDockPresentationHold: hold }),
    activeSelectionDockHeight: 0,
    setActiveSelectionDockHeight: (height) => set({ activeSelectionDockHeight: height }),

    inlineTarget: null,
    setInlineTarget: (target) => set({ inlineTarget: target }),
    inlinePositionMs: 0,
    inlineDurationMs: 0,
    inlineIsPlaying: false,
    setInlinePlaybackState: ({ positionMs, durationMs, isPlaying }) =>
        set((state) => {
            if (
                state.inlinePositionMs === positionMs &&
                state.inlineDurationMs === durationMs &&
                state.inlineIsPlaying === isPlaying
            ) {
                return state;
            }
            return {
                inlinePositionMs: positionMs,
                inlineDurationMs: durationMs,
                inlineIsPlaying: isPlaying,
            };
        }),
    inlineStopRequestToken: 0,
    requestInlineStop: () =>
        set((state) => ({
            inlineStopRequestToken: state.inlineStopRequestToken + 1,
            inlineTarget: null,
            inlinePositionMs: 0,
            inlineDurationMs: 0,
            inlineIsPlaying: false,
        })),
});
