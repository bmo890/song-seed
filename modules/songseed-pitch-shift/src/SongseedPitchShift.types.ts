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

export type SongseedPitchShiftModuleEvents = {
  onStateChange: (params: NativePitchShiftPlaybackState) => void;
  onPlaybackEnded: (params: NativePitchShiftPlaybackState) => void;
  onError: (params: { message: string }) => void;
};
