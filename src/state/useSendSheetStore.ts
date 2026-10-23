/**
 * The SongNook Send sheet's one open request. Any surface that can send
 * something — a setlist's menu, a collection's ⋯, a clip selection — hands the
 * sheet a title, what it is, and how to make the link; the sheet (mounted once
 * at the root, like ToastHost) asks for the parcel's title, who it's from and a
 * note, seals it, and shows the link. Transient: never persisted.
 */
import { create } from "zustand";
import { useSendJobStore } from "./useSendJobStore";
import { toast } from "../components/common/toastStore";
import { ensurePro } from "../components/common/proUpsell";
import { i18n } from "../i18n/instance";
import type { SentLink } from "../domain/sentLinks";
import type { ParcelItem } from "../domain/parcelOrder";
import type { SendProgressOptions } from "../domain/sendProgress";
import type { ShareKind } from "../types";

/** What the sender typed on the sheet — the same three lines as the desktop page. */
export type SendParcel = {
  title: string;
  senderName: string | null;
  message: string | null;
  /** The items' keys in the order the sender chose (only when the request
   *  listed items). The creator applies it with orderByKeys. */
  order?: string[];
  /** Set by the seal job: live progress and the cancel handle. Creators pass it
   *  straight through to the transfer service. */
  progress?: SendProgressOptions;
};

export type SendRequest = {
  /** Prefilled parcel title — the entity's name. */
  title: string;
  kind: ShareKind;
  /** Shown when there was nothing to send (EmptyShareError). */
  emptyMessage: string;
  /** Loose items (clips) the sender may reorder before sealing — the desktop
   *  page's drag-to-reorder and Sort A→Z. A compilation keeps its own order
   *  and a place has none, so those requests list nothing. */
  items?: ParcelItem[];
  /** Builds, uploads and finalizes; throws EmptyShareError / TooLargeShareError /
   *  SendTransferError. The transferId is minted inside. */
  create: (parcel: SendParcel) => Promise<SentLink>;
};

type SendSheetStore = {
  request: SendRequest | null;
  /** Bumps per open so the host mounts a fresh sheet even for the same parcel twice. */
  seq: number;
  open: (request: SendRequest) => void;
  close: () => void;
};

export const useSendSheetStore = create<SendSheetStore>((set) => ({
  request: null,
  seq: 0,
  open: (request) => set((state) => ({ request, seq: state.seq + 1 })),
  close: () => set({ request: null }),
}));

/** The one call every entry point makes. One seal at a time: while one runs,
 *  asking for another opens that seal's sheet instead; a finished one makes way. */
export function openSendSheet(request: SendRequest): void {
  // Sending is Pro (domain/proCatalog.ts "send"); receiving never is. Every "Get a
  // link" row lands here, so this is the one gate.
  if (!ensurePro("send")) return;
  const jobs = useSendJobStore.getState();
  if (jobs.job?.status === "running") {
    toast(i18n.t("sendSheet.oneAtATime"), "paper-plane-outline");
    jobs.setExpanded(true);
    return;
  }
  if (jobs.job) jobs.dismiss();
  useSendSheetStore.getState().open(request);
}
