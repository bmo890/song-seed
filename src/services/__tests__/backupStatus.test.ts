import { isBackupReminderDue } from "../../domain/backupPreferences";
import { shouldPromptForBackupReminder } from "../backupStatus";
import type { Workspace } from "../../types";

const DAY = 24 * 60 * 60 * 1000;
const INSTALL = 1_800_000_000_000;

const oneIdeaLibrary = [{ ideas: [{ id: "idea-1" }] } as unknown as Workspace];

describe("isBackupReminderDue", () => {
    const base = {
        frequency: "monthly" as const,
        lastSuccessfulBackupAt: null,
        firstLaunchAt: INSTALL,
        lastPromptedAt: null,
    };

    it("never asks on install day, even with no backup ever", () => {
        expect(isBackupReminderDue({ ...base, now: INSTALL })).toBe(false);
        expect(isBackupReminderDue({ ...base, now: INSTALL + 6 * DAY })).toBe(false);
    });

    it("asks once the interval has passed since install", () => {
        expect(isBackupReminderDue({ ...base, now: INSTALL + 30 * DAY })).toBe(true);
    });

    it("waits a full interval after being shown — 'Later' does not bring it back next launch", () => {
        const shownAt = INSTALL + 30 * DAY;
        expect(isBackupReminderDue({ ...base, lastPromptedAt: shownAt, now: shownAt + DAY })).toBe(false);
        expect(isBackupReminderDue({ ...base, lastPromptedAt: shownAt, now: shownAt + 30 * DAY })).toBe(true);
    });

    it("restarts the clock from a successful backup", () => {
        const backedUpAt = INSTALL + 40 * DAY;
        expect(
            isBackupReminderDue({ ...base, lastSuccessfulBackupAt: backedUpAt, now: backedUpAt + 29 * DAY })
        ).toBe(false);
        expect(
            isBackupReminderDue({ ...base, lastSuccessfulBackupAt: backedUpAt, now: backedUpAt + 30 * DAY })
        ).toBe(true);
    });

    it("respects the chosen frequency", () => {
        expect(isBackupReminderDue({ ...base, frequency: "weekly", now: INSTALL + 7 * DAY })).toBe(true);
        expect(isBackupReminderDue({ ...base, frequency: "quarterly", now: INSTALL + 89 * DAY })).toBe(false);
        expect(isBackupReminderDue({ ...base, frequency: "off", now: INSTALL + 400 * DAY })).toBe(false);
    });

    it("does not ask before the first launch is recorded", () => {
        expect(isBackupReminderDue({ ...base, firstLaunchAt: null, now: INSTALL + 400 * DAY })).toBe(false);
    });
});

describe("shouldPromptForBackupReminder", () => {
    it("stays quiet for an empty library", () => {
        expect(
            shouldPromptForBackupReminder({
                workspaces: [{ ideas: [] } as unknown as Workspace],
                backupReminderFrequency: "monthly",
                lastSuccessfulBackupAt: null,
                firstLaunchAt: INSTALL,
                backupReminderLastPromptedAt: null,
                now: INSTALL + 90 * DAY,
            })
        ).toBe(false);
    });

    it("prompts for an overdue library with ideas", () => {
        expect(
            shouldPromptForBackupReminder({
                workspaces: oneIdeaLibrary,
                backupReminderFrequency: "monthly",
                lastSuccessfulBackupAt: null,
                firstLaunchAt: INSTALL,
                backupReminderLastPromptedAt: null,
                now: INSTALL + 31 * DAY,
            })
        ).toBe(true);
    });
});
