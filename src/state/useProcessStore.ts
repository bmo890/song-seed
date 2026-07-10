import { create } from "zustand";
import type { BackupOperationPhase, BackupOperationProgress } from "../services/backupOperation";

/**
 * The single active long-running library operation (backup / export / restore), lifted OUT
 * of the Settings screen so it survives navigation: the operation reports here, and the
 * root-mounted LibraryProcessHost renders it as a full process sheet or a minimized monitor
 * pill you can return to from anywhere. Only one runs at a time (they contend for storage
 * and the same media files), which keeps this a single slot rather than a queue.
 */

export type LibraryProcessKind = "backup" | "export" | "restore";
export type LibraryProcessStatus = "running" | "success" | "error" | "cancelled";

export type LibraryProcess = {
    id: string;
    kind: LibraryProcessKind;
    /** Short subject shown under the eyebrow, e.g. "Your library" / "Song Seed Archive". */
    title: string;
    status: LibraryProcessStatus;
    progress: BackupOperationProgress;
    startedAt: number;
    /** Collapsed to the monitor pill (still running) vs. shown as the full sheet. */
    minimized: boolean;
    canCancel: boolean;
    /** Terminal message shown on success/error. */
    resultMessage?: string;
    onCancel?: () => void;
};

/** Ordered steps per kind, each mapping to one or more engine phases. Drives the timeline. */
const PROCESS_STEPS: Record<LibraryProcessKind, { label: string; phases: BackupOperationPhase[] }[]> = {
    backup: [
        { label: "Prepare", phases: ["preparing"] },
        { label: "Verify", phases: ["hashing", "verifying"] },
        { label: "Package", phases: ["packaging"] },
        { label: "Save", phases: ["saving"] },
    ],
    export: [
        { label: "Prepare", phases: ["preparing"] },
        { label: "Package", phases: ["packaging"] },
        { label: "Save", phases: ["saving"] },
    ],
    restore: [
        { label: "Inspect", phases: ["inspecting"] },
        { label: "Restore", phases: ["restoring"] },
        { label: "Verify", phases: ["verifying", "hashing"] },
        { label: "Commit", phases: ["committing"] },
    ],
};

/** Phases that stream every media byte — each is one full read pass over the library. */
const BYTE_PHASES = new Set<BackupOperationPhase>(["hashing", "verifying", "packaging", "restoring"]);

export type ProcessStepState = "done" | "active" | "upcoming";
export type ProcessStep = { label: string; state: ProcessStepState };

/**
 * Fraction (0–1) complete across the WHOLE operation, not just the current phase — so an
 * ETA derived from it spans every remaining pass (verify → package → save) instead of
 * resetting to zero each time a phase starts. Models each byte-heavy step as one equal
 * pass; non-byte steps before the passes read as 0 and after them as 1. null when there
 * is no byte total yet (nothing to estimate from).
 */
export function getProcessOverallFraction(process: LibraryProcess): number | null {
    const steps = PROCESS_STEPS[process.kind];
    const byteStepIndices = steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => step.phases.some((phase) => BYTE_PHASES.has(phase)))
        .map(({ index }) => index);
    const totalPasses = byteStepIndices.length;
    if (totalPasses === 0) return null;

    if (process.status === "success") return 1;

    const activeIndex = steps.findIndex((step) => step.phases.includes(process.progress.phase));
    if (activeIndex < 0) return 0;

    const passPosition = byteStepIndices.indexOf(activeIndex);
    if (passPosition < 0) {
        // A non-byte step (prepare / inspect / save / commit): 0 before the passes, 1 after.
        return activeIndex < byteStepIndices[0] ? 0 : 1;
    }

    const { completedBytes, totalBytes } = process.progress;
    const within = totalBytes > 0 ? Math.min(1, Math.max(0, completedBytes / totalBytes)) : 0;
    return (passPosition + within) / totalPasses;
}

/** Resolve the timeline steps + their state from a process's current phase/status. */
export function getProcessSteps(process: LibraryProcess): ProcessStep[] {
    const steps = PROCESS_STEPS[process.kind];
    const activeIndex = steps.findIndex((step) => step.phases.includes(process.progress.phase));
    const resolvedActive = activeIndex >= 0 ? activeIndex : 0;
    return steps.map((step, index) => {
        if (process.status === "success") return { label: step.label, state: "done" };
        if (index < resolvedActive) return { label: step.label, state: "done" };
        if (index === resolvedActive) return { label: step.label, state: "active" };
        return { label: step.label, state: "upcoming" };
    });
}

/** "message · N%" label for compact progress rows (cards, pills). */
export function formatProcessProgress(progress: BackupOperationProgress | null): string | null {
    if (!progress) return null;
    if (progress.totalBytes <= 0) return progress.message;
    const percent = Math.min(
        100,
        Math.max(0, Math.round((progress.completedBytes / progress.totalBytes) * 100))
    );
    return `${progress.message} · ${percent}%`;
}

type StartArgs = {
    id: string;
    kind: LibraryProcessKind;
    title: string;
    canCancel?: boolean;
    onCancel?: () => void;
};

type ProcessStore = {
    process: LibraryProcess | null;
    start: (args: StartArgs) => void;
    update: (progress: BackupOperationProgress) => void;
    setStatus: (status: LibraryProcessStatus, resultMessage?: string) => void;
    setMinimized: (minimized: boolean) => void;
    setCanCancel: (canCancel: boolean) => void;
    /** Fire the process's cancel handle (if cancellable). */
    requestCancel: () => void;
    /** Clear the slot (after a terminal state is acknowledged or auto-timed-out). */
    dismiss: (id?: string) => void;
};

const INITIAL_PROGRESS: BackupOperationProgress = {
    phase: "preparing",
    completedBytes: 0,
    totalBytes: 0,
    message: "Preparing",
};

/**
 * Progress commits re-render every subscriber (the full takeover, the pill, the Settings
 * cards). Native-speed streams report every 2MB (~10–25×/sec), so coalesce byte-only
 * updates to ~4Hz; phase changes and completions always commit immediately.
 */
const PROGRESS_COMMIT_INTERVAL_MS = 250;
let lastProgressCommitAt = 0;

export const useProcessStore = create<ProcessStore>((set, get) => ({
    process: null,
    start: ({ id, kind, title, canCancel = true, onCancel }) =>
        set({
            process: {
                id,
                kind,
                title,
                status: "running",
                progress: INITIAL_PROGRESS,
                startedAt: Date.now(),
                minimized: false,
                canCancel,
                onCancel,
            },
        }),
    update: (progress) => {
        const current = get().process;
        if (!current || current.status !== "running") return;
        const now = Date.now();
        const significant =
            progress.phase !== current.progress.phase ||
            progress.completedBytes >= progress.totalBytes ||
            now - lastProgressCommitAt >= PROGRESS_COMMIT_INTERVAL_MS;
        if (!significant) return;
        lastProgressCommitAt = now;
        set({ process: { ...current, progress } });
    },
    setStatus: (status, resultMessage) =>
        set((state) =>
            state.process ? { process: { ...state.process, status, resultMessage, canCancel: false } } : state
        ),
    setMinimized: (minimized) =>
        set((state) => (state.process ? { process: { ...state.process, minimized } } : state)),
    setCanCancel: (canCancel) =>
        set((state) => (state.process ? { process: { ...state.process, canCancel } } : state)),
    requestCancel: () => {
        const process = get().process;
        if (process?.canCancel && process.onCancel) process.onCancel();
    },
    dismiss: (id) =>
        set((state) => {
            if (id && state.process && state.process.id !== id) return state;
            return { process: null };
        }),
}));
