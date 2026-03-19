import { create } from "zustand";

export interface ImportJob {
    id: string;
    label: string;
    total: number;
    current: number;
    failed: number;
    status: "running" | "done" | "error";
}

interface ImportStore {
    jobs: ImportJob[];
    startJob: (job: Omit<ImportJob, "current" | "failed" | "status">) => void;
    updateJob: (id: string, update: Partial<Omit<ImportJob, "id">>) => void;
    removeJob: (id: string) => void;
}

export const useImportStore = create<ImportStore>((set) => ({
    jobs: [],
    startJob: (job) =>
        set((s) => ({
            jobs: [...s.jobs, { ...job, current: 0, failed: 0, status: "running" }],
        })),
    updateJob: (id, update) =>
        set((s) => ({
            jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...update } : j)),
        })),
    removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
}));
