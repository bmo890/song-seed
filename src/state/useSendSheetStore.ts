/**
 * The SongNook Send sheet's one open request. Any surface that can send
 * something — a setlist's menu, a collection's ⋯, a clip selection — hands the
 * sheet a title, what it is, and how to make the link; the sheet (mounted once
 * at the root, like ToastHost) asks for the parcel's title, who it's from and a
 * note, seals it, and shows the link. Transient: never persisted.
 */
import { create } from "zustand";
import type { SentLink } from "../domain/sentLinks";
import type { ShareKind } from "../types";

/** What the sender typed on the sheet — the same three lines as the desktop page. */
export type SendParcel = {
  title: string;
  senderName: string | null;
  message: string | null;
};

export type SendRequest = {
  /** Prefilled parcel title — the entity's name. */
  title: string;
  kind: ShareKind;
  /** Shown when there was nothing to send (EmptyShareError). */
  emptyMessage: string;
  /** Builds, uploads and finalizes; throws EmptyShareError / TooLargeShareError /
   *  SendTransferError. The transferId is minted inside. */
  create: (parcel: SendParcel) => Promise<SentLink>;
};

type SendSheetStore = {
  request: SendRequest | null;
  open: (request: SendRequest) => void;
  close: () => void;
};

export const useSendSheetStore = create<SendSheetStore>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

/** The one call every entry point makes. */
export function openSendSheet(request: SendRequest): void {
  useSendSheetStore.getState().open(request);
}
