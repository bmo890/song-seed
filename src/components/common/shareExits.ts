import { i18n } from "../../i18n/instance";
import type { ProFeature } from "../../domain/entitlements";
import { canSendLink } from "../../domain/proGating";
import { useSentLinksStore } from "../../state/useSentLinksStore";

/**
 * The ways a thing leaves the phone (founder, 2026-11-01). A Share menu row
 * names which one it is (`SelectionAction.exit`); the menu then says, under
 * each row, what that way carries and who it is for, and keeps them in one
 * order wherever they appear: the raw audio, the DAW file, a link for someone,
 * a file for yourself.
 */
export type ShareExit = "audio" | "daw" | "send" | "export";

export const SHARE_EXIT_ORDER: readonly ShareExit[] = ["audio", "daw", "send", "export"];

const HINT_KEY: Record<ShareExit, string> = {
  audio: "shareExit.audioHint",
  daw: "shareExit.dawHint",
  send: "shareExit.sendHint",
  export: "shareExit.fileHint",
};

export function shareExitHint(exit: ShareExit): string {
  return i18n.t(HINT_KEY[exit]);
}

/**
 * The exits that are Pro doors (domain/proCatalog.ts), so every Share menu marks
 * them the same way without a call site saying so: Export for DAW always, SongNook
 * Send once this month's free links are used. `atLimit` is read when the menu
 * opens; the gate itself is still the one in `openSendSheet`.
 */
export function shareExitGate(exit: ShareExit | undefined): { feature: ProFeature; atLimit?: boolean } | null {
  if (exit === "daw") return { feature: "daw-export" };
  if (exit === "send") {
    return { feature: "send", atLimit: !canSendLink(useSentLinksStore.getState().recentSendCount(), false) };
  }
  return null;
}

