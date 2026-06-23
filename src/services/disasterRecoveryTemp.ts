import * as FileSystem from "expo-file-system/legacy";
import type { Workspace } from "../types";
import {
    SONG_SEED_ROOT,
    resolveManagedUri,
    toRelativeManagedPath,
} from "./storagePaths";
import {
    collectManagedLibraryFilePathsFromWorkspaces,
    quarantineManagedPaths,
} from "./managedMedia";

const RESTORE_JOURNAL_DIR = `${SONG_SEED_ROOT}/restore-journals`;
const RESTORE_TOKEN = /^[a-zA-Z0-9-]+$/;
const RESTORE_JOURNAL_SCHEMA_VERSION = 2;

type RestoreJournal = {
    schemaVersion: number;
    restoreToken: string;
    phase: "writing" | "committed";
    destinationPaths: string[];
    displacedPaths: string[];
    createdAt: number;
};

function journalUri(restoreToken: string) {
    return `${RESTORE_JOURNAL_DIR}/${restoreToken}.json`;
}

async function ensureRestoreJournalDirectory() {
    const info = await FileSystem.getInfoAsync(RESTORE_JOURNAL_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(RESTORE_JOURNAL_DIR, { intermediates: true });
    }
}

function isManagedLibraryPath(path: unknown): path is string {
    return (
        typeof path === "string" &&
        (path.startsWith("songseed/audio/") ||
            path.startsWith("songseed/workspace-archives/"))
    );
}

function isRestoreDestination(path: unknown, restoreToken: string): path is string {
    return (
        typeof path === "string" &&
        (path.startsWith(`songseed/audio/restored-${restoreToken}/`) ||
            path.startsWith(`songseed/workspace-archives/restored-${restoreToken}/`))
    );
}

function normalizeJournal(value: unknown, restoreToken: string): RestoreJournal | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<RestoreJournal>;
    if (candidate.restoreToken !== restoreToken) return null;
    return {
        schemaVersion:
            typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 1,
        restoreToken,
        phase: candidate.phase === "committed" ? "committed" : "writing",
        destinationPaths: Array.isArray(candidate.destinationPaths)
            ? candidate.destinationPaths.filter((path) =>
                  isRestoreDestination(path, restoreToken)
              )
            : [],
        displacedPaths: Array.isArray(candidate.displacedPaths)
            ? candidate.displacedPaths.filter(isManagedLibraryPath)
            : [],
        createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : 0,
    };
}

async function readJournal(restoreToken: string) {
    const raw = await FileSystem.readAsStringAsync(journalUri(restoreToken));
    return normalizeJournal(JSON.parse(raw), restoreToken);
}

async function writeJournal(journal: RestoreJournal) {
    await ensureRestoreJournalDirectory();
    await FileSystem.writeAsStringAsync(
        journalUri(journal.restoreToken),
        JSON.stringify(journal)
    );
}

export async function beginDisasterRecoveryRestoreJournal(
    restoreToken: string,
    destinationPaths: Iterable<string>,
    displacedPaths: Iterable<string> = []
) {
    if (!RESTORE_TOKEN.test(restoreToken)) {
        throw new Error("Restore journal token is invalid.");
    }
    await writeJournal({
        schemaVersion: RESTORE_JOURNAL_SCHEMA_VERSION,
        restoreToken,
        phase: "writing",
        destinationPaths: Array.from(new Set(destinationPaths)).filter((path) =>
            isRestoreDestination(path, restoreToken)
        ),
        displacedPaths: Array.from(new Set(displacedPaths)).filter(isManagedLibraryPath),
        createdAt: Date.now(),
    });
}

export async function markDisasterRecoveryRestoreCommitted(restoreToken: string) {
    const journal = await readJournal(restoreToken);
    if (!journal) throw new Error("Restore journal is unreadable.");
    await writeJournal({ ...journal, phase: "committed" });
}

export async function completeDisasterRecoveryRestoreJournal(restoreToken: string) {
    await FileSystem.deleteAsync(journalUri(restoreToken), { idempotent: true }).catch(() => {});
}

function tokenFromFilename(filename: string) {
    const token = filename.endsWith(".json") ? filename.slice(0, -5) : "";
    return RESTORE_TOKEN.test(token) ? token : null;
}

async function cleanupRestoreTokenDirectories(restoreToken: string, preserveAny: boolean) {
    if (preserveAny) return;
    await Promise.all(
        [
            `songseed/audio/restored-${restoreToken}`,
            `songseed/workspace-archives/restored-${restoreToken}`,
        ].map((path) =>
            FileSystem.deleteAsync(resolveManagedUri(path), { idempotent: true }).catch(() => {})
        )
    );
}

async function removeUnreferencedRestoreDestinations(
    destinationPaths: Iterable<string>,
    referencedPaths: Set<string>
) {
    await Promise.all(
        Array.from(destinationPaths)
            .filter((path) => !referencedPaths.has(path))
            .map((path) =>
                FileSystem.deleteAsync(resolveManagedUri(path), { idempotent: true }).catch(
                    () => {}
                )
            )
    );
}

async function allPathsExist(paths: Iterable<string>) {
    for (const path of paths) {
        try {
            if (!(await FileSystem.getInfoAsync(resolveManagedUri(path))).exists) return false;
        } catch {
            return false;
        }
    }
    return true;
}

/**
 * Finalize interrupted and committed restores after the authoritative snapshot has hydrated.
 * A failed restore can only lose token-scoped partial output. A committed restore quarantines
 * displaced files only after every currently referenced restored destination is present.
 */
export async function cleanupInterruptedDisasterRecoveryRestores(workspaces: Workspace[]) {
    try {
        const info = await FileSystem.getInfoAsync(RESTORE_JOURNAL_DIR);
        if (!info.exists) return;
        const referencedPaths = collectManagedLibraryFilePathsFromWorkspaces(workspaces);
        const filenames = await FileSystem.readDirectoryAsync(RESTORE_JOURNAL_DIR);

        for (const filename of filenames) {
            const restoreToken = tokenFromFilename(filename);
            const uri = `${RESTORE_JOURNAL_DIR}/${filename}`;
            if (!restoreToken) {
                await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                continue;
            }

            let journal: RestoreJournal | null = null;
            try {
                journal = await readJournal(restoreToken);
            } catch {
                // A truncated journal still has a token-scoped restore directory.
            }

            const tokenIsReferenced = Array.from(referencedPaths).some(
                (path) =>
                    path.startsWith(`songseed/audio/restored-${restoreToken}/`) ||
                    path.startsWith(`songseed/workspace-archives/restored-${restoreToken}/`)
            );
            const committed = journal?.phase === "committed" || tokenIsReferenced;

            if (!committed) {
                await removeUnreferencedRestoreDestinations(
                    journal?.destinationPaths ?? [],
                    referencedPaths
                );
                await cleanupRestoreTokenDirectories(restoreToken, tokenIsReferenced);
                await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                continue;
            }

            const activeDestinations = (journal?.destinationPaths ?? []).filter((path) =>
                referencedPaths.has(path)
            );
            if (!(await allPathsExist(activeDestinations))) {
                console.warn(
                    `[Backup] Restore ${restoreToken} is active but a restored file is missing; retaining displaced media.`
                );
                continue;
            }

            const displacedPaths = (journal?.displacedPaths ?? []).filter(
                (path) => !referencedPaths.has(path)
            );
            const quarantine = await quarantineManagedPaths(displacedPaths);
            if (!quarantine.complete) {
                console.warn(
                    `[Backup] Restore ${restoreToken} cleanup will retry; ${quarantine.failedPaths.length} file(s) could not be quarantined.`
                );
                continue;
            }

            await removeUnreferencedRestoreDestinations(
                journal?.destinationPaths ?? [],
                referencedPaths
            );
            await cleanupRestoreTokenDirectories(restoreToken, tokenIsReferenced);
            await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
    } catch (error) {
        console.warn("[Backup] Failed to clean interrupted restore files", error);
    }
}
