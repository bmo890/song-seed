/**
 * Audit 2026-11-02 G7: a restore writes each clip's detail-waveform sidecar next to its
 * restored audio, and the next launch's finalization used to delete every one of them
 * (sidecars are never "referenced" by the library), so a new phone re-analysed the whole
 * library. A sidecar of audio the library still uses must survive finalization.
 */
const mockFiles = new Map<string, string>();

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    getInfoAsync: jest.fn(async (uri: string) => {
        if (mockFiles.has(uri)) return { exists: true, isDirectory: false, size: mockFiles.get(uri)!.length };
        const prefix = uri.endsWith("/") ? uri : `${uri}/`;
        const isDir = Array.from(mockFiles.keys()).some((path) => path.startsWith(prefix));
        return { exists: isDir, isDirectory: isDir };
    }),
    readAsStringAsync: jest.fn(async (uri: string) => {
        const value = mockFiles.get(uri);
        if (value == null) throw new Error(`Missing mock file: ${uri}`);
        return value;
    }),
    writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
        mockFiles.set(uri, value);
    }),
    makeDirectoryAsync: jest.fn(async () => {}),
    readDirectoryAsync: jest.fn(async (uri: string) => {
        const prefix = uri.endsWith("/") ? uri : `${uri}/`;
        return Array.from(
            new Set(
                Array.from(mockFiles.keys())
                    .filter((path) => path.startsWith(prefix))
                    .map((path) => path.slice(prefix.length).split("/")[0])
            )
        );
    }),
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
        for (const path of Array.from(mockFiles.keys())) {
            if (path.startsWith(`${uri}/`)) mockFiles.delete(path);
        }
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
        const value = mockFiles.get(from);
        if (value == null) throw new Error(`Missing mock file: ${from}`);
        mockFiles.set(to, value);
        mockFiles.delete(from);
    }),
}));

import {
    beginDisasterRecoveryRestoreJournal,
    cleanupInterruptedDisasterRecoveryRestores,
    markDisasterRecoveryRestoreCommitted,
} from "../disasterRecoveryTemp";
import { setHydrationDegradedWorkspaceIds, setHydrationReadOutcome } from "../../state/persistRuntime";

const TOKEN = "1700000000000-abc123";
const AUDIO = `songnook/audio/restored-${TOKEN}/clip-1.m4a`;
const SIDECAR = `${AUDIO}.waveform`;
const DROPPED = `songnook/audio/restored-${TOKEN}/clip-2.m4a`;

function workspacesUsing(audioPath: string) {
    return [
        {
            id: "ws-1",
            title: "Main",
            collections: [],
            ideas: [
                {
                    id: "idea-1",
                    title: "Song",
                    clips: [{ id: "clip-1", audioUri: `file:///doc/${audioPath}` }],
                },
            ],
        },
    ] as never;
}

beforeEach(() => {
    mockFiles.clear();
    setHydrationReadOutcome("data");
    setHydrationDegradedWorkspaceIds([]);
});

it("keeps the restored waveform sidecar of audio the library still uses", async () => {
    mockFiles.set(`file:///doc/${AUDIO}`, "audio");
    mockFiles.set(`file:///doc/${SIDECAR}`, '{"v":1}');
    mockFiles.set(`file:///doc/${DROPPED}`, "unused audio");
    mockFiles.set(`file:///doc/${DROPPED}.waveform`, '{"v":1}');
    await beginDisasterRecoveryRestoreJournal(TOKEN, [AUDIO, SIDECAR, DROPPED, `${DROPPED}.waveform`], []);
    await markDisasterRecoveryRestoreCommitted(TOKEN);

    await cleanupInterruptedDisasterRecoveryRestores(workspacesUsing(AUDIO));

    expect(mockFiles.has(`file:///doc/${AUDIO}`)).toBe(true);
    expect(mockFiles.has(`file:///doc/${SIDECAR}`)).toBe(true);
    // Files no clip uses still go, sidecars included.
    expect(mockFiles.has(`file:///doc/${DROPPED}`)).toBe(false);
    expect(mockFiles.has(`file:///doc/${DROPPED}.waveform`)).toBe(false);
});

it("waits for a boot that read the whole library before deleting restored files (03 #8)", async () => {
    mockFiles.set(`file:///doc/${AUDIO}`, "audio");
    mockFiles.set(`file:///doc/${DROPPED}`, "audio of a workspace set aside at this launch");
    await beginDisasterRecoveryRestoreJournal(TOKEN, [AUDIO, DROPPED], []);
    await markDisasterRecoveryRestoreCommitted(TOKEN);

    // The first launch after the restore set a workspace aside: its clips aren't in view.
    setHydrationDegradedWorkspaceIds(["ws-set-aside"]);
    await cleanupInterruptedDisasterRecoveryRestores(workspacesUsing(AUDIO));
    expect(mockFiles.has(`file:///doc/${DROPPED}`)).toBe(true);

    // Nor over a read that never happened (a damaged meta row).
    setHydrationDegradedWorkspaceIds([]);
    setHydrationReadOutcome("failed");
    await cleanupInterruptedDisasterRecoveryRestores(workspacesUsing(AUDIO));
    expect(mockFiles.has(`file:///doc/${DROPPED}`)).toBe(true);
});
