import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";

/**
 * What the crash screen sets aside (audit 2026-11-02, 09 H1). A render crash
 * caused by something stored crashed again on Restart and on every cold launch,
 * because startup reopens the workspace the person was in. When the crash
 * screen shows, the workspace that was open is written here; the next start
 * (a cold launch, or the screen's "Open Home") opens somewhere else instead:
 * the primary workspace when that isn't the one set aside, else the workspace
 * list. Restart clears it and tries the same place again.
 *
 * Synchronous on purpose: startup picks its first page synchronously, and the
 * crash screen can't count on anything async finishing. Every call swallows
 * its own failure; a crash screen that throws is a white screen.
 */

type SetAside = { workspaceId: string | null; at: number };

function markerFile(): File | null {
    const dir = FileSystem.documentDirectory;
    return dir ? new File(`${dir}crash-set-aside.json`) : null;
}

/** Undefined = not read yet this start; null = nothing set aside. */
let cached: SetAside | null | undefined;

export function crashSetAsidePath(): string | null {
    const dir = FileSystem.documentDirectory;
    return dir ? `${dir}crash-set-aside.json` : null;
}

/** The crash screen: remember what was open, for the next start. */
export function writeCrashSetAside(workspaceId: string | null): void {
    cached = undefined;
    try {
        const file = markerFile();
        if (!file) return;
        if (!file.exists) file.create();
        file.write(JSON.stringify({ workspaceId, at: Date.now() } satisfies SetAside));
    } catch {
        // Nothing to do: the next start simply opens where it would have.
    }
}

/** Restart: try the same place again. */
export function clearCrashSetAside(): void {
    cached = undefined;
    try {
        const file = markerFile();
        if (file?.exists) file.delete();
    } catch {
        // A marker that can't be deleted only means one start opens Home.
    }
}

/**
 * The workspace this start must not open, read once per start and then cleared
 * on disk (a later crash writes a new one). The value is kept for the rest of
 * this start so every startup reader agrees.
 */
export function startupSetAsideWorkspaceId(): string | null {
    if (cached === undefined) {
        cached = null;
        try {
            const file = markerFile();
            if (file?.exists) {
                const parsed = JSON.parse(file.textSync()) as Partial<SetAside>;
                cached = { workspaceId: typeof parsed.workspaceId === "string" ? parsed.workspaceId : null, at: Number(parsed.at) || 0 };
                file.delete();
            }
        } catch {
            cached = null;
        }
    }
    return cached?.workspaceId ?? null;
}

/** True when this start is avoiding a page the last crash was on. */
export function startupHasSetAside(): boolean {
    startupSetAsideWorkspaceId();
    return cached != null;
}
