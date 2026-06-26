export type IdeaStatus = "seed" | "sprout" | "semi" | "song" | "clip";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
};

/** "Word Ladder" is a Jeff Tweedy-style writing exercise: name a job/role and a
 * room/location, then list the verbs that job does (column A) and the nouns
 * found in that room (column B). Pairing the two columns sparks odd, unplanned
 * lyric collisions. Lives in the global Lyrics Notebook alongside Notes, not
 * attached to a song unless the writer chooses to send a line on. */
export type WordLadderWord = {
  id: string;
  text: string;
};

export type WordLadderPairing = {
  id: string;
  columnAWordId: string;
  columnBWordId: string;
  locked: boolean;
};

/** The exercise runs as a linear wizard following Tweedy's method: list words,
 * pair them, write a loose first draft from the pairs, then revise it into
 * something worth keeping. "setup" is a one-time gate that freezes the seeds. */
export type WordLadderStep = "setup" | "pairs" | "draft" | "revise";

export type WordLadderExercise = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Wizard position; "setup" until the writer commits their seeds + words. */
  step: WordLadderStep;
  /** The job/role whose verbs fill column A — e.g. "doctor", "thief". */
  roleSeed: string;
  /** The room/location whose nouns fill column B — e.g. "kitchen", "chapel". */
  placeSeed: string;
  columnA: WordLadderWord[];
  columnB: WordLadderWord[];
  pairings: WordLadderPairing[];
  /** Steps whose help has already been opened — so the help affordance can
   * highlight on a step's first visit, then recede to a quiet link. */
  seenHelpSteps: WordLadderStep[];
  /** Pairing ids the writer has crossed off as "used" while drafting. */
  usedSparkIds: string[];
  /** The loose, unjudged first draft written from the pairs. */
  draft: string;
  /** The tightened rewrite — what gets saved as lyrics. */
  revision: string;
};

// ── Cut-Up Spark ─────────────────────────────────────────────────────────────
/** A second Lyrics Spark exercise, after Jeff Tweedy's cut-up technique (How to
 * Write One Song, 2020): take something already written, slice it into moveable
 * chunks, rearrange them like cut-out paper strips to find unexpected phrase
 * relationships, then rebuild a fresh draft. Lives in the global Lyrics Notebook
 * alongside Notes and Word Ladders; not attached to a song unless sent on. */
export type CutUpChunkMode = "phrase" | "line" | "word" | "custom";

export type CutUpChunk = {
  id: string;
  text: string;
  /** Character span in the source text this chunk was cut from (reference only;
   * approximate after manual splits/merges). */
  sourceStartIndex: number;
  sourceEndIndex: number;
  included: boolean;
  locked?: boolean;
  createdAt: number;
  updatedAt: number;
};

/** A chunk placed on the cut-out board. References a chunk by id; may carry a
 * light text edit (textOverride), be locked against shuffles, or be removed —
 * kept for restore rather than deleted outright. */
export type CutUpBoardItem = {
  id: string;
  chunkId: string;
  textOverride?: string;
  order: number;
  x?: number;
  y?: number;
  locked?: boolean;
  removed?: boolean;
};

/** Wizard position: paste/choose a source, cut it into chunks, rearrange them on
 * the board, then rebuild and edit the draft. */
export type CutUpStep = "source" | "chunk" | "board" | "draft";

export type CutUpSpark = {
  id: string;
  type: "cut-up";
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Wizard position; resumes here on reopen. */
  step: CutUpStep;
  sourceText: string;
  sourceLyricId?: string;
  sourceSongId?: string;
  sourceLyricVersionId?: string;
  chunkMode: CutUpChunkMode;
  chunks: CutUpChunk[];
  boardItems: CutUpBoardItem[];
  /** The rebuilt + edited draft; preserved alongside the chunks. */
  assembledDraftText: string;
  savedLyricId?: string;
  /** Steps whose help has already been opened — highlight on first visit. */
  seenHelpSteps: CutUpStep[];
};

export type BluetoothMonitoringCalibration = {
  routeKey: string;
  routeLabel: string;
  offsetMs: number;
  updatedAt: number;
};

export type EditActionType = "keep" | "remove";

export type EditRegion = {
  id: string;
  startMs: number;
  endMs: number;
  type: EditActionType;
};

export type ChordRoot = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type ChordAccidental = "natural" | "sharp" | "flat";

/** A chord anchored to a position in a lyric line. `chord` is the rendered
 * display text (e.g. "C♯m7/G♯") and `at` is the character index it sits above —
 * both kept for backward compatibility. The optional structured fields let the
 * picker rebuild/edit the chord without re-parsing the display string. */
export type ChordPlacement = {
  id: string;
  /** Display text, e.g. "Cmaj7". */
  chord: string;
  /** Character index in the lyric line this chord is anchored above. */
  at: number;
  /** Structured parts (optional; absent on legacy chords typed as free text). */
  root?: ChordRoot;
  accidental?: ChordAccidental;
  quality?: string;
  extension?: string;
  bassRoot?: ChordRoot;
  bassAccidental?: ChordAccidental;
  customSuffix?: string;
  wordIndex?: number;
  createdAt?: number;
  updatedAt?: number;
};

/** A reusable chord saved/used within a single song, surfaced as quick-insert
 * buttons. Not a global favourites system. */
export type SongChordPaletteItem = {
  id: string;
  displayText: string;
  root?: ChordRoot;
  accidental?: ChordAccidental;
  quality?: string;
  extension?: string;
  bassRoot?: ChordRoot;
  bassAccidental?: ChordAccidental;
  customSuffix?: string;
  useCount?: number;
  lastUsedAt?: number;
};

/** A single bar in a block chord chart — usually one or two chord symbols.
 * `chords` holds display strings (e.g. "Cmaj7", "A7"). */
export type ChordSheetMeasure = {
  id: string;
  chords: string[];
};

/** A labelled block of measures (Intro, Verse, Chorus, …) with optional notes.
 * Blocks are independent — they don't have to fill a line/page like sheet music. */
export type ChordSheetSection = {
  id: string;
  label: string;
  measures: ChordSheetMeasure[];
  notes: string;
};

/** A standalone "real book"-style chord chart for a song: ordered blocks of
 * measures, separate from the lyric-anchored chord chart. */
export type ChordSheet = {
  sections: ChordSheetSection[];
  updatedAt: number;
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
  /** Optional free-text note ("try minor IV here"). */
  note?: string;
};

export type ClipSectionKind =
  | "intro"
  | "verse"
  | "prechorus"
  | "chorus"
  | "bridge"
  | "solo"
  | "outro"
  | "custom";

/** A labelled span of a clip's structure (verse, chorus, …). Each section has an explicit
 *  start and end; sections never overlap but may leave gaps between them. `color` is only
 *  set for custom sections (presets derive their colour from the kind). Legacy sections
 *  stored without `endMs` are backfilled on load (see normalizeSections). */
export type ClipSection = {
  id: string;
  startMs: number;
  endMs: number;
  label: string;
  kind: ClipSectionKind;
  color?: string;
};

export type MusicalMode = "major" | "minor";

/** Cached result of offline key/tempo detection for a clip. */
export type ClipAnalysis = {
  schemaVersion: number;
  analyzedAt: number;
  /** Tonal centre label, e.g. "E♭" / "F♯". null when detection was inconclusive. */
  key: string | null;
  mode: MusicalMode | null;
  /** 0..1 — separation between the winning key and the runner-up. */
  keyConfidence: number;
  /** Detected tempo (BPM), rounded. null when inconclusive. */
  bpm: number | null;
  /** 0..1 — how steady the tempo is; gates the steady click / count-in. */
  bpmSteadiness: number;
  /** Set once the user confirms or overrides the suggestion. */
  confirmed?: boolean;
};

export type ClipOverdubTonePreset = "neutral" | "low-cut" | "warm" | "bright";

export type ClipOverdubRootSettings = {
  gainDb: number;
  tonePreset: ClipOverdubTonePreset;
};

export type ClipOverdubStem = {
  id: string;
  title: string;
  audioUri?: string;
  gainDb: number;
  offsetMs: number;
  tonePreset: ClipOverdubTonePreset;
  isMuted: boolean;
  durationMs?: number;
  waveformPeaks?: number[];
  createdAt: number;
};

export type ClipOverdubState = {
  root?: ClipOverdubRootSettings;
  stems: ClipOverdubStem[];
  renderedMixUri?: string;
  renderedMixDurationMs?: number;
  renderedMixWaveformPeaks?: number[];
  lastRenderedAt?: number;
};

export type ClipVersion = {
  id: string;
  title: string;
  /** True when the title was auto-generated (naming system) and has not been manually edited.
   *  Used to decide which child clips to offer renaming when a parent is renamed. */
  isTitleAutoGenerated?: boolean;
  notes: string;
  createdAt: number;
  importedAt?: number;
  sourceCreatedAt?: number;
  isPrimary: boolean;
  parentClipId?: string;
  /** Time this clip was attached to its current lineage parent. Falls back to createdAt for older clips. */
  parentAssignedAt?: number;
  audioUri?: string;
  sourceAudioUri?: string;
  durationMs?: number;
  waveformPeaks?: number[];
  editRegions?: EditRegion[];
  tags?: string[];
  isBookmarked?: boolean;
  practiceMarkers?: PracticeMarker[];
  sections?: ClipSection[];
  analysis?: ClipAnalysis;
  manualSortOrder?: number;
  overdub?: ClipOverdubState;
};

export type CustomTagDefinition = {
  key: string;
  label: string;
  color: string;
};

export type ClipGroup = {
  id: string;
  name: string;
  collapsed: boolean;
  createdAt: number;
  updatedAt: number;
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
  /** Chords saved/used within this song, surfaced as quick-insert buttons. */
  chordPalette?: SongChordPaletteItem[];
  /** Standalone block chord chart (real-book style) for this song. */
  chordSheet?: ChordSheet;
  customTags?: CustomTagDefinition[];
  clipGroups?: ClipGroup[];
  clipGroupAssignments?: Record<string, string>;
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
  description?: string;
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
  color?: string;
  avatarKey?: number;
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

/** A chart collected into a global Songbook. References its source song live
 * (by id) rather than snapshotting — exports produce the self-contained copy. */
export type SongbookItemKind = "lyricChart" | "chordChart";

export type SongbookItem = {
  id: string;
  kind: SongbookItemKind;
  workspaceId: string;
  ideaId: string;
  /** The lyric version for a lyricChart; chordChart uses the song's chordSheet. */
  versionId?: string;
  addedAt: number;
};

/** A global, cross-workspace collection of lyric/chord charts. */
export type Songbook = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  items: SongbookItem[];
};

/** One song in a setlist, trimmed to just what the band needs: the chosen clips
 * and charts from that song (no version history/lineage). */
export type SetlistEntry = {
  id: string;
  workspaceId: string;
  ideaId: string;
  /** Clip ids to include (e.g. main mix + an isolated bass part). */
  clipIds: string[];
  /** Lyric version ids whose charts to include. */
  lyricVersionIds: string[];
  /** Whether to include the song's standalone chord chart. */
  includeChordSheet: boolean;
  addedAt: number;
};

/** An ordered, shareable set of songs (clips + charts) for a gig/rehearsal. */
export type Setlist = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  entries: SetlistEntry[];
};

export type PlayerState = {
  target: PlayerTarget;
  isPlaying: boolean;
  isLoaded: boolean;
  isLooping: boolean;
  position: number;
  duration: number;
};

export type InlinePlayerSnapshot = {
  inlineTarget: InlineTarget;
  inlinePosition: number;
  inlineDuration: number;
  isInlinePlaying: boolean;
};

export type InlinePlayerControls = {
  getSnapshot: () => InlinePlayerSnapshot;
  toggleInlinePlayback: (ideaId: string, clip: ClipVersion) => Promise<void>;
  beginInlineScrub: () => Promise<void>;
  endInlineScrub: (ms: number) => Promise<void>;
  cancelInlineScrub: () => Promise<void>;
  seekInline: (ms: number) => Promise<void>;
  resetInlinePlayer: () => Promise<void>;
};

export type InlinePlayer = InlinePlayerSnapshot & InlinePlayerControls;

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
