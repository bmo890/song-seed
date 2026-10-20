/**
 * A take the OS killed mid-capture: the recorder's WAV still has its placeholder
 * header (sizes 0) though every PCM byte is on disk. Recovery must finalize it BEFORE
 * the import probes it, or the clip lands as a flat 0:00 card (2026-10-18).
 */

const mockFiles = new Map<string, Uint8Array>();
const mockStorage = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
        mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
        mockStorage.delete(key);
    }),
}));

jest.mock("expo-file-system/legacy", () => ({
    getInfoAsync: jest.fn(async (uri: string) =>
        mockFiles.has(uri) ? { exists: true, size: mockFiles.get(uri)!.length } : { exists: false }
    ),
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
    }),
}));

jest.mock("expo-file-system", () => ({
    File: class {
        uri: string;
        constructor(uri: string) {
            this.uri = uri;
        }
        open() {
            const uri = this.uri;
            let offset = 0;
            return {
                get size() {
                    return mockFiles.get(uri)!.length;
                },
                get offset() {
                    return offset;
                },
                set offset(next: number) {
                    offset = next;
                },
                readBytes(length: number) {
                    const chunk = mockFiles.get(uri)!.slice(offset, offset + length);
                    offset += chunk.length;
                    return chunk;
                },
                writeBytes(bytes: Uint8Array) {
                    const next = mockFiles.get(uri)!.slice();
                    next.set(bytes, offset);
                    offset += bytes.length;
                    mockFiles.set(uri, next);
                },
                close() {},
            };
        }
    },
}));

// The import probes the file the way the native duration probe does: it believes the
// header. A header still at its placeholder therefore reads 0 s.
jest.mock("../audioStorage", () => ({
    importRecordedAudioAsset: jest.fn(async (uri: string, clipId: string) => {
        const bytes = mockFiles.get(uri)!;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const durationMs = Math.round((view.getUint32(40, true) / view.getUint32(28, true)) * 1000);
        const audioUri = `file:///doc/songnook/audio/${clipId}.wav`;
        mockFiles.set(audioUri, bytes);
        return { audioUri, durationMs, waveformPeaks: [] };
    }),
}));

const mockImportClip = jest.fn(() => ({ ideaId: "idea-recovered", clipId: "clip-recovered" }));
const mockFlush = jest.fn(async () => undefined);
jest.mock("../../state/actions", () => ({
    appActions: { importClipToCollection: (...args: unknown[]) => mockImportClip(...args) },
}));

type MockState = {
    activeWorkspaceId: string;
    recordingIdeaId: string | null;
    workspaces: Array<{ id: string; ideas: any[]; collections: Array<{ id: string }> }>;
    addCollection: jest.Mock;
};
let mockState: MockState;
jest.mock("../../state/useStore", () => ({
    flushPersistedSnapshot: () => mockFlush(),
    useStore: {
        getState: () => mockState,
        setState: (update: (state: MockState) => Partial<MockState>) => {
            mockState = { ...mockState, ...update(mockState) };
        },
    },
}));

jest.mock("../../i18n/instance", () => ({
    i18n: { t: (_key: string, options?: { name?: string }) => `Recovered · ${options?.name ?? ""}` },
}));
jest.mock("../../utils", () => ({
    buildDefaultIdeaTitle: () => "2:01PM Oct 18th",
    genRootClipTitle: () => "Idea 1",
}));
jest.mock("../persistLog", () => ({ persistLog: jest.fn() }));
const mockBackfill = jest.fn();
jest.mock("../backgroundWaveformHydration", () => ({
    enqueueMissingMetadataBackfill: (...args: unknown[]) => mockBackfill(...args),
}));

import { recoverPendingRecordingSession, persistPendingRecordingSession } from "../recordingRecovery";

const TAKE_URI = "file:///doc/AAD92B42-BE37-467B-BA7D-26DB306A2321.wav";

/** The 44-byte header the recorder writes at capture start, then `pcmBytes` of audio. */
function unfinalizedTake(pcmBytes: number) {
    const bytes = new Uint8Array(44 + pcmBytes);
    const view = new DataView(bytes.buffer);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    view.setUint32(4, 0x24, true);
    bytes.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 44100, true);
    view.setUint32(28, 88200, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    bytes.set([0x64, 0x61, 0x74, 0x61], 36);
    view.setUint32(40, 0, true);
    for (let i = 44; i < bytes.length; i += 1) bytes[i] = i % 251;
    return bytes;
}

/** The empty clip idea quick record opens before the take starts. */
const shell = {
    id: "idea-shell",
    title: "10:53 PM Oct 18th",
    kind: "clip",
    collectionId: "col-ideas",
    clips: [] as any[],
    createdAt: 1,
    lastActivityAt: 1,
};

beforeEach(() => {
    mockFiles.clear();
    mockStorage.clear();
    mockImportClip.mockClear();
    mockFlush.mockReset();
    mockFlush.mockResolvedValue(undefined);
    mockBackfill.mockClear();
    mockState = {
        activeWorkspaceId: "ws-1",
        recordingIdeaId: null,
        workspaces: [{ id: "ws-1", ideas: [], collections: [{ id: "col-ideas" }] }],
        addCollection: jest.fn(),
    };
});

function withShell() {
    mockState.workspaces[0].ideas = [shell];
    mockState.recordingIdeaId = shell.id;
}

describe("recoverPendingRecordingSession", () => {
    it("lands a killed take with its real length, audio untouched", async () => {
        const take = unfinalizedTake(88_200 * 10); // 10 s
        mockFiles.set(TAKE_URI, take);
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);

        await expect(recoverPendingRecordingSession()).resolves.toEqual({
            status: "recovered",
            title: "Recovered · 2:01PM Oct 18th",
        });

        expect(mockImportClip).toHaveBeenCalledTimes(1);
        const [collectionId, clip] = mockImportClip.mock.calls[0];
        expect(collectionId).toBe("col-ideas");
        expect(clip.durationMs).toBe(10_000);
        expect(clip.createdAt).toBe(1_792_353_379_373);

        const landed = mockFiles.get(clip.audioUri)!;
        expect(Buffer.from(landed.subarray(44))).toEqual(Buffer.from(take.subarray(44)));
        expect(mockFiles.has(TAKE_URI)).toBe(false);
        expect(mockStorage.size).toBe(0);
        // Its waveform is queued now, not on the next launch.
        expect(mockBackfill).toHaveBeenCalledTimes(1);
    });

    it("saves the library before it lets go of the take's marker", async () => {
        mockFiles.set(TAKE_URI, unfinalizedTake(88_200 * 10));
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);
        mockFlush.mockImplementation(async () => {
            // At the moment of the save, the marker still points at the take.
            expect(mockStorage.size).toBe(1);
        });

        await recoverPendingRecordingSession();
        expect(mockFlush).toHaveBeenCalledTimes(1);
        expect(mockStorage.size).toBe(0);
    });

    it("keeps a journal for the next launch when the save is refused", async () => {
        mockFiles.set(TAKE_URI, unfinalizedTake(88_200 * 10));
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);
        mockFlush.mockRejectedValue(new Error("persist blocked"));

        await expect(recoverPendingRecordingSession()).resolves.toMatchObject({ status: "recovered" });

        const marker = JSON.parse(Array.from(mockStorage.values())[0]);
        expect(marker.attached).toMatchObject({ ideaId: "idea-recovered", clipId: "clip-recovered" });
        // The marker points at the library's copy, which stays; the recorder temp goes.
        expect(mockFiles.has(marker.fileUri)).toBe(true);
        expect(mockFiles.has(TAKE_URI)).toBe(false);
    });

    it("says nothing was captured instead of listing a 0:00 clip", async () => {
        mockFiles.set(TAKE_URI, unfinalizedTake(0));
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);

        await expect(recoverPendingRecordingSession()).resolves.toEqual({ status: "empty" });

        expect(mockImportClip).not.toHaveBeenCalled();
        expect(mockFiles.has(TAKE_URI)).toBe(false);
        expect(mockStorage.size).toBe(0);
    });

    it("reports a take whose file is gone as missing", async () => {
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);
        await expect(recoverPendingRecordingSession()).resolves.toEqual({ status: "missing" });
        expect(mockImportClip).not.toHaveBeenCalled();
    });

    it("fills the quick-record shell the take was opened into, not a second idea", async () => {
        withShell();
        mockFiles.set(TAKE_URI, unfinalizedTake(88_200 * 10));
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);
        mockState.recordingIdeaId = null; // a fresh launch

        await expect(recoverPendingRecordingSession()).resolves.toEqual({
            status: "recovered",
            title: "10:53 PM Oct 18th",
        });

        expect(mockImportClip).not.toHaveBeenCalled();
        const ideas = mockState.workspaces[0].ideas;
        expect(ideas).toHaveLength(1);
        expect(ideas[0].id).toBe("idea-shell");
        expect(ideas[0].clips).toHaveLength(1);
        expect(mockBackfill).toHaveBeenCalledWith(mockState.workspaces);
        expect(ideas[0].clips[0]).toMatchObject({
            title: "Idea 1",
            isPrimary: true,
            durationMs: 10_000,
            createdAt: 1_792_353_379_373,
        });
        expect(mockStorage.size).toBe(0);
    });

    it("drops the shell when the take captured nothing", async () => {
        withShell();
        mockFiles.set(TAKE_URI, unfinalizedTake(0));
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);

        await expect(recoverPendingRecordingSession()).resolves.toEqual({ status: "empty" });
        expect(mockState.workspaces[0].ideas).toEqual([]);
    });

    it("leaves the shell alone in session, where the recorder still holds it", async () => {
        withShell();
        mockFiles.set(TAKE_URI, unfinalizedTake(88_200));
        await persistPendingRecordingSession(TAKE_URI, 1_792_353_379_373);

        await expect(recoverPendingRecordingSession({ lightweight: true })).resolves.toMatchObject({
            status: "recovered",
        });
        expect(mockImportClip).toHaveBeenCalledTimes(1);
        expect(mockState.workspaces[0].ideas[0].clips).toEqual([]);
    });
});
