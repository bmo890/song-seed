const mockDeleteAsync = jest.fn();
const mockAsyncStorageClear = jest.fn();
const mockClearStorage = jest.fn();
const mockRemoveItem = jest.fn();
const mockWaitIdle = jest.fn(async (..._args: unknown[]) => undefined);
const mockDeleteDatabaseFiles = jest.fn();
const mockReload = jest.fn();
const mockStopManifestSync = jest.fn();
const mockSetPersistBlocked = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    cacheDirectory: "file:///cache/",
    deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));
jest.mock("expo", () => ({ reloadAppAsync: (...args: unknown[]) => mockReload(...args) }));
jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: { clear: (...args: unknown[]) => mockAsyncStorageClear(...args) },
}));
const fakeStore = () => ({
    persist: { clearStorage: (...args: unknown[]) => mockClearStorage(...args) },
    getState: () => ({ clearPlayerQueue: jest.fn(), clearRecordingContext: jest.fn() }),
});
jest.mock("../../state/useStore", () => ({
    useStore: {
        persist: {
            getOptions: () => ({ storage: { removeItem: (...args: unknown[]) => mockRemoveItem(...args) } }),
        },
        getState: () => ({ clearPlayerQueue: jest.fn(), clearRecordingContext: jest.fn() }),
    },
}));
jest.mock("../../state/db/storage", () => ({ waitForWriteQueueIdle: (...args: unknown[]) => mockWaitIdle(...args) }));
jest.mock("../../state/persistedSnapshot", () => ({ STORE_NAME: "songnook-store" }));
jest.mock("../../state/useActivityStore", () => ({ useActivityStore: fakeStore() }));
jest.mock("../../state/useChartPrefsStore", () => ({ useChartPrefsStore: fakeStore() }));
jest.mock("../../state/useMagpiePrefsStore", () => ({ useMagpiePrefsStore: fakeStore() }));
jest.mock("../../state/useRevisitStore", () => ({ useRevisitStore: fakeStore() }));
jest.mock("../../state/useSentLinksStore", () => ({ useSentLinksStore: fakeStore() }));
jest.mock("../../state/useShelfStore", () => ({ useShelfStore: fakeStore() }));
jest.mock("../../state/useStepUpPresetsStore", () => ({ useStepUpPresetsStore: fakeStore() }));
jest.mock("../../state/persistRuntime", () => ({
    setPersistBlocked: (...args: unknown[]) => mockSetPersistBlocked(...args),
    clearPersistBlockedSignal: jest.fn(),
}));
jest.mock("../../state/db/database", () => ({
    deleteDatabaseFiles: (...args: unknown[]) => mockDeleteDatabaseFiles(...args),
}));
jest.mock("../manifestSync", () => ({ stopManifestSync: (...args: unknown[]) => mockStopManifestSync(...args) }));
jest.mock("../storagePaths", () => ({ SONG_NOOK_ROOT: "file:///doc/songnook" }));

import { eraseAllAppData, eraseTargets } from "../eraseAllData";

beforeEach(() => {
    jest.clearAllMocks();
});

describe("eraseAllAppData", () => {
    it("freezes writers, clears every store, wipes AsyncStorage, the database, every directory, then reloads", async () => {
        const result = await eraseAllAppData();

        expect(result.failures).toEqual([]);
        expect(mockStopManifestSync).toHaveBeenCalled();
        expect(mockSetPersistBlocked).toHaveBeenCalledWith(true);
        expect(mockRemoveItem).toHaveBeenCalledWith("songnook-store");
        expect(mockClearStorage).toHaveBeenCalledTimes(7);
        // The row sweep and the write queue must settle BEFORE the database is closed.
        expect(mockWaitIdle.mock.invocationCallOrder[0]).toBeLessThan(
            mockDeleteDatabaseFiles.mock.invocationCallOrder[0]
        );
        expect(mockAsyncStorageClear).toHaveBeenCalled();
        expect(mockDeleteDatabaseFiles).toHaveBeenCalled();
        const deleted = mockDeleteAsync.mock.calls.map((call) => call[0]);
        expect(deleted).toEqual(eraseTargets());
        expect(deleted).toEqual(
            expect.arrayContaining([
                "file:///doc/songnook",
                "file:///doc/diagnostics",
                "file:///doc/SQLite",
                "file:///cache/songnook-receive",
                "file:///cache/songnook",
            ])
        );
        expect(mockReload).toHaveBeenCalledWith("erase-all-data");
    });

    it("keeps going when a step fails and reports it", async () => {
        mockDeleteDatabaseFiles.mockRejectedValueOnce(new Error("locked"));

        const result = await eraseAllAppData({ reload: false });

        expect(result.failures).toEqual([{ step: "database", error: "locked" }]);
        expect(mockDeleteAsync).toHaveBeenCalled();
        expect(mockReload).not.toHaveBeenCalled();
    });

    it("never targets a bare document or cache root", () => {
        for (const uri of eraseTargets()) {
            expect(uri).not.toBe("file:///doc/");
            expect(uri).not.toBe("file:///cache/");
        }
    });
});
