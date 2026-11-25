import { EMPTY_RETURN_NOTE, isBlankLibrary, mergeReturnNote, parseReturnNote, shouldWelcomeBack } from "../returnNote";

const backup = (at: number, kind: "file" | "folder" = "folder") => ({ at, kind, where: "SongNook Backup", ideaCount: 12 });

describe("the return note", () => {
    it("reads back what it wrote, and refuses anything else", () => {
        const note = mergeReturnNote(null, { backup: backup(1000) });
        expect(parseReturnNote(JSON.stringify(note))).toEqual(note);
        expect(parseReturnNote(null)).toBeNull();
        expect(parseReturnNote("not json")).toBeNull();
        expect(parseReturnNote(JSON.stringify({ v: 2, founding: true }))).toBeNull();
        expect(parseReturnNote(JSON.stringify({ v: 1, backup: { at: -5, kind: "file" } }))?.backup).toBeNull();
    });

    it("keeps founding and Pro once seen, and never trades a newer backup for an older one", () => {
        let note = mergeReturnNote(null, { founding: true });
        note = mergeReturnNote(note, { pro: true });
        note = mergeReturnNote(note, { backup: backup(2000) });
        note = mergeReturnNote(note, { backup: backup(1000, "file") });
        expect(note).toEqual({ v: 1, backup: backup(2000), founding: true, pro: true });
    });

    it("greets a returning person only on an empty, unwelcomed install with a known backup", () => {
        const note = mergeReturnNote(null, { backup: backup(1000) });
        expect(shouldWelcomeBack(note, { hasSeenWelcome: false, ideaCount: 0 })).toBe(true);
        expect(shouldWelcomeBack(note, { hasSeenWelcome: true, ideaCount: 0 })).toBe(false);
        expect(shouldWelcomeBack(note, { hasSeenWelcome: false, ideaCount: 3 })).toBe(false);
        // Founding alone has nothing to restore: the plain intro is the start.
        expect(shouldWelcomeBack({ ...EMPTY_RETURN_NOTE, founding: true }, { hasSeenWelcome: false, ideaCount: 0 })).toBe(false);
        expect(shouldWelcomeBack(null, { hasSeenWelcome: false, ideaCount: 0 })).toBe(false);
    });
});

describe("a blank library", () => {
    const starter = { ideas: [], collections: [{}] };
    it("is only the untouched starter", () => {
        expect(isBlankLibrary({ workspaces: [starter] })).toBe(true);
        expect(isBlankLibrary({ workspaces: [] })).toBe(true);
    });
    it("is not blank with anything of the person's", () => {
        expect(isBlankLibrary({ workspaces: [{ ideas: [{}], collections: [{}] }] })).toBe(false);
        expect(isBlankLibrary({ workspaces: [{ ideas: [], collections: [{}, {}] }] })).toBe(false);
        expect(isBlankLibrary({ workspaces: [starter, { ideas: [], collections: [{}] }] })).toBe(false);
        expect(isBlankLibrary({ workspaces: [{ origin: "received", ideas: [], collections: [{}] }] })).toBe(false);
        expect(isBlankLibrary({ workspaces: [starter], notes: [{}] })).toBe(false);
        expect(isBlankLibrary({ workspaces: [starter], playlists: [{}] })).toBe(false);
    });
});
