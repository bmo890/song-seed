import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { Collection, SongIdea } from "./types";

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

const HIERARCHY_ICON_COLORS: Record<HierarchyLevel, string> = {
  home: "#475569",
  revisit: "#9a3412",
  workspace: "#0f172a",
  collection: "#64748b",
  subcollection: "#64748b",
  song: "#0f172a",
  clip: "#64748b",
  activity: "#0f172a",
  library: "#0f172a",
  settings: "#0f172a",
  tuner: "#0f172a",
  metronome: "#0f172a",
  lyrics: "#0f172a",
  notepad: "#0f172a",
};

export function getHierarchyIconName(level: HierarchyLevel) {
  return HIERARCHY_ICON_NAMES[level];
}

export function getHierarchyIconColor(level: HierarchyLevel) {
  return HIERARCHY_ICON_COLORS[level];
}

export function getCollectionHierarchyLevel(collection: Pick<Collection, "parentCollectionId">): HierarchyLevel {
  return collection.parentCollectionId ? "subcollection" : "collection";
}

export function getIdeaHierarchyLevel(idea: Pick<SongIdea, "kind">): HierarchyLevel {
  return idea.kind === "project" ? "song" : "clip";
}
