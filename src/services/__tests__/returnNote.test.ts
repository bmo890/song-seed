import { noteBackupFinished, noteFounding, notePro, readReturnNote, resetReturnNoteForTests } from "../returnNote";

// jest runs as iOS: the note lives in the Keychain (the secure store).
let keychain: Map<string, string>;

beforeEach(() => {
    keychain = new Map();
    resetReturnNoteForTests({
        getItemAsync: async (key) => keychain.get(key) ?? null,
        setItemAsync: async (key, value) => {
            keychain.set(key, value);
        },
    });
});

it("keeps every change when several land at once", async () => {
    await Promise.all([
        noteBackupFinished({ at: 1000, kind: "folder", where: "SongNook Backup", ideaCount: 4 }),
        noteFounding(),
        notePro(),
    ]);
    expect(await readReturnNote()).toEqual({
        v: 1,
        backup: { at: 1000, kind: "folder", where: "SongNook Backup", ideaCount: 4 },
        founding: true,
        pro: true,
    });
});

it("is nothing on an install that never wrote one", async () => {
    expect(await readReturnNote()).toBeNull();
});
