import { NativeModule, registerWebModule } from "expo";

import {
  type NativePitchShiftCapabilities,
  type NativePitchShiftLoadRequest,
  type NativePitchShiftPlaybackState,
  type NativePitchShiftRenderRequest,
  type NativePitchShiftRenderResult,
} from "./SongseedPitchShift.types";

const DEFAULT_CAPABILITIES: NativePitchShiftCapabilities = {
  isAvailable: false,
  supportsPracticePlayback: false,
  supportsEditorPreview: false,
  supportsOfflineRender: false,
  minSemitones: -12,
  maxSemitones: 12,
};

class SongseedPitchShiftModule extends NativeModule {
  private readonly defaultPlaybackState: NativePitchShiftPlaybackState = {
    isAvailable: false,
    isLoaded: false,
    isPlaying: false,
    didJustFinish: false,
    currentTimeMs: 0,
    durationMs: 0,
    playbackRate: 1,
    pitchShiftSemitones: 0,
    sourceUri: null,
  };

  isAvailable() {
    return false;
  }

  async getCapabilities(): Promise<NativePitchShiftCapabilities> {
    return DEFAULT_CAPABILITIES;
  }

  async getPlaybackState(): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async loadForPractice(_request: NativePitchShiftLoadRequest): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async play(): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async pause(): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async stop(): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async unload(): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async seekTo(_positionMs: number): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async setPlaybackRate(_rate: number): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async setPitchShiftSemitones(_semitones: number): Promise<NativePitchShiftPlaybackState> {
    return this.defaultPlaybackState;
  }

  async renderPitchShiftedFile(
    _request: NativePitchShiftRenderRequest
  ): Promise<NativePitchShiftRenderResult> {
    throw new Error("Pitch shift rendering is not available on web.");
  }
}

export default registerWebModule(SongseedPitchShiftModule, "SongseedPitchShift");
