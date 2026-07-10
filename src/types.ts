import type { MetronomeMeterId } from "./metronome";

export type IdeaStatus = "seed" | "sprout" | "stem" | "song" | "clip";

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
  /** Set once the revision has been saved to the Lyrics Pad. */
  savedLyricId?: string;
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
  /** Cut seams for the seam-based Cut surface: seam `s` (1..words-1) sits before
   * word `s` and, when present here, marks a chunk boundary. Undefined until the
   * writer first enters the Cut step (seeded from the source's phrase breaks). */
  cutSeams?: number[];
  chunks: CutUpChunk[];
  boardItems: CutUpBoardItem[];
  /** The rebuilt + edited draft; preserved alongside the chunks. */
  assembledDraftText: string;
  savedLyricId?: string;
  /** Steps whose help has already been opened — highlight on first visit. */
  seenHelpSteps: CutUpStep[];
};

// ── Magpie Spark ─────────────────────────────────────────────────────────────
/** A third Lyrics Spark exercise, after Jeff Tweedy's "stealing words from a
 * book" prompt (How to Write One Song, 2020): open a real book to a random page,
 * hum a melody, and pocket the words and phrases that sound good against it — then
 * compile the collected fragments into a fresh lyric. Named "Magpie" for the bird
 * that gathers what catches its eye. Lives in the global Lyrics Notebook alongside
 * Notes, Word Ladders, and Cut-Ups; not attached to a song unless sent on. */
export type MagpieStep = "page" | "build";

/** The public-domain book a page is pulled from (Project Gutenberg). `textUrl`
 * is a plain-text file we Range-fetch a page from. */
export type MagpieBook = {
  /** Project Gutenberg id as a string, or a "bundled-*" id for offline passages. */
  id: string;
  title: string;
  author: string;
  textUrl: string;
};

/** A word or phrase pocketed from a page. Carries provenance (which book) and the
 * text as originally pocketed, so a later edit (e.g. a tense change) can show what
 * it came from. */
export type MagpieFragment = {
  id: string;
  /** Current text — may have been edited on the build step. */
  text: string;
  /** The text exactly as pocketed from the page; `text` differs once edited. */
  originalText: string;
  bookTitle: string;
  bookAuthor: string;
  order: number;
  createdAt: number;
};

export type MagpieSpark = {
  id: string;
  type: "magpie";
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Wizard position: pluck words from the page, then build a draft. */
  step: MagpieStep;
  /** The book the current page belongs to; null until the first page loads. */
  book: MagpieBook | null;
  /** The trimmed passage currently on screen (persisted so it survives reopen). */
  pageText: string;
  /** The growing pile — persists across new pages and new books. */
  fragments: MagpieFragment[];
  /** The compiled + edited draft, preserved alongside the fragments. */
  draft: string;
  /** Whether to draw from the whole Gutenberg library (true) or the curated pool
   * (false). */
  wholeLibrary: boolean;
  savedLyricId?: string;
  /** Steps whose help has already been opened — highlight on first visit. */
  seenHelpSteps: MagpieStep[];
};

export type BluetoothMonitoringCalibration = {
  routeKey: string;
  routeLabel: string;
  /** Ear-measured latency of the MEDIA PLAYER pipeline (guide/master playback path).
   *  Historically the only measured number; ExoPlayer buffering makes it much larger
   *  than the click path on many devices. */
  offsetMs: number;
  /** Ear-measured latency of the METRONOME CLICK pipeline (raw audio track path).
   *  Absent on calibrations saved before the two-pass flow — resolvers fall back. */
  clickOffsetMs?: number;
  /** OS-reported output latency at the moment this calibration was taken. BT sink
   *  latency renegotiates per connection; storing the contemporaneous OS number lets
   *  resolvers apply the ear-measured values as a BIAS on top of the CURRENT OS report,
   *  so per-connection drift tracks automatically instead of staling the calibration. */
  osOutputAtCalibrationMs?: number;
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

/** A block in a chord chart. `kind: "text"` is a free-form prose block (its
 * `text` is shown instead of bars) — used for spoken-word parts, structure notes,
 * etc. between musical sections. Anything else is a normal measure block. The
 * field is optional so legacy charts (all measure blocks) deserialize unchanged. */
export type ChordSheetSection = {
  id: string;
  label: string;
  measures: ChordSheetMeasure[];
  notes: string;
  kind?: "section" | "text";
  text?: string;
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

/** How a clip's recording grid was established. */
export type RecordingGridSource = "metronome" | "detected" | "manual";

/** The beat grid a take was recorded against. Snapshotted from the metronome at the
 *  moment recording started, so the tempo/meter a take belongs to survives the global
 *  metronome settings changing later, travels with the clip through archive/share, and
 *  presets the metronome when the user returns to overdub or re-record. */
export type RecordingGrid = {
  bpm: number;
  meterId: MetronomeMeterId;
  /** Count-in bars used for this take (0 = none). Kept for re-record parity. */
  countInBars: number;
  /** Whether the click sounded through the take (vs count-in only). */
  clickThroughTake: boolean;
  /** ms from file t=0 to the first downbeat of the grid. null = unknown (takes recorded
   *  before downbeat measurement existed). Becomes 0 by construction once recordings are
   *  trimmed to the downbeat. */
  firstDownbeatMs: number | null;
  /** Set when something invalidated the grid mid-take (audio route change, interruption):
   *  the grid is trustworthy only up to this take position. Absent = valid throughout. */
  gridValidToMs?: number;
  source: RecordingGridSource;
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
  recordingGrid?: RecordingGrid;
  createdAt: number;
  /** Accent hex identifying this layer — auto-assigned (well-spaced hue rotation) when
   *  the stem is created, adjustable afterward. Shown as the layer card's tint, the
   *  lane on the reel, and the waveform colour in Align. Absent on stems saved before
   *  this field existed — callers fall back via getOverdubStemColor(). */
  color?: string;
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
  recordingGrid?: RecordingGrid;
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
  /** Set when the package was moved off-device (Files/Drive) and the local copy deleted.
   *  Restoring then prompts the user to pick the package file. */
  offloadedAt?: number;
  /** File name the package was saved under, shown when asking for it back. */
  offloadedFileName?: string;
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
