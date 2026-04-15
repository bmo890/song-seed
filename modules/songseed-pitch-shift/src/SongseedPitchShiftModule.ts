import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  NativePitchShiftCapabilities,
  NativePitchShiftLoadRequest,
  NativeMixedRenderRequest,
  NativeMixedRenderResult,
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
  renderMixedFile(request: NativeMixedRenderRequest): Promise<NativeMixedRenderResult>;
}

export default requireOptionalNativeModule<SongseedPitchShiftModule>("SongseedPitchShift");
