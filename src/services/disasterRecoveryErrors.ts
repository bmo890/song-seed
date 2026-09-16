import { i18n } from "../i18n/instance";

/**
 * Restore failures carry a CODE for the user-facing alert and keep their precise English
 * `message` for logs and diagnostics. The message names the exact path/check that failed
 * (useful in a support bundle); the code maps to short, translated copy (≤ 20 words) so a
 * Hebrew user is never shown an English internals string.
 */
export type DrRestoreErrorCode =
    | "fileMissing"
    | "unreadable"
    | "notBackup"
    | "newerApp"
    | "unsupported"
    | "integrity"
    | "missingAudio"
    | "mergeNeedsReplace"
    | "destinationConflict"
    | "verifyFailed"
    | "internal";

export class DrRestoreError extends Error {
    readonly code: DrRestoreErrorCode;

    constructor(code: DrRestoreErrorCode, message: string) {
        super(message);
        this.name = "DrRestoreError";
        this.code = code;
    }
}

/**
 * The backup itself recorded missing critical recordings. Callers can catch this and
 * re-run with `allowIncomplete: true` (salvage) after the user explicitly opts in —
 * in a real disaster an incomplete backup beats no restore at all.
 */
export class DrRestoreIncompleteError extends DrRestoreError {
    readonly missingCriticalCount: number;

    constructor(message: string, missingCriticalCount: number) {
        super("missingAudio", message);
        this.name = "DrRestoreIncompleteError";
        this.missingCriticalCount = missingCriticalCount;
    }
}

/** Wrap anything thrown on the restore path so every failure carries a code. */
export function toDrRestoreError(error: unknown, fallbackCode: DrRestoreErrorCode = "internal"): DrRestoreError {
    if (error instanceof DrRestoreError) return error;
    return new DrRestoreError(fallbackCode, error instanceof Error ? error.message : "Backup restore failed.");
}

/** Translated, user-facing description of a restore failure. */
export function describeDrRestoreError(error: unknown): string {
    const code: DrRestoreErrorCode = error instanceof DrRestoreError ? error.code : "internal";
    return i18n.t(`backupRestoreError.${code}`);
}
