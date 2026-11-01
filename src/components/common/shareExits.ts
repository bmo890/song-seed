import { i18n } from "../../i18n/instance";

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

