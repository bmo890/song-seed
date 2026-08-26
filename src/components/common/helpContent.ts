import type { HelpItem } from "./HelpSheet";
import { i18n } from "../../i18n/instance";

/**
 * Help-sheet copy for the audio flows that had no help before. Kept as data so
 * every sheet renders through the shared HelpSheet. Claims here describe real
 * behavior — verify against the flow when it changes.
 *
 * All copy lives in the i18n catalog (helpContent.*). The exported objects use
 * getters so every read resolves against the CURRENT language rather than the
 * language active at import time.
 */

export type HelpContent = { title: string; intro: string; items: HelpItem[] };

const t = (key: string) => i18n.t(`helpContent.${key}`);

const item = (icon: HelpItem["icon"], key: string): HelpItem => ({
  icon,
  label: t(`${key}Label`),
  description: t(`${key}Body`),
});

export const RECORDING_HELP: HelpContent = {
  get title() {
    return t("recording.title");
  },
  get intro() {
    return t("recording.intro");
  },
  get items() {
    return [
      item("mic-outline", "recording.record"),
      item("timer-outline", "recording.countIn"),
      item("musical-notes-outline", "recording.metronome"),
      item("create-outline", "recording.naming"),
      item("swap-horizontal-outline", "recording.tempo"),
      item("bluetooth-outline", "recording.bluetooth"),
      item("phone-portrait-outline", "recording.keepsGoing"),
    ];
  },
};

export const OVERDUB_HELP: HelpContent = {
  get title() {
    return t("overdub.title");
  },
  get intro() {
    return t("overdub.intro");
  },
  get items() {
    return [
      item("layers-outline", "overdub.layers"),
      item("options-outline", "overdub.levels"),
      item("git-compare-outline", "overdub.timing"),
      item("headset-outline", "overdub.solo"),
      item("save-outline", "overdub.editing"),
    ];
  },
};

export const EDITOR_HELP: HelpContent = {
  get title() {
    return t("editor.title");
  },
  get intro() {
    return t("editor.intro");
  },
  get items() {
    return [
      item("cut-outline", "editor.keepRemove"),
      item("add-outline", "editor.parts"),
      item("save-outline", "editor.saving"),
      item("speedometer-outline", "editor.speed"),
    ];
  },
};

export const SHELF_HELP: HelpContent = {
  get title() {
    return t("shelf.title");
  },
  get intro() {
    return t("shelf.intro");
  },
  get items() {
    return [
      item("file-tray-outline", "shelf.add"),
      item("time-outline", "shelf.stay"),
      item("arrow-undo-outline", "shelf.leave"),
    ];
  },
};

export const COMPILATIONS_HELP: HelpContent = {
  get title() {
    return t("compilations.title");
  },
  get intro() {
    return t("compilations.intro");
  },
  get items() {
    return [
      item("musical-notes-outline", "compilations.playlists"),
      item("book-outline", "compilations.songbook"),
      item("albums-outline", "compilations.setlists"),
    ];
  },
};

export const METRONOME_HELP: HelpContent = {
  get title() {
    return t("metronome.title");
  },
  get intro() {
    return t("metronome.intro");
  },
  get items() {
    return [
      item("speedometer-outline", "metronome.tempo"),
      item("grid-outline", "metronome.meter"),
      item("volume-high-outline", "metronome.cues"),
    ];
  },
};

export const SEND_HELP: HelpContent = {
  get title() {
    return t("send.title");
  },
  get intro() {
    return t("send.intro");
  },
  get items() {
    return [
      item("link-outline", "send.key"),
      item("time-outline", "send.expiry"),
      item("cloud-offline-outline", "send.revoke"),
    ];
  },
};
