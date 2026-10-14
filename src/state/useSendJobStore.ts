/**
 * The one SongNook Send seal running behind the app (2026-10-14). Tapping
 * "Get link" used to pin the sender to a spinner in the sheet; now the sheet
 * hands the parcel to this job and folds away, a pill above the dock shows
 * the seal's progress from any page, and the link waits in the pill until
 * it is opened. One job at a time: two seals would fight for the uplink,
 * and a second pill is a stack the page has no room for.
 *
 * Transient, never persisted: a seal cannot survive the process, and a
 * draft the service never finalizes is swept on its side within a day.
 */
import { create } from "zustand";
import * as Clipboard from "expo-clipboard";
import type { SentLink } from "../domain/sentLinks";
import type { SendProgress } from "../domain/sendProgress";
import { describeShareLinkError } from "../services/shareLinkFlow";
import { isSendCancelled } from "../services/shareLink";
import { haptic } from "../design/haptics";
import { i18n } from "../i18n/instance";
import { toast } from "../components/common/toastStore";
import type { SendParcel, SendRequest } from "./useSendSheetStore";

export type SendJobStatus = "running" | "ready" | "error";

export type SendJob = {
  id: number;
  /** The parcel's title as the sender typed it. */
  title: string;
  status: SendJobStatus;
  progress: SendProgress;
  /** Archives pack before they upload; raw clips do not. Decides the bar's shape. */
  hasPacking: boolean;
  startedAt: number;
  uploadStartedAt: number | null;
  /** The job's own sheet is open (progress, the link, or the failure). */
  expanded: boolean;
  link?: SentLink;
  errorTitle?: string;
  errorBody?: string;
  /** Kept for Try again. */
  request: SendRequest;
  parcel: SendParcel;
};

type SendJobStore = {
  job: SendJob | null;
  start: (request: SendRequest, parcel: SendParcel) => void;
  cancel: () => void;
  retry: () => void;
  setExpanded: (expanded: boolean) => void;
  dismiss: () => void;
};

/** Progress ticks arrive many times a second from the upload task; the pill
 *  and sheet only need a few. Phase changes always commit. */
const PROGRESS_COMMIT_INTERVAL_MS = 250;

let nextId = 1;
let controller: AbortController | null = null;
let lastCommitAt = 0;

export const useSendJobStore = create<SendJobStore>((set, get) => {
  const run = (job: SendJob) => {
    controller?.abort();
    const own = new AbortController();
    controller = own;
    set({ job });

    const report = (progress: SendProgress) => {
      const current = get().job;
      if (!current || current.id !== job.id || current.status !== "running") return;
      const now = Date.now();
      const phaseChanged = progress.phase !== current.progress.phase;
      if (!phaseChanged && now - lastCommitAt < PROGRESS_COMMIT_INTERVAL_MS) return;
      lastCommitAt = now;
      set({
        job: {
          ...current,
          progress,
          uploadStartedAt:
            progress.phase === "uploading" && current.uploadStartedAt == null ? now : current.uploadStartedAt,
        },
      });
    };

    void job.request
      .create({ ...job.parcel, progress: { signal: own.signal, onProgress: report } })
      .then(async (link) => {
        if (get().job?.id !== job.id) return;
        // The link is the point: it is on the clipboard before the pill says so.
        await Clipboard.setStringAsync(link.shareUrl).catch(() => {});
        // Haptics: `success` — a meaningful completion, the parcel is sealed.
        haptic.success();
        toast(i18n.t("sendSheet.copied"), "checkmark-outline");
        set((state) =>
          state.job?.id === job.id ? { job: { ...state.job, status: "ready", link } } : state
        );
      })
      .catch((err: unknown) => {
        if (get().job?.id !== job.id) return;
        if (isSendCancelled(err) || own.signal.aborted) {
          // The sender asked for this; nothing to announce beyond the pill going.
          set({ job: null });
          return;
        }
        // Haptics: `error` — a failure the sender must hear about.
        haptic.error();
        const described = describeShareLinkError(err, { emptyMessage: job.request.emptyMessage });
        set((state) =>
          state.job?.id === job.id
            ? { job: { ...state.job, status: "error", errorTitle: described.title, errorBody: described.body } }
            : state
        );
      })
      .finally(() => {
        if (controller === own) controller = null;
      });
  };

  return {
    job: null,
    start: (request, parcel) => {
      lastCommitAt = 0;
      run({
        id: nextId++,
        title: parcel.title,
        status: "running",
        progress: { phase: request.kind === "clips" ? "uploading" : "packing", completedBytes: 0, totalBytes: 0 },
        hasPacking: request.kind !== "clips",
        startedAt: Date.now(),
        uploadStartedAt: null,
        expanded: false,
        request,
        parcel,
      });
    },
    cancel: () => {
      const job = get().job;
      if (!job || job.status !== "running") return;
      // Haptics: `light` — a small state flip; the seal simply stops.
      haptic.light();
      controller?.abort();
      // The pill goes now; the rejection that follows finds no job to touch.
      set({ job: null });
    },
    retry: () => {
      const job = get().job;
      if (!job || job.status !== "error") return;
      lastCommitAt = 0;
      run({
        ...job,
        id: nextId++,
        status: "running",
        progress: { phase: job.hasPacking ? "packing" : "uploading", completedBytes: 0, totalBytes: 0 },
        startedAt: Date.now(),
        uploadStartedAt: null,
        link: undefined,
        errorTitle: undefined,
        errorBody: undefined,
        expanded: true,
      });
    },
    setExpanded: (expanded) => set((state) => (state.job ? { job: { ...state.job, expanded } } : state)),
    dismiss: () => {
      controller?.abort();
      controller = null;
      set({ job: null });
    },
  };
});
