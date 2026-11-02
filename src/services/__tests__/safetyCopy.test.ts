/**
 * Audit 2026-11-02, root cause 7: the copy of the library on this phone (the shadow
 * manifest) must survive the boots it exists for. Its previous generation is kept, a
 * copy set aside by a recovery question is out of reach of every later write, and a
 * session that never read the library can't overwrite it.
 */
const mockFiles = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) || uri.endsWith("songnook") })),
    makeDirectoryAsync: jest.fn(async () => {}),
    readAsStringAsync: jest.fn(async (uri: string) => {
        const value = mockFiles.get(uri);
        if (value == null) throw new Error(`ENOENT ${uri}`);
        return value;
    }),
    writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
        mockFiles.set(uri, value);
    }),
    copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
        mockFiles.set(to, mockFiles.get(from)!);
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
        mockFiles.set(to, mockFiles.get(from)!);
        mockFiles.delete(from);
    }),
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
    }),
}));
jest.mock("../../state/db/storage", () => ({ getKvNewestUpdatedAt: jest.fn(async () => null) }));
jest.mock("../persistLog", () => ({ persistLog: jest.fn(), describeError: (e: unknown) => String(e) }));

import {
    forceManifestWrite,
    holdSafetyCopy,
    readManifest,
    readSafetyCopy,
    releaseHeldSafetyCopy,
    resetManifestSessionForTests,
    SONG_NOOK_MANIFEST_HELD_PATH,
    SONG_NOOK_MANIFEST_PREVIOUS_PATH,
} from "../manifestSync";
import { setHydrationReadOutcome, setLastPersistedIdeaCount } from "../../state/persistRuntime";
import { authorizeIntentionalEmptyStateWrite } from "../stateIntegrity";

const library = (ideaCount: number) =>
    ({
        workspaces: [
            {
                id: "ws",
                title: "Mine",
                collections: [],
                ideas: Array.from({ length: ideaCount }, (_, i) => ({ id: `idea-${i}`, clips: [] })),
                isArchived: false,
            },
        ],
    }) as any;

const ideasIn = (copy: { workspaces: { ideas: unknown[] }[] } | null) =>
    copy ? copy.workspaces.reduce((sum, ws) => sum + ws.ideas.length, 0) : 0;

beforeEach(() => {
    mockFiles.clear();
    resetManifestSessionForTests();
    setHydrationReadOutcome("data");
    setLastPersistedIdeaCount(-1);
});

it("a session that never read the library can't overwrite the copy (01-H1)", async () => {
    await forceManifestWrite(library(40));
    // Next launch: the meta row is damaged; the store hydrates a starter library.
    resetManifestSessionForTests();
    setHydrationReadOutcome("failed");
    setLastPersistedIdeaCount(1);
    await forceManifestWrite(library(1));
    expect(ideasIn(await readManifest())).toBe(40);
});

it("keeps the previous generation: one bad session can't take the only good copy (root cause 7)", async () => {
    await forceManifestWrite(library(40));
    // Next session writes something much smaller, authorized or not.
    resetManifestSessionForTests();
    authorizeIntentionalEmptyStateWrite();
    await forceManifestWrite(library(0));
    await forceManifestWrite(library(2));
    expect(ideasIn(await readManifest())).toBe(2);
    const previous = JSON.parse(mockFiles.get(SONG_NOOK_MANIFEST_PREVIOUS_PATH)!);
    expect(ideasIn(previous)).toBe(40);
    // The best copy on the phone is still the 40-idea one.
    expect((await readSafetyCopy())?.ideaCount).toBe(40);

    // A later session with an empty current never pushes the good previous out.
    resetManifestSessionForTests();
    await forceManifestWrite(library(0));
    expect(ideasIn(JSON.parse(mockFiles.get(SONG_NOOK_MANIFEST_PREVIOUS_PATH)!))).toBeGreaterThan(0);
});

it("a held copy outlives every later write until Restore or Start fresh releases it (01-H2)", async () => {
    await forceManifestWrite(library(40));
    // "Restore your library?" is asked: the copy is held first. "Not now" changes nothing.
    const held = await holdSafetyCopy();
    expect(held?.held).toBe(true);
    expect(mockFiles.has(SONG_NOOK_MANIFEST_HELD_PATH)).toBe(true);

    // The person keeps working in the empty library for several sessions.
    for (let session = 0; session < 3; session++) {
        resetManifestSessionForTests();
        authorizeIntentionalEmptyStateWrite();
        await forceManifestWrite(library(session));
    }
    const copy = await readSafetyCopy();
    expect(copy?.held).toBe(true);
    expect(copy?.ideaCount).toBe(40);

    await releaseHeldSafetyCopy();
    expect((await readSafetyCopy())?.held).toBe(false);
});
