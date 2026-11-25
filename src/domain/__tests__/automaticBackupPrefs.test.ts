import { DEFAULT_AUTOMATIC_BACKUP, shouldAskAboutAutomaticBackup } from "../automaticBackupPrefs";

const base = {
    asked: false,
    ideaCount: 1,
    prefs: DEFAULT_AUTOMATIC_BACKUP,
    hasSeenWelcome: true,
    recording: false,
    folderAvailable: true,
};

describe("asking once about automatic backup", () => {
    it("asks after the first idea, when it is off", () => {
        expect(shouldAskAboutAutomaticBackup(base)).toBe(true);
    });

    it("never asks twice, before an idea, mid-take, over the intro, or when it is already on", () => {
        expect(shouldAskAboutAutomaticBackup({ ...base, asked: true })).toBe(false);
        expect(shouldAskAboutAutomaticBackup({ ...base, ideaCount: 0 })).toBe(false);
        expect(shouldAskAboutAutomaticBackup({ ...base, recording: true })).toBe(false);
        expect(shouldAskAboutAutomaticBackup({ ...base, hasSeenWelcome: false })).toBe(false);
        expect(shouldAskAboutAutomaticBackup({ ...base, folderAvailable: false })).toBe(false);
        expect(
            shouldAskAboutAutomaticBackup({
                ...base,
                prefs: { ...DEFAULT_AUTOMATIC_BACKUP, frequency: "daily", folder: { handle: "h", name: "SongNook Backup" } },
            })
        ).toBe(false);
    });

    it("asks again when the folder is on but out of reach (Android after a reinstall)", () => {
        expect(
            shouldAskAboutAutomaticBackup({
                ...base,
                prefs: {
                    ...DEFAULT_AUTOMATIC_BACKUP,
                    frequency: "daily",
                    folder: { handle: "h", name: "SongNook Backup" },
                    lastError: "folderUnavailable",
                },
            })
        ).toBe(true);
    });
});
