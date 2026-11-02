import { i18n } from "../i18n/instance";
import { UserFacingError } from "../i18n/userFacingError";
import { haptic } from "../design/haptics";
import { toast } from "../components/common/toastStore";
import { takeHoldsRecorder } from "./recordingTakeSession";

/**
 * One heavy library operation at a time (audit 2026-11-02, root cause 3).
 *
 * Import, restore, archive, unarchive, recover and backup each spend seconds to
 * minutes copying or rewriting the library's files. Two of them at once overwrote
 * each other's results, and a take recorded during one could land in a library the
 * operation then replaced, or fill the disk under it. So:
 *
 * - one slot: a second operation is refused while the first runs;
 * - a take holding the recorder refuses every operation, and a running operation
 *   refuses a new take (the recorder asks `recordingBlockedBy()` first);
 * - the automatic backup is the one exception: it runs on its own schedule, so it
 *   steps aside — a take, or an operation the person starts, stops it instead of
 *   being refused.
 *
 * The automatic backup's own skip logic (automaticBackupRunner) reads this gate too,
 * so there is one answer to "is something heavy running?".
 */

export type LibraryOperationKind = "import" | "restore" | "archive" | "unarchive" | "recover" | "backup";

type Slot = {
    kind: LibraryOperationKind;
    token: number;
    /** Set for a background run that steps aside for whatever the person starts (the
     *  automatic backup): calling it stops the run. */
    stepAside?: () => void;
};

let slot: Slot | null = null;
let nextToken = 1;
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

export class LibraryBusyError extends UserFacingError {
    readonly reason: LibraryOperationKind | "recording";
    constructor(reason: LibraryOperationKind | "recording") {
        super(libraryBusyMessage(reason));
        this.name = "LibraryBusyError";
        this.reason = reason;
    }
}

export function isLibraryBusyError(error: unknown): error is LibraryBusyError {
    return error instanceof LibraryBusyError;
}

function libraryBusyMessage(reason: LibraryOperationKind | "recording"): string {
    return reason === "recording" ? i18n.t("recording.finishTakeFirst") : i18n.t(`libraryBusy.wait.${reason}`);
}

/** The operation holding the slot, or null. */
export function runningLibraryOperation(): LibraryOperationKind | null {
    return slot?.kind ?? null;
}

/** Why a new heavy operation can't start right now, or null when it can. */
export function libraryOperationBlockedReason(): LibraryOperationKind | "recording" | null {
    if (takeHoldsRecorder()) return "recording";
    if (slot?.stepAside) return null;
    return slot?.kind ?? null;
}

/** A running background run gives up the slot (it releases its own as it unwinds). */
function takeOverSteppingAside() {
    if (!slot?.stepAside) return;
    const stop = slot.stepAside;
    slot = null;
    notify();
    stop();
}

/**
 * Take the slot for `kind`. Throws `LibraryBusyError` when a take holds the recorder
 * or another operation runs. Returns the release; call it exactly once (a second
 * call, or a release after the slot changed hands, is ignored).
 */
export function claimLibraryOperation(
    kind: LibraryOperationKind,
    options: { stepAside?: () => void } = {}
): () => void {
    const blocked = libraryOperationBlockedReason();
    if (blocked) throw new LibraryBusyError(blocked);
    takeOverSteppingAside();
    const token = nextToken++;
    slot = { kind, token, stepAside: options.stepAside };
    notify();
    return () => {
        if (slot?.token !== token) return;
        slot = null;
        notify();
    };
}

/** Run `work` holding the slot for `kind`. */
export async function withLibraryOperation<T>(kind: LibraryOperationKind, work: () => Promise<T>): Promise<T> {
    const release = claimLibraryOperation(kind);
    try {
        return await work();
    } finally {
        release();
    }
}

/**
 * The recorder's question before a take starts: the operation that refuses it, or
 * null. A yielding run (the automatic backup) is asked to stop and does not block.
 */
export function recordingBlockedBy(): LibraryOperationKind | null {
    takeOverSteppingAside();
    return slot?.kind ?? null;
}

/**
 * Tell the person calmly that the thing they asked for has to wait. Returns true when
 * `error` was a busy refusal (the caller then shows nothing else). Haptics vocabulary
 * `error`: "something failed" — the action didn't start.
 */
export function tellIfLibraryBusy(error: unknown): boolean {
    if (!isLibraryBusyError(error)) return false;
    haptic.error();
    toast(error.message);
    return true;
}

/** The toast a recorder shows when an operation refuses the take. */
export function tellRecordingWaits(kind: LibraryOperationKind) {
    haptic.error();
    toast(i18n.t(`libraryBusy.recordAfter.${kind}`));
}

export function subscribeLibraryOperation(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Test hook. */
export function resetLibraryOperationGateForTests() {
    slot = null;
    notify();
}
