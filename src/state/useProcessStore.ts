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
        { label: "Verify", phases: ["verifying", "hashing"] },
        { label: "Restore", phases: ["restoring"] },
        { label: "Commit", phases: ["committing"] },
    ],
};

export type ProcessStepState = "done" | "active" | "upcoming";
export type ProcessStep = { label: string; state: ProcessStepState };

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

/** 0–100 for the current phase, or null when the phase has no byte total (indeterminate). */
export function getProcessPercent(process: LibraryProcess): number | null {
    const { completedBytes, totalBytes } = process.progress;
    if (totalBytes <= 0) return null;
    return Math.min(100, Math.max(0, Math.round((completedBytes / totalBytes) * 100)));
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
    update: (progress) =>
        set((state) =>
            state.process && state.process.status === "running"
                ? { process: { ...state.process, progress } }
                : state
        ),
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
