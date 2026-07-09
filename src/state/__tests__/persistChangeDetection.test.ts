import { persistedSnapshotChanged, resetPersistChangeDetection } from "../persistChangeDetection";

describe("persistedSnapshotChanged", () => {
    beforeEach(() => {
        resetPersistChangeDetection();
    });

    const wrap = (state: Record<string, unknown>) => ({ state, version: 1 });

    it("treats the first snapshot as changed", () => {
        expect(persistedSnapshotChanged(wrap({ workspaces: [] }))).toBe(true);
    });

    it("skips when every persisted field is reference-identical (playback tick)", () => {
        const workspaces = [{ id: "w1" }];
        const notes = [{ id: "n1" }];
        expect(persistedSnapshotChanged(wrap({ workspaces, notes }))).toBe(true);
        // A transient-only set() (player position) rebuilds the snapshot object but
        // every field keeps its identity.
        expect(persistedSnapshotChanged(wrap({ workspaces, notes }))).toBe(false);
        expect(persistedSnapshotChanged(wrap({ workspaces, notes }))).toBe(false);
    });

    it("detects a changed field reference (real library edit)", () => {
        const workspaces = [{ id: "w1" }];
        expect(persistedSnapshotChanged(wrap({ workspaces }))).toBe(true);
        expect(persistedSnapshotChanged(wrap({ workspaces: [...workspaces] }))).toBe(true);
    });

    it("detects added and removed fields", () => {
        const workspaces = [{ id: "w1" }];
        expect(persistedSnapshotChanged(wrap({ workspaces }))).toBe(true);
        expect(persistedSnapshotChanged(wrap({ workspaces, playlists: [] }))).toBe(true);
        expect(persistedSnapshotChanged(wrap({ workspaces }))).toBe(true);
    });

    it("passes through malformed values (never blocks a write it can't inspect)", () => {
        expect(persistedSnapshotChanged(null)).toBe(true);
        expect(persistedSnapshotChanged({})).toBe(true);
        expect(persistedSnapshotChanged("raw-string")).toBe(true);
    });

    it("does not lose a change that arrives between identical snapshots", () => {
        const a = [{ id: "w1" }];
        const b = [{ id: "w1" }, { id: "w2" }];
        expect(persistedSnapshotChanged(wrap({ workspaces: a }))).toBe(true);
        expect(persistedSnapshotChanged(wrap({ workspaces: a }))).toBe(false);
        expect(persistedSnapshotChanged(wrap({ workspaces: b }))).toBe(true);
        expect(persistedSnapshotChanged(wrap({ workspaces: b }))).toBe(false);
    });
});
