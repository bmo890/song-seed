import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type HierarchyLevel =
  | "home"
  | "revisit"
  | "workspace"
  | "collection"
  | "subcollection"
  | "song"
  | "clip"
  | "activity"
  | "library"
  | "settings"
  | "tuner"
  | "metronome"
  | "lyrics"
  | "notepad";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const HIERARCHY_ICON_NAMES: Record<HierarchyLevel, IoniconName> = {
  home: "home-outline",
  revisit: "sparkles-outline",
  workspace: "desktop-outline",
  collection: "file-tray-stacked-outline",
  subcollection: "file-tray-full-outline",
  song: "disc-outline",
  clip: "musical-notes-outline",
  activity: "calendar-outline",
  library: "library-outline",
  settings: "settings-outline",
  tuner: "radio-outline",
  metronome: "pulse-outline",
  lyrics: "book-outline",
  notepad: "pencil-outline",
};

export function getHierarchyIconName(level: HierarchyLevel) {
  return HIERARCHY_ICON_NAMES[level];
}
