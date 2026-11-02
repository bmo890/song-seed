const mockRunAsync = jest.fn();
const mockAsyncStorageSetItem = jest.fn();

jest.mock("../db/database", () => ({
    getDb: () => ({
        runAsync: (...args: unknown[]) => mockRunAsync(...args),
    }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
        removeItem: jest.fn(),
    },
}));

import { persistRawSnapshot, sqliteStringStorage } from "../db/storage";

beforeEach(() => {
    mockRunAsync.mockReset();
    mockAsyncStorageSetItem.mockReset();
});

describe("persistRawSnapshot", () => {
    it("commits directly to authoritative SQLite", async () => {
        mockRunAsync.mockResolvedValueOnce(undefined);

        await expect(persistRawSnapshot("store-success", "snapshot")).resolves.toBeUndefined();
        expect(mockRunAsync).toHaveBeenCalled();
        expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
    });

    it("surfaces SQLite failure and parks nothing for the next launch to replay (02 G4)", async () => {
        // A refused restore commit is reported as failed and its files are deleted; a
        // parked copy used to be replayed over the live library at the next boot.
        mockRunAsync.mockRejectedValueOnce(new Error("SQLite unavailable"));
        mockAsyncStorageSetItem.mockResolvedValue(undefined);

        await expect(persistRawSnapshot("store-failure", "snapshot")).rejects.toThrow(
            "SQLite unavailable"
        );
        expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
    });

    it("serializes ordinary writes before an authoritative raw snapshot", async () => {
        let releaseFirstWrite!: () => void;
        const firstWrite = new Promise<void>((resolve) => {
            releaseFirstWrite = resolve;
        });
        mockRunAsync
            .mockImplementationOnce(() => firstWrite)
            .mockResolvedValueOnce(undefined);

        const ordinaryWrite = sqliteStringStorage.setItem("ordered-store", "old-state");
        const authoritativeWrite = persistRawSnapshot("ordered-store", "restored-state");

        await Promise.resolve();
        expect(mockRunAsync).toHaveBeenCalledTimes(1);
        releaseFirstWrite();
        await ordinaryWrite;
        await authoritativeWrite;

        expect(mockRunAsync).toHaveBeenCalledTimes(2);
        expect(mockRunAsync.mock.calls[1][2]).toBe("restored-state");
    });
});
