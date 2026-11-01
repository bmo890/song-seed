import type { HelpItem } from "./HelpSheet";
import { i18n } from "../../i18n/instance";

/**
 * Help-sheet copy for the audio flows, kept as data so every sheet renders
 * through the shared HelpSheet. Each row states an invisible rule (help law,
 * 2026-09-08) — anything a label, placeholder or disabled state already says
 * does not belong here. Claims describe real behaviour; verify against the
 * flow when it changes.
 *
 * All copy lives in the i18n catalog (helpContent.*). The exported objects use
 * getters so every read resolves against the CURRENT language rather than the
 * language active at import time.
 */

export type HelpContent = { thesis: string; items: HelpItem[] };

const t = (key: string) => i18n.t(`helpContent.${key}`);

const item = (icon: HelpItem["icon"], key: string): HelpItem => ({
  icon,
  label: t(`${key}Label`),
  description: t(`${key}Body`),
});

export const RECORDING_HELP: HelpContent = {
  get thesis() {
    return t("recording.thesis");
  },
  get items() {
    return [
      item("timer-outline", "recording.countIn"),
      item("musical-notes-outline", "recording.click"),
      item("phone-portrait-outline", "recording.keepsGoing"),
    ];
  },
};

export const OVERDUB_HELP: HelpContent = {
  get thesis() {
    return t("overdub.thesis");
  },
  get items() {
    return [
      item("layers-outline", "overdub.layers"),
      item("git-compare-outline", "overdub.timing"),
      item("options-outline", "overdub.sound"),
      item("save-outline", "overdub.editing"),
    ];
  },
};

export const EDITOR_HELP: HelpContent = {
  get thesis() {
    return t("editor.thesis");
  },
  get items() {
    return [
      item("cut-outline", "editor.keepRemove"),
      item("save-outline", "editor.saving"),
      item("speedometer-outline", "editor.speed"),
    ];
  },
};

export const SEND_HELP: HelpContent = {
  get thesis() {
    return t("send.thesis");
  },
  get items() {
    return [
      item("link-outline", "send.key"),
      item("time-outline", "send.expiry"),
      item("cloud-offline-outline", "send.revoke"),
    ];
  },
};

/** The ways a thing leaves the phone. A Share menu row names which one it is
 *  (`SelectionAction.exit`), and the menu's "?" explains only the ones it shows. */
export type ShareExit = "audio" | "daw" | "send" | "export";

const SHARE_EXITS: Record<ShareExit, { icon: HelpItem["icon"]; label: string; body: string }> = {
  audio: { icon: "share-social-outline", label: "player.shareAudio", body: "audioBody" },
  daw: { icon: "desktop-outline", label: "player.exportForDaw", body: "dawBody" },
  send: { icon: "paper-plane-outline", label: "player.songnookSend", body: "sendBody" },
  export: { icon: "folder-open-outline", label: "collection.shareFile", body: "exportBody" },
};
const SHARE_EXIT_ORDER: ShareExit[] = ["audio", "daw", "export", "send"];

export function shareHelp(exits: Iterable<ShareExit>): HelpContent {
  const shown = new Set(exits);
  return {
    thesis: t("share.thesis"),
    items: SHARE_EXIT_ORDER.filter((exit) => shown.has(exit)).map((exit) => ({
      icon: SHARE_EXITS[exit].icon,
      label: i18n.t(SHARE_EXITS[exit].label),
      description: t(`share.${SHARE_EXITS[exit].body}`),
    })),
  };
}
