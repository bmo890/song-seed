export type NativePitchShiftCapabilities = {
  isAvailable: boolean;
  supportsPracticePlayback: boolean;
  supportsEditorPreview: boolean;
  supportsOfflineRender: boolean;
  minSemitones: number;
  maxSemitones: number;
};

export type NativePitchShiftPlaybackState = {
  isAvailable: boolean;
  isLoaded: boolean;
  isPlaying: boolean;
  didJustFinish: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  pitchShiftSemitones: number;
  sourceUri: string | null;
};

export type NativePitchShiftLoadRequest = {
  sourceUri: string;
  startPositionMs?: number;
  autoplay?: boolean;
  playbackRate?: number;
  pitchShiftSemitones?: number;
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
  tonePreset?: "neutral" | "low-cut" | "warm" | "bright";
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

export type SongNookPitchShiftModuleEvents = {
  onStateChange: (params: NativePitchShiftPlaybackState) => void;
  onPlaybackEnded: (params: NativePitchShiftPlaybackState) => void;
  onError: (params: { message: string }) => void;
};
