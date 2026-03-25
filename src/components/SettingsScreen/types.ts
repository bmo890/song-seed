import type { Collection, Workspace } from "../../types";

export type ArchiveExportOptions = {
  includeFullSongHistory: boolean;
  includeNotes: boolean;
  includeLyrics: boolean;
  includeHiddenItems: boolean;
};

export type StandardExportOptions = {
  includeNotesAsText: boolean;
  includeLyricsAsText: boolean;
  includeHiddenItems: boolean;
};

export type CollectionSelectionState = "unselected" | "selected" | "inherited" | "excluded";
export type ExportSectionKey = "format" | "scope" | "options" | "generate";
export type SettingsView = "overview" | "export" | "storage";

export type SettingsSelectionSummary = {
  selectedWorkspaceCount: number;
  selectedCollectionCount: number;
  exportableIdeaCount: number;
  workspaceCollectionCounts: Record<string, number>;
};

export type SettingsCollectionTreeProps = {
  workspace: Workspace;
  collection: Collection;
  selectedWorkspaceIds: string[];
  selectedCollectionIds: string[];
  excludedCollectionIds: string[];
  includeHiddenItems: boolean;
  onToggleCollection: (workspace: Workspace, collectionId: string) => void;
};
