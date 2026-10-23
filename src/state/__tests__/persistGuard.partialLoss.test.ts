jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../services/waveformAnalysis", () => ({}));
jest.mock("../../services/audioStorage", () => ({}));
jest.mock("../../services/manifestSync", () => ({ startManifestSync: jest.fn() }));

// The sharded SQLite adapter under the guard: hydrates empty, records what it is handed.
const mockFlushNow = jest.fn(async (..._args: unknown[]) => undefined);
const mockSetItem = jest.fn();
jest.mock("../shardedPersistStorage", () => ({
    createShardedPersistStorage: () => ({
        getItem: () => null,
        setItem: (...args: unknown[]) => mockSetItem(...args),
        removeItem: jest.fn(),
        flushNow: (...args: unknown[]) => mockFlushNow(...args),
    }),
}));

import { flushPersistedSnapshot, useStore } from "../useStore";
import {
    clearPersistBlockedSignal,
    getLastPersistedIdeaCount,
    isPersistBlocked,
    onPersistHealthChange,
    setHydrationReadOutcome,
    setLastPersistedIdeaCount,
    setPersistBlocked,
    type PersistHealth,
} from "../persistRuntime";
import { PersistSkippedError } from "../persistedSnapshot";
import { authorizeIntentionalEmptyStateWrite } from "../../services/stateIntegrity";

/**
 * The "catastrophic partial loss" gate (docs/data-loss-hardening-verification.md,
 * "Corruption guard"): one write that drops ≥10 ideas AND ≥40 % of the library
 * without an authorized bulk delete is refused and locks persistence for the
 * session. It never fired before 2026-10-22: `partialize` advanced the compared
 * count inside every set(), ahead of the guard, so every write matched itself.
 */

const NOW = Date.now();

function ideas(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: `idea-${i}`,
        title: `Idea ${i}`,
        notes: "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId: "col",
        createdAt: NOW,
        lastActivityAt: NOW,
        clips: [],
    }));
}

function library(count: number) {
    return [
        {
            id: "ws",
            title: "W",
            collections: [
                {
                    id: "col",
                    title: "Ideas",
                    workspaceId: "ws",
                    parentCollectionId: null,
                    createdAt: NOW,
                    updatedAt: NOW,
                    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                },
            ],
            ideas: ideas(count),
        },
    ] as unknown as ReturnType<typeof useStore.getState>["workspaces"];
}

function lastFlushedIdeaCount(): number {
    const call = mockFlushNow.mock.calls[mockFlushNow.mock.calls.length - 1];
    const value = call?.[1] as { state: { workspaces: { ideas: unknown[] }[] } };
    return value.state.workspaces.reduce((sum, ws) => sum + ws.ideas.length, 0);
}

let seenHealth: PersistHealth[] = [];
let unsubscribe: () => void = () => {};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    setPersistBlocked(false);
    clearPersistBlockedSignal();
    setHydrationReadOutcome("data");
    authorizeIntentionalEmptyStateWrite(0); // no grant left over from another test
    seenHealth = [];
    unsubscribe = onPersistHealthChange((health) => seenHealth.push(health));
});

afterEach(() => {
    unsubscribe();
    jest.restoreAllMocks();
});

describe("persist guard: catastrophic partial loss", () => {
    it("arms from a fresh session: the count follows the writes that pass", async () => {
        setLastPersistedIdeaCount(0);
        useStore.setState({ workspaces: library(30) });
        await flushPersistedSnapshot();
        expect(lastFlushedIdeaCount()).toBe(30);
        expect(getLastPersistedIdeaCount()).toBe(30);
    });

    it("refuses one unauthorized write that drops ≥10 ideas and ≥40 %, and says so", async () => {
        useStore.setState({ workspaces: library(30) });
        setLastPersistedIdeaCount(30);

        useStore.setState({ workspaces: library(10) });
        await expect(flushPersistedSnapshot()).rejects.toBeInstanceOf(PersistSkippedError);

        expect(mockFlushNow).not.toHaveBeenCalled();
        expect(isPersistBlocked()).toBe(true);
        expect(getLastPersistedIdeaCount()).toBe(30); // the shadow count stays high
        expect(seenHealth).toEqual(["ok", "blocked"]); // the banner's signal
    });

    it("lets an ordinary small delete through", async () => {
        useStore.setState({ workspaces: library(30) });
        setLastPersistedIdeaCount(30);

        useStore.setState({ workspaces: library(25) }); // −5: under the absolute floor
        await flushPersistedSnapshot();
        expect(lastFlushedIdeaCount()).toBe(25);
        expect(isPersistBlocked()).toBe(false);
        expect(getLastPersistedIdeaCount()).toBe(25);
    });

    it("lets an authorized bulk delete, down to zero, through", async () => {
        useStore.setState({ workspaces: library(30) });
        setLastPersistedIdeaCount(30);

        authorizeIntentionalEmptyStateWrite(6);
        useStore.setState({ workspaces: library(0) });
        await flushPersistedSnapshot();
        expect(lastFlushedIdeaCount()).toBe(0);
        expect(isPersistBlocked()).toBe(false);
        expect(getLastPersistedIdeaCount()).toBe(0);
        expect(seenHealth).toEqual(["ok"]);
    });

    it("refuses an unauthorized write to zero", async () => {
        useStore.setState({ workspaces: library(3) });
        setLastPersistedIdeaCount(3);

        useStore.setState({ workspaces: library(0) });
        await expect(flushPersistedSnapshot()).rejects.toBeInstanceOf(PersistSkippedError);
        expect(mockFlushNow).not.toHaveBeenCalled();
        expect(isPersistBlocked()).toBe(true);
        expect(seenHealth).toEqual(["ok", "blocked"]);
    });
});
