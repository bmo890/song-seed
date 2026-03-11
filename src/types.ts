export type IdeaStatus = "seed" | "sprout" | "semi" | "song" | "clip";

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

export type ClipVersion = {
  id: string;
  title: string;
  notes: string;
  createdAt: number;
  isPrimary: boolean;
  parentClipId?: string;
  audioUri?: string;
  sourceAudioUri?: string;
  durationMs?: number;
  waveformPeaks?: number[];
  editRegions?: EditRegion[];
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
  createdAt: number;
  lastActivityAt: number;
  isDraft?: boolean;
};

export type PlaybackQueueItem = { ideaId: string; clipId: string };
export type PlayerTarget = PlaybackQueueItem | null;
export type InlineTarget = { ideaId: string; clipId: string } | null;

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
  collections: Collection[];
  ideas: SongIdea[];
  ideasListState?: WorkspaceIdeasListState;
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

export type IdeasFilter = "all" | "clips" | "projects";
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
