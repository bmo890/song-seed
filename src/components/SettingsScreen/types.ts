export type ArchiveExportOptions = {
  includeFullSongHistory: boolean;
  includeNotes: boolean;
  includeLyrics: boolean;
  includeHiddenItems: boolean;
  /** Preserve all Songstead metadata (markers, sections, tags, groups, analysis, waveforms…). */
  preserveAllMetadata: boolean;
};

export type StandardExportOptions = {
  includeNotesAsText: boolean;
  includeLyricsAsText: boolean;
  includeHiddenItems: boolean;
};

export type CollectionSelectionState = "unselected" | "selected" | "inherited" | "excluded";
export type ExportSectionKey = "format" | "scope" | "options" | "generate";
export type SettingsView = "overview" | "library" | "recording" | "sharing" | "about" | "export" | "import" | "storage";

export type SettingsSelectionSummary = {
  selectedWorkspaceCount: number;
  selectedCollectionCount: number;
  exportableIdeaCount: number;
  workspaceCollectionCounts: Record<string, number>;
};

