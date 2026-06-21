jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    getInfoAsync: jest.fn(async () => ({ exists: true, size: 1 })),
    readDirectoryAsync: jest.fn(async () => []),
}));

import { scanLibraryIntegrity, type IntegrityIssue } from "../integrityScanner";
import type { ClipVersion, Collection, Playlist, SongIdea, Workspace } from "../../types";

function clip(id: string, over: Partial<ClipVersion> = {}): ClipVersion {
    return { id, title: id, notes: "", createdAt: 0, isPrimary: false, ...over };
}

function idea(id: string, clips: ClipVersion[], over: Partial<SongIdea> = {}): SongIdea {
    return {
        id,
        title: id,
        notes: "",
        status: "seedling" as SongIdea["status"],
        completionPct: 0,
        kind: "project",
        collectionId: "col-1",
        clips,
        createdAt: 0,
        lastActivityAt: 0,
        ...over,
    };
}

function workspace(ideas: SongIdea[], collections: Collection[] = []): Workspace {
    return {
        id: "ws-1",
        title: "ws",
        collections: collections.length
            ? collections
            : [
                  {
                      id: "col-1",
                      title: "Inbox",
                      workspaceId: "ws-1",
                      createdAt: 0,
                      updatedAt: 0,
                      ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                  },
              ],
        ideas,
    };
}

const types = (issues: IntegrityIssue[]) => issues.map((i) => i.type).sort();

describe("scanLibraryIntegrity", () => {
    it("reports no issues for a clean library", async () => {
        const ws = workspace([idea("idea-1", [clip("c1", { isPrimary: true }), clip("c2", { parentClipId: "c1" })])]);
        const report = await scanLibraryIntegrity([ws], []);
        expect(report.ok).toBe(true);
        expect(report.issues).toHaveLength(0);
        expect(report.counts).toEqual({ workspaces: 1, collections: 1, ideas: 1, clips: 2 });
    });

    it("detects duplicate clip ids", async () => {
        const ws = workspace([idea("idea-1", [clip("dup", { isPrimary: true }), clip("dup")])]);
        const report = await scanLibraryIntegrity([ws], []);
        expect(types(report.issues)).toContain("duplicate-id");
    });

    it("detects a dangling parent reference", async () => {
        const ws = workspace([idea("idea-1", [clip("c1", { isPrimary: true, parentClipId: "ghost" })])]);
        const report = await scanLibraryIntegrity([ws], []);
        expect(types(report.issues)).toContain("dangling-parent");
    });

    it("detects a lineage cycle", async () => {
        const ws = workspace([
            idea("idea-1", [
                clip("a", { isPrimary: true, parentClipId: "b" }),
                clip("b", { parentClipId: "a" }),
            ]),
        ]);
        const report = await scanLibraryIntegrity([ws], []);
        expect(types(report.issues)).toContain("lineage-cycle");
    });

    it("detects dangling group assignments", async () => {
        const ws = workspace([
            idea("idea-1", [clip("c1", { isPrimary: true })], {
                clipGroups: [{ id: "g1", name: "G", collapsed: false, createdAt: 0, updatedAt: 0 }],
                clipGroupAssignments: { c1: "ghost-group", ghost: "g1" },
            }),
        ]);
        const report = await scanLibraryIntegrity([ws], []);
        const danglers = report.issues.filter((i) => i.type === "dangling-group-assignment");
        expect(danglers).toHaveLength(2);
    });

    it("detects missing and multiple primary takes", async () => {
        const noPrimary = workspace([idea("idea-1", [clip("c1"), clip("c2")])]);
        expect(types((await scanLibraryIntegrity([noPrimary], [])).issues)).toContain("missing-primary");

        const twoPrimary = workspace([idea("idea-2", [clip("c1", { isPrimary: true }), clip("c2", { isPrimary: true })])]);
        expect(types((await scanLibraryIntegrity([twoPrimary], [])).issues)).toContain("multiple-primary");
    });

    it("detects dangling playlist references", async () => {
        const ws = workspace([idea("idea-1", [clip("c1", { isPrimary: true })])]);
        const playlist: Playlist = {
            id: "pl-1",
            title: "P",
            createdAt: 0,
            updatedAt: 0,
            items: [
                { id: "it-1", kind: "clip", workspaceId: "ws-1", collectionId: "col-1", ideaId: "ghost-idea", addedAt: 0 },
            ],
        };
        const report = await scanLibraryIntegrity([ws], [playlist]);
        expect(types(report.issues)).toContain("dangling-playlist-item");
    });
});
