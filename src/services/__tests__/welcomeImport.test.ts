// Welcome-wizard import: destination + dedupe decisions. The heavy lifting
// (picker, managed-storage copy, chunked commits, hydration) is the shared
// pipeline tested elsewhere; these tests pin the onboarding-specific choices —
// find-or-create of the "Imported" collection, silent duplicate skipping
// (no review dialog can stack above the welcome gate), and the cancel path
// leaving the library untouched.

const mockPickAudioFiles = jest.fn();
const mockImportAudioAssets = jest.fn();
const mockCheckImportDuplicates = jest.fn();
const mockAddCollection = jest.fn().mockReturnValue("col-created");
const mockBatcherAdd = jest.fn();
const mockBatcherFlush = jest.fn();
const mockCreateBatcher = jest.fn(() => ({ add: mockBatcherAdd, flush: mockBatcherFlush }));
let mockWorkspaces: unknown[] = [];
let mockActiveWorkspaceId: string | null = null;

jest.mock("../audioStorage", () => ({
    __esModule: true,
    buildImportedTitle: (name?: string) => (name ?? "Imported audio").replace(/\.[^.]+$/, ""),
    pickAudioFiles: (...args: unknown[]) => mockPickAudioFiles(...args),
    importAudioAssets: (...args: unknown[]) => mockImportAudioAssets(...args),
}));
jest.mock("../clipImportBatcher", () => ({
    createClipImportBatcher: (...args: unknown[]) => mockCreateBatcher(...(args as [])),
}));
jest.mock("../importDuplicates", () => ({
    checkImportDuplicates: (...args: unknown[]) => mockCheckImportDuplicates(...args),
    getAllClips: () => [],
}));
jest.mock("../../domain/importDates", () => ({
    buildImportedAssetDateMetadata: (assets: unknown[]) =>
        (assets as []).map(() => ({ createdAt: 1, importedAt: 1, sourceCreatedAt: 1 })),
}));
jest.mock("../../state/useImportStore", () => ({
    useImportStore: {
        getState: () => ({ startJob: jest.fn(), updateJob: jest.fn(), removeJob: jest.fn() }),
    },
}));
jest.mock("../../state/useStore", () => ({
    useStore: {
        getState: () => ({
            workspaces: mockWorkspaces,
            activeWorkspaceId: mockActiveWorkspaceId,
            addCollection: mockAddCollection,
        }),
    },
}));
jest.mock("../../utils", () => ({
    ensureUniqueCountedTitle: (title: string) => title,
}));

import { runWelcomeImport } from "../welcomeImport";

function asset(name: string) {
    return { name, audioUri: `file:///${name}`, durationMs: 1000 };
}

function workspace(collections: Array<{ id: string; title: string }>) {
    return { id: "ws-1", title: "My Songs", collections, ideas: [] };
}

// importAudioAssets contract: invokes onImported per asset, resolves counts.
function mockImportSucceeds() {
    mockImportAudioAssets.mockImplementation(
        async (
            assets: Array<ReturnType<typeof asset>>,
            _idFor: unknown,
            _onProgress: unknown,
            options: { onImported?: (a: unknown) => void }
        ) => {
            assets.forEach((a) => options.onImported?.(a));
            return { imported: assets, failed: [] };
        }
    );
}

describe("runWelcomeImport", () => {
    // Swallows the service's trailing removeJob cleanup timer (2.5s) so jest exits.
    beforeAll(() => {
        jest.useFakeTimers();
    });
    afterAll(() => {
        jest.useRealTimers();
    });
    beforeEach(() => {
        jest.clearAllMocks();
        mockAddCollection.mockReturnValue("col-created");
        mockActiveWorkspaceId = "ws-1";
        mockWorkspaces = [workspace([{ id: "col-ideas", title: "Ideas" }])];
        mockCheckImportDuplicates.mockImplementation((assets: unknown[]) => ({
            hasDuplicates: false,
            uniqueAssets: assets,
            allAssets: assets,
        }));
        mockImportSucceeds();
    });

    it("cancelled picker: reports cancelled and touches nothing", async () => {
        mockPickAudioFiles.mockResolvedValue([]);
        const result = await runWelcomeImport(() => {});
        expect(result.outcome).toBe("cancelled");
        expect(mockAddCollection).not.toHaveBeenCalled();
        expect(mockImportAudioAssets).not.toHaveBeenCalled();
    });

    it("creates the Imported collection when missing and imports into it", async () => {
        mockPickAudioFiles.mockResolvedValue([asset("memo1.m4a"), asset("memo2.m4a")]);
        const result = await runWelcomeImport(() => {});
        expect(mockAddCollection).toHaveBeenCalledWith("ws-1", "Imported");
        expect(mockCreateBatcher).toHaveBeenCalledWith({ collectionId: "col-created", workspaceId: "ws-1" });
        expect(mockBatcherAdd).toHaveBeenCalledTimes(2);
        expect(mockBatcherFlush).toHaveBeenCalled();
        expect(result).toMatchObject({ outcome: "imported", imported: 2, failed: 0, skippedDuplicates: 0 });
    });

    it("reuses an existing Imported collection (case-insensitive) on intro replay", async () => {
        mockWorkspaces = [workspace([{ id: "col-imported", title: "imported" }])];
        mockPickAudioFiles.mockResolvedValue([asset("memo1.m4a")]);
        await runWelcomeImport(() => {});
        expect(mockAddCollection).not.toHaveBeenCalled();
        expect(mockCreateBatcher).toHaveBeenCalledWith({ collectionId: "col-imported", workspaceId: "ws-1" });
    });

    it("silently skips exact duplicates and reports the skip count", async () => {
        const fresh = asset("new.m4a");
        const dupe = asset("dupe.m4a");
        mockPickAudioFiles.mockResolvedValue([fresh, dupe]);
        mockCheckImportDuplicates.mockReturnValue({
            hasDuplicates: true,
            uniqueAssets: [fresh],
            allAssets: [fresh, dupe],
        });
        const result = await runWelcomeImport(() => {});
        expect(mockImportAudioAssets.mock.calls[0]![0]).toEqual([fresh]);
        expect(result).toMatchObject({ outcome: "imported", imported: 1, skippedDuplicates: 1 });
    });

    it("all-duplicates: completes without importing anything", async () => {
        const dupe = asset("dupe.m4a");
        mockPickAudioFiles.mockResolvedValue([dupe]);
        mockCheckImportDuplicates.mockReturnValue({
            hasDuplicates: true,
            uniqueAssets: [],
            allAssets: [dupe],
        });
        const result = await runWelcomeImport(() => {});
        expect(mockImportAudioAssets).not.toHaveBeenCalled();
        expect(result).toMatchObject({ outcome: "imported", imported: 0, skippedDuplicates: 1 });
    });
});
