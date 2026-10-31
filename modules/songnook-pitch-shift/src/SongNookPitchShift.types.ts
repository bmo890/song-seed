export type NativePitchShiftCapabilities = {
  isAvailable: boolean;
  supportsPracticePlayback: boolean;
  supportsEditorPreview: boolean;
  supportsOfflineRender: boolean;
  minSemitones: number;
  maxSemitones: number;
  /** The engine mixes the play-along click into the song's own stream (Android builds
   *  from 2026-10-31). Absent on older builds. */
  supportsPlayAlongClick?: boolean;
};

/** One constant-tempo stretch of a take's grid, in content (file) ms. */
export type NativePlayAlongClickSegment = {
  startMs: number;
  pulseMs: number;
  pulsesPerBar: number;
  accentPattern: number[];
};

/** The take's grid for the in-stream play-along click. */
export type NativePlayAlongClickPlan = {
  /** The file the grid belongs to: the engine stays silent for any other. */
  sourceUri: string;
  segments: NativePlayAlongClickSegment[];
  /** No click at or past this content ms (the grid is untrusted there). */
  stopAtMs?: number;
  /** 0..1 */
  volume: number;
  clickVoice: string;
};

/** How the take sounds (Sound room, 2026-10-14): a level in dB, limited after the
 *  lift so a boost never clips, and the tone flags in their canonical encoding
 *  ("neutral", or "+"-joined out of "low-cut" | "low-boost" | "mid-boost" | "hi-cut"). */
export type NativeSoundSettings = {
  gainDb: number;
  tonePreset: string;
};

export type NativePitchShiftPlaybackState = {
  isAvailable: boolean;
  isLoaded: boolean;
  isPlaying: boolean;
  /** Android, native builds from 2026-10-21: asked to play (true while loading). */
  playWhenReady?: boolean;
  didJustFinish: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  pitchShiftSemitones: number;
  /** Absent on native builds predating the Sound room: callers treat it as neutral. */
  soundGainDb?: number;
  soundTonePreset?: string;
  sourceUri: string | null;
  /** Android, in-stream click builds: where the current stream starts (content ms) and
   *  how many clicks have been mixed, for the diagnostic log. */
  playAlongClick?: { planned: boolean; anchorMs: number; clicks: number };
};

export type NativePitchShiftLoadRequest = {
  sourceUri: string;
  startPositionMs?: number;
  autoplay?: boolean;
  playbackRate?: number;
  pitchShiftSemitones?: number;
  /** Level and tone to load with; a build without the EQ stage ignores them. */
  gainDb?: number;
  tonePreset?: string;
};

export type NativePitchShiftRenderRequest = {
  inputUri: string;
  semitones: number;
  playbackRate?: number;
  outputFileName?: string;
};

export type NativePitchShiftRenderResult = {
  outputUri: string;
};

export type NativeMixedRenderInput = {
  inputUri: string;
  gainDb?: number;
  /** Placement of this input on the mix timeline. Positive delays it with leading
   *  silence; NEGATIVE pulls it earlier by dropping the first |offset| of the input
   *  (how a late-recorded overdub gets corrected). */
  offsetMs?: number;
  /** Canonical tone-flag encoding: "neutral", or "+"-joined flags out of
   *  "low-cut" | "low-boost" | "mid-boost" | "hi-cut" (legacy singles "warm"/"bright"
   *  pass through). */
  tonePreset?: string;
};

export type NativeMixedRenderRequest = {
  inputs: NativeMixedRenderInput[];
  outputFileName?: string;
};

export type NativeMixedRenderResult = {
  outputUri: string;
};

export type NativeTrimRange = {
  startTimeMs: number;
  endTimeMs: number;
};

/** Concatenate the given (kept) ranges of `inputUri` into a single output file.
 *  Extract = one range; cut/splice = the complement of the removed ranges. */
export type NativeTrimRequest = {
  inputUri: string;
  ranges: NativeTrimRange[];
  outputFileName?: string;
};

export type NativeTrimResult = {
  outputUri: string;
  /** Android, when the audio was encoded: the encoder's measured priming in samples,
   *  written into the file as an edit list so every player starts at the same sample. */
  primingSamples?: number;
  /** Android: what happened to that edit list ("written", or why not). */
  editList?: string;
};

/** Decode `inputUri` to PCM and return `numberOfPoints` peak values in 0..1. */
export type NativeWaveformRequest = {
  inputUri: string;
  numberOfPoints: number;
  startTimeMs?: number;
  endTimeMs?: number;
  /** Cancellation token: decodes with an epoch older than a cancelActiveWaveform(epoch)
   *  call abort with "WAVEFORM_CANCELLED". Omit for uncancellable requests. */
  epoch?: number;
};

export type NativeWaveformResult = {
  peaks: number[];
  durationMs: number;
};

/** Cheap container-metadata duration probe: reads the declared duration WITHOUT
 *  decoding (Android MediaExtractor KEY_DURATION, iOS AVURLAsset.duration). */
export type NativeAudioDurationRequest = {
  inputUri: string;
};

export type NativeAudioDurationResult = {
  durationMs: number;
};

/** Video import: write the first audio track of `inputUri` to an .m4a, dropping the
 *  picture. AAC is copied as-is; other codecs are encoded to AAC. Rejects with a
 *  message containing "NO_AUDIO_TRACK" when the video has no sound. */
export type NativeAudioExtractRequest = {
  inputUri: string;
  outputFileName?: string;
};

export type NativeAudioExtractResult = {
  outputUri: string;
  durationMs: number;
};

export type SongNookPitchShiftModuleEvents = {
  onStateChange: (params: NativePitchShiftPlaybackState) => void;
  onPlaybackEnded: (params: NativePitchShiftPlaybackState) => void;
  onError: (params: { message: string }) => void;
};
