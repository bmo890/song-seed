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
