import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  NativeAudioDurationRequest,
  NativeAudioDurationResult,
  NativePitchShiftCapabilities,
  NativePitchShiftLoadRequest,
  NativeMixedRenderRequest,
  NativeMixedRenderResult,
  NativePitchShiftPlaybackState,
  NativePitchShiftRenderRequest,
  NativePitchShiftRenderResult,
  NativeTrimRequest,
  NativeTrimResult,
  NativeWaveformRequest,
  NativeWaveformResult,
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
  // Optional: present only once the native module is rebuilt with these. Callers
  // feature-detect (`if (mod.renderTrim)`) and fall back to @siteed otherwise.
  renderTrim?(request: NativeTrimRequest): Promise<NativeTrimResult>;
  computeWaveform?(request: NativeWaveformRequest): Promise<NativeWaveformResult>;
  /** Cheap duration probe: reads container metadata only (no PCM decode). Optional —
   *  feature-detect before calling; absent on builds predating this native method. */
  getAudioDurationMs?(request: NativeAudioDurationRequest): Promise<NativeAudioDurationResult>;
  /** Preempt in-flight/queued computeWaveform calls whose request `epoch` is older
   *  than `epoch` (they reject with "WAVEFORM_CANCELLED"). Synchronous native
   *  Function; feature-detect before calling. */
  cancelActiveWaveform?(epoch: number): void;
}

export default requireOptionalNativeModule<SongseedPitchShiftModule>("SongseedPitchShift");
