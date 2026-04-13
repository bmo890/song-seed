export type IdeaStatus = "seed" | "sprout" | "semi" | "song" | "clip";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
};

export type EditActionType = "keep" | "remove";

export type EditRegion = {
  id: string;
  startMs: number;
  endMs: number;
  type: EditActionType;
};

export type ChordPlacement = {
  id: string;
  chord: string;
  at: number;
};

export type LyricsLine = {
  id: string;
  text: string;
  chords: ChordPlacement[];
};

export type LyricsDocument = {
  lines: LyricsLine[];
};

export type LyricsVersion = {
  id: string;
  createdAt: number;
  updatedAt: number;
  document: LyricsDocument;
};

export type ProjectLyrics = {
  versions: LyricsVersion[];
};

export type PracticeMarker = {
  id: string;
  label: string;
  atMs: number;
};

export type ClipVersion = {
  id: string;
  title: string;
  notes: string;
  createdAt: number;
  importedAt?: number;
  sourceCreatedAt?: number;
  isPrimary: boolean;
  parentClipId?: string;
  audioUri?: string;
  sourceAudioUri?: string;
  durationMs?: number;
  waveformPeaks?: number[];
  editRegions?: EditRegion[];
  tags?: string[];
  practiceMarkers?: PracticeMarker[];
  manualSortOrder?: number;
};

export type CustomTagDefinition = {
  key: string;
  label: string;
  color: string;
};

export type SongIdea = {
  id: string;
  title: string;
  notes: string;
  status: IdeaStatus;
  completionPct: number;
  kind: "project" | "clip";
  collectionId: string;
  clips: ClipVersion[];
  lyrics?: ProjectLyrics;
  customTags?: CustomTagDefinition[];
  createdAt: number;
  importedAt?: number;
  sourceCreatedAt?: number;
  lastActivityAt: number;
  isDraft?: boolean;
  isBookmarked?: boolean;
};

export type PlaybackQueueItem = { ideaId: string; clipId: string };
export type PlayerTarget = PlaybackQueueItem | null;
export type InlineTarget = { ideaId: string; clipId: string } | null;
export type TransportScreenKind = "recording" | "player" | "editor";
export type TransportInteractionZone = "header" | "surface" | "footer" | "floating";
export type LyricsAutoscrollMode = "off" | "follow" | "manual";
export type LyricsAutoscrollState = {
  mode: LyricsAutoscrollMode;
  currentTimeMs: number;
  durationMs: number;
  activeLineId?: string | null;
};

export type IdeasTimelineMetric = "created" | "updated";

export type ActivityMetric = "created" | "updated";
export type ActivitySource =
  | "recording"
  | "import"
  | "song-save"
  | "lyrics-save"
  | "audio-edit"
  | "history-seed";
export type ActivityIdeaKind = "song" | "clip";

export type ActivityEvent = {
  id: string;
  at: number;
  workspaceId: string;
  collectionId: string;
  ideaId: string;
  ideaKind: ActivityIdeaKind;
  ideaTitle: string;
  clipId?: string | null;
  metric: ActivityMetric;
  source: ActivitySource;
};

export type IdeasHiddenDay = {
  metric: IdeasTimelineMetric;
  dayStartTs: number;
};

export type IdeasListState = {
  hiddenIdeaIds: string[];
  hiddenDays: IdeasHiddenDay[];
};

export type WorkspaceHiddenDay = IdeasHiddenDay;
export type WorkspaceIdeasListState = IdeasListState;

export type WorkspaceArchiveState = {
  schemaVersion: number;
  archivedAt: number;
  archiveUri: string;
  packageSizeBytes: number;
  originalAudioBytes: number;
  originalMetadataBytes: number;
  archivedMetadataBytes: number;
  savingsBytes: number;
  audioFileCount: number;
  missingFileCount: number;
};

export type Collection = {
  id: string;
  title: string;
  workspaceId: string;
  parentCollectionId?: string | null;
  createdAt: number;
  updatedAt: number;
  ideasListState: IdeasListState;
};

export type Workspace = {
  id: string;
  title: string;
  description?: string;
  isArchived?: boolean;
  archiveState?: WorkspaceArchiveState;
  collections: Collection[];
  ideas: SongIdea[];
  ideasListState?: WorkspaceIdeasListState;
};

export type WorkspaceStartupPreference = "primary" | "last-used";
export type WorkspaceListOrder = "last-worked" | "least-recent" | "title-az" | "title-za";
export type BackupReminderFrequency = "off" | "weekly" | "monthly" | "quarterly";

export type PlaylistItemKind = "song" | "clip";

export type PlaylistItem = {
  id: string;
  kind: PlaylistItemKind;
  workspaceId: string;
  collectionId: string;
  ideaId: string;
  clipId?: string | null;
  addedAt: number;
};

export type Playlist = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  items: PlaylistItem[];
};

export type PlayerState = {
  target: PlayerTarget;
  isPlaying: boolean;
  isLoaded: boolean;
  isLooping: boolean;
  position: number;
  duration: number;
};

export type InlinePlayer = {
  inlineTarget: InlineTarget;
  inlinePosition: number;
  inlineDuration: number;
  isInlinePlaying: boolean;
  toggleInlinePlayback: (ideaId: string, clip: ClipVersion) => Promise<void>;
  beginInlineScrub: () => Promise<void>;
  endInlineScrub: (ms: number) => Promise<void>;
  cancelInlineScrub: () => Promise<void>;
  seekInline: (ms: number) => Promise<void>;
  resetInlinePlayer: () => Promise<void>;
};

export type IdeasFilter = "all" | "clips" | "projects" | "bookmarked";
export type IdeaSort =
  | "newest"
  | "oldest"
  | "updated-newest"
  | "updated-oldest"
  | "title-az"
  | "title-za"
  | "duration-long"
  | "duration-short"
  | "completion-high"
  | "completion-low";

/**
 * @description Type definition for the clipboard content. This is a type, not a component.
 */
export type ClipClipboard = {
  mode: "copy" | "move";
  itemType: "clip" | "project" | "mixed";
  sourceWorkspaceId: string;
  sourceCollectionId?: string;
  sourceIdeaId?: string;
  clipIds: string[];
  from: "list" | "project";
};
