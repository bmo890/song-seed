import { Ionicons } from "@expo/vector-icons";

export type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Central registry of action → icon mappings.
 *
 * Use these everywhere an action appears (dialogs, action sheets, menus,
 * dock buttons) so the same action always shows the same icon across the
 * whole app. Icons carry meaning for non-native speakers, so keep them
 * literal and universally recognisable.
 */
export const actionIcons = {
  // Neutral / dismiss
  cancel: "close",
  confirm: "checkmark",
  done: "checkmark-circle-outline",
  info: "information-circle-outline",
  warning: "alert-circle-outline",

  // Destructive / removal
  delete: "trash-outline",
  discard: "close-circle-outline",
  remove: "remove-circle-outline",
  archive: "archive-outline",
  restore: "refresh-outline",

  // Clip / lineage actions
  branch: "git-branch-outline",
  split: "cut-outline",
  setParent: "git-merge-outline",
  newThread: "radio-button-on-outline",
  history: "time-outline",
  bookmark: "bookmark-outline",
  bookmarkFilled: "bookmark",
  group: "folder-open-outline",

  // Content actions
  copy: "copy-outline",
  move: "arrow-forward-outline",
  paste: "clipboard-outline",
  share: "share-social-outline",
  edit: "create-outline",
  rename: "create-outline",
  add: "add-circle-outline",
  duplicate: "duplicate-outline",

  // Selection
  selectAll: "checkmark-done-outline",
  deselectAll: "ellipse-outline",

  // Audio / playback
  record: "mic-outline",
  play: "play-outline",
  pause: "pause-outline",

  // Song-level
  makeSong: "albums-outline",
  convert: "swap-horizontal-outline",

  // Library / settings
  export: "download-outline",
  import: "cloud-upload-outline",
  settings: "settings-outline",
  openSettings: "settings-outline",
  folder: "folder-outline",
} satisfies Record<string, IoniconName>;
