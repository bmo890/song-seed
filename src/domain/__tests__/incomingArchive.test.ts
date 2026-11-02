import {
    IncomingArchiveError,
    breakParentCycles,
    checkIncomingArchiveManifest,
    collectLibraryIds,
    createUniqueIdMinter,
} from "../incomingArchive";

/**
 * Hostile fixtures for the one check every incoming archive passes (data-safety
 * audit 2026-11-02: 06 #4, 07 M2, 08 R3, 09 H1). Each case is a manifest some
 * other device could write; none may reach the library as it came.
 */

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

function clip(overrides: Record<string, unknown> = {}) {
    return { id: "c1", title: "Take", createdAt: NOW - 1000, isPrimary: true, ...overrides };
}

function song(overrides: Record<string, unknown> = {}) {
    return {
        id: "s1",
        title: "Song",
        folderPath: "Song",
        collectionId: "col1",
        createdAt: NOW - 5000,
        lastActivityAt: NOW - 4000,
        completionPct: 10,
        isBookmarked: false,
        historyIncluded: true,
        clips: [clip()],
        ...overrides,
    };
}

function collection(overrides: Record<string, unknown> = {}) {
    return { id: "col1", title: "Ideas", parentCollectionId: null, folderPath: "Ideas", songs: [], standaloneClips: [], ...overrides };
}

function manifest(collections: unknown[], extra: Record<string, unknown> = {}) {
    return {
        format: "songnook-archive",
        schemaVersion: 7,
        exportedAt: "2026-11-01T00:00:00.000Z",
        scope: { workspaceIds: ["w1"], collectionIds: [] },
        summary: { workspaces: 1, collections: 1, songs: 1, standaloneClips: 0 },
        workspaces: [{ id: "w1", title: "Band", folderPath: "Band", collections }],
        ...extra,
    };
}

const check = (raw: unknown) => checkIncomingArchiveManifest(raw, { now: NOW, untitled: "Untitled" });

describe("refuses what isn't an archive", () => {
    it.each([
        ["null", null],
        ["an array", []],
        ["a string", "songnook-archive"],
        ["a wrong format", { format: "zip", workspaces: [] }],
        ["no workspaces list", { format: "songnook-archive", workspaces: {} }],
    ])("%s", (_label, raw) => {
        expect(() => check(raw)).toThrow(IncomingArchiveError);
    });

    it("accepts the pre-rename format id", () => {
        expect(check({ ...manifest([collection()]), format: "song-nook-archive" }).manifest.workspaces).toHaveLength(1);
    });
});

describe("text is text", () => {
    it("a title that is null, an object or a number becomes a string", () => {
        const { manifest: out, repairs } = check(
            manifest([
                collection({
                    title: { evil: true },
                    songs: [song({ title: null, clips: [clip({ title: 42 })] })],
                    standaloneClips: [clip({ id: "loose", title: ["x"] })],
                }),
            ])
        );
        const col = out.workspaces[0]!.collections[0]!;
        expect(col.title).toBe("Untitled");
        expect(col.songs[0]!.title).toBe("Untitled");
        expect(col.songs[0]!.clips[0]!.title).toBe("42");
        expect(col.standaloneClips[0]!.title).toBe("Untitled");
        expect(repairs).toBeGreaterThan(0);
    });

    it("tags that aren't a list are dropped, numbers fall back to defaults", () => {
        const { manifest: out } = check(
            manifest([collection({ songs: [song({ completionPct: "lots", clips: [clip({ tags: "x", durationMs: NaN })] })] })])
        );
        const s = out.workspaces[0]!.collections[0]!.songs[0]!;
        expect(s.completionPct).toBe(0);
        expect(s.clips[0]!.tags).toBeUndefined();
        expect(s.clips[0]!.durationMs).toBeUndefined();
    });

    it("junk inside lists is dropped, the rest is kept", () => {
        const { manifest: out } = check(
            manifest([collection({ songs: [song(), "junk", null, 7] })])
        );
        expect(out.workspaces[0]!.collections[0]!.songs).toHaveLength(1);
    });

    it("the summary is counted from the contents, never trusted", () => {
        const { manifest: out } = check(
            manifest([collection({ songs: [song(), song({ id: "s2" })] })], {
                summary: { workspaces: 99, collections: "x", songs: -1, standaloneClips: null },
            })
        );
        expect(out.summary).toEqual({ workspaces: 1, collections: 1, songs: 2, standaloneClips: 0, notepadNotes: undefined });
    });

    it("lyric lines are text and their chords are typed", () => {
        const { manifest: out } = check(
            manifest([
                collection({
                    songs: [
                        song({
                            lyricsVersions: [
                                { id: "lv1", createdAt: NOW, updatedAt: NOW, document: { lines: [{ id: "l1", text: 5, chords: [{ chord: {}, at: "x", evil: { a: 1 } }] }, "junk"] } },
                            ],
                        }),
                    ],
                }),
            ])
        );
        const version = out.workspaces[0]!.collections[0]!.songs[0]!.lyricsVersions![0]!;
        expect(version.document.lines).toHaveLength(1);
        expect(version.document.lines[0]!.text).toBe("5");
        expect(version.document.lines[0]!.chords[0]).toMatchObject({ chord: "", at: 0 });
        expect((version.document.lines[0]!.chords[0] as unknown as Record<string, unknown>).evil).toBeUndefined();
    });
});

describe("dates", () => {
    const songAt = (overrides: Record<string, unknown>) =>
        check(manifest([collection({ songs: [song(overrides)] })])).manifest.workspaces[0]!.collections[0]!.songs[0]!;

    it("a missing date takes the earliest take's date, never NaN", () => {
        const s = songAt({ createdAt: undefined, lastActivityAt: undefined, clips: [clip({ createdAt: NOW - 9000 })] });
        expect(s.createdAt).toBe(NOW - 9000);
        expect(s.lastActivityAt).toBe(NOW - 9000);
    });

    it("a missing date with no other date becomes the import time", () => {
        const s = songAt({ createdAt: undefined, clips: [clip({ createdAt: undefined })] });
        expect(s.createdAt).toBe(NOW);
        expect(s.clips[0]!.createdAt).toBe(NOW);
    });

    it("null (NaN saved as JSON) never dates an idea to 1970", () => {
        const s = songAt({ createdAt: null, clips: [clip({ createdAt: null })] });
        expect(s.createdAt).toBe(NOW);
        expect(s.clips[0]!.createdAt).toBe(NOW);
    });

    it("an ISO date string is read as the date it names", () => {
        expect(songAt({ createdAt: "2025-05-01T10:00:00.000Z" }).createdAt).toBe(Date.UTC(2025, 4, 1, 10));
    });

    it("a date from the future is clamped to the import time", () => {
        const s = songAt({ createdAt: NOW + 30 * 86_400_000, clips: [clip({ createdAt: NOW + 86_400_000 * 5 })] });
        expect(s.createdAt).toBe(NOW);
        expect(s.clips[0]!.createdAt).toBe(NOW);
    });

    it("optional dates that aren't dates are dropped", () => {
        const s = songAt({ importedAt: "soon", clips: [clip({ sourceCreatedAt: {} })] });
        expect(s.importedAt).toBeUndefined();
        expect(s.clips[0]!.sourceCreatedAt).toBeUndefined();
    });
});

describe("loops and dangling references", () => {
    it("a collection loop (A→B→A) and a self-parent are cut; nothing inside is lost", () => {
        const { manifest: out } = check(
            manifest([
                collection({ id: "A", parentCollectionId: "B", songs: [song({ id: "sa" })] }),
                collection({ id: "B", parentCollectionId: "A", songs: [song({ id: "sb" })] }),
                collection({ id: "C", parentCollectionId: "C" }),
                collection({ id: "D", parentCollectionId: "gone" }),
            ])
        );
        const cols = out.workspaces[0]!.collections;
        const parentOf = new Map(cols.map((c) => [c.id, c.parentCollectionId ?? null]));
        // Every chain now ends at a top-level collection.
        for (const c of cols) {
            const seen = new Set<string>();
            let current: string | null = c.id;
            while (current) {
                expect(seen.has(current)).toBe(false);
                seen.add(current);
                current = parentOf.get(current) ?? null;
            }
        }
        expect(parentOf.get("C")).toBeNull();
        expect(parentOf.get("D")).toBeNull();
        expect(cols.flatMap((c) => c.songs.map((s) => s.id)).sort()).toEqual(["sa", "sb"]);
    });

    it("a take lineage loop is cut, a dangling parent dropped, every take kept", () => {
        const { manifest: out } = check(
            manifest([
                collection({
                    songs: [
                        song({
                            clips: [
                                clip({ id: "r", isPrimary: true }),
                                clip({ id: "x", parentClipId: "y", isPrimary: false }),
                                clip({ id: "y", parentClipId: "x", isPrimary: false }),
                                clip({ id: "self", parentClipId: "self", isPrimary: false }),
                                clip({ id: "orphan", parentClipId: "nowhere", isPrimary: false }),
                            ],
                        }),
                    ],
                }),
            ])
        );
        const clips = out.workspaces[0]!.collections[0]!.songs[0]!.clips;
        expect(clips.map((c) => c.id)).toEqual(["r", "x", "y", "self", "orphan"]);
        const roots = clips.filter((c) => !c.parentClipId).map((c) => c.id);
        expect(roots).toEqual(expect.arrayContaining(["r", "self", "orphan"]));
        expect(roots.some((id) => id === "x" || id === "y")).toBe(true);
    });

    it("exactly one primary take survives", () => {
        const { manifest: out } = check(
            manifest([collection({ songs: [song({ clips: [clip({ id: "a" }), clip({ id: "b" })] })] })])
        );
        expect(out.workspaces[0]!.collections[0]!.songs[0]!.clips.filter((c) => c.isPrimary)).toHaveLength(1);
    });

    it("a lyric stamp or group assignment that points nowhere is dropped, not the take", () => {
        const { manifest: out } = check(
            manifest([
                collection({
                    songs: [
                        song({
                            clips: [clip({ lyricsVersionId: "missing" })],
                            clipGroups: [{ id: "g1", name: "G", collapsed: false, createdAt: NOW, updatedAt: NOW }],
                            clipGroupAssignments: { c1: "g1", ghost: "g1", c1x: 5 },
                        }),
                    ],
                }),
            ])
        );
        const s = out.workspaces[0]!.collections[0]!.songs[0]!;
        expect(s.clips[0]!.lyricsVersionId).toBeUndefined();
        expect(s.clipGroupAssignments).toEqual({ c1: "g1" });
    });
});

describe("ids", () => {
    it("two ideas or two takes with one id are made unique, so neither overwrites the other", () => {
        const { manifest: out } = check(
            manifest([
                collection({
                    songs: [song({ id: "dup", clips: [clip({ id: "t" }), clip({ id: "t", isPrimary: false })] })],
                    standaloneClips: [clip({ id: "dup" })],
                }),
            ])
        );
        const col = out.workspaces[0]!.collections[0]!;
        expect(col.songs[0]!.id).toBe("dup");
        expect(col.standaloneClips[0]!.id).not.toBe("dup");
        const takeIds = col.songs[0]!.clips.map((c) => c.id);
        expect(new Set(takeIds).size).toBe(2);
    });

    it("a clip idea whose take shares its id keeps both (the app wrote these before 2026-11-02)", () => {
        const { manifest: out } = check(
            manifest([collection({ standaloneClips: [{ ...clip({ id: "A" }), takes: [clip({ id: "A" })] }] })])
        );
        const loose = out.workspaces[0]!.collections[0]!.standaloneClips[0]!;
        expect(loose.id).toBe("A");
        expect(loose.takes![0]!.id).toBe("A");
    });

    it("the minter never hands out an id the library already holds", () => {
        const spy = jest.spyOn(Date, "now").mockReturnValue(1);
        try {
            const values = [0.5, 0.5, 0.25];
            const random = () => values.shift() ?? Math.random();
            const taken = `idea-1-${(0.5).toString(36).slice(2, 9)}`;
            const mint = createUniqueIdMinter(
                collectLibraryIds([{ id: "w", collections: [], ideas: [{ id: taken, clips: [] }] }]),
                random
            );
            const id = mint("idea");
            expect(id).not.toBe(taken);
            expect(id).toBe(`idea-1-${(0.25).toString(36).slice(2, 9)}`);
        } finally {
            spy.mockRestore();
        }
    });
});

describe("breakParentCycles", () => {
    it("leaves an acyclic tree alone", () => {
        const map = new Map<string, string | null>([["a", null], ["b", "a"], ["c", "b"]]);
        expect(breakParentCycles(map)).toBe(0);
        expect(map.get("c")).toBe("b");
    });

    it("cuts a long ring once", () => {
        const map = new Map<string, string | null>([["a", "d"], ["b", "a"], ["c", "b"], ["d", "c"]]);
        expect(breakParentCycles(map)).toBe(1);
        expect([...map.values()].filter((parent) => parent === null)).toHaveLength(1);
    });
});
