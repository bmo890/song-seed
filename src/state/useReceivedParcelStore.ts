/**
 * The parcel front door's one open request (2026-10-14). The receive screen
 * opens it after Save, the Received list opens it on a package tap, and the
 * workspace switcher's "From others" cards open it too: every road into a
 * received package passes the same sheet. Transient, never persisted.
 */
import { create } from "zustand";

type ReceivedParcelStore = {
  packageId: string | null;
  /** Bumps per open so the host mounts a fresh sheet for the same package twice. */
  seq: number;
  open: (packageId: string) => void;
  close: () => void;
};

export const useReceivedParcelStore = create<ReceivedParcelStore>((set) => ({
  packageId: null,
  seq: 0,
  open: (packageId) => set((state) => ({ packageId, seq: state.seq + 1 })),
  close: () => set({ packageId: null }),
}));

export function openReceivedParcel(packageId: string): void {
  useReceivedParcelStore.getState().open(packageId);
}
