import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  NativePitchShiftCapabilities,
  NativePitchShiftLoadRequest,
  NativePitchShiftPlaybackState,
  NativePitchShiftRenderRequest,
  NativePitchShiftRenderResult,
  SongseedPitchShiftModuleEvents,
} from "./SongseedPitchShift.types";

declare class SongseedPitchShiftModule extends NativeModule<SongseedPitchShiftModuleEvents> {
  isAvailable(): boolean;
  getCapabilities(): Promise<NativePitchShiftCapabilities>;
  getPlaybackState(): Promise<NativePitchShiftPlaybackState>;
  loadForPractice(request: NativePitchShiftLoadRequest): Promise<NativePitchShiftPlaybackState>;
  play(): Promise<NativePitchShiftPlaybackState>;
  pause(): Promise<NativePitchShiftPlaybackState>;
  stop(): Promise<NativePitchShiftPlaybackState>;
  unload(): Promise<NativePitchShiftPlaybackState>;
  seekTo(positionMs: number): Promise<NativePitchShiftPlaybackState>;
  setPlaybackRate(rate: number): Promise<NativePitchShiftPlaybackState>;
  setPitchShiftSemitones(semitones: number): Promise<NativePitchShiftPlaybackState>;
  renderPitchShiftedFile(
    request: NativePitchShiftRenderRequest
  ): Promise<NativePitchShiftRenderResult>;
}

export default requireOptionalNativeModule<SongseedPitchShiftModule>("SongseedPitchShift");
