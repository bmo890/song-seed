import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  NativeAudioRouteInfo,
  NativeAudioRouteLatency,
  NativeGridAnchor,
  NativeMetronomeConfig,
  NativeMetronomeState,
  NativeTempoMapSegment,
  SongNookMetronomeModuleEvents,
} from "./SongNookMetronome.types";

declare class SongNookMetronomeModule extends NativeModule<SongNookMetronomeModuleEvents> {
  isAvailable(): boolean;
  /** Optional: true on binaries whose engines schedule haptic cues natively. */
  supportsScheduledCues?(): boolean;
  configure(config: NativeMetronomeConfig): Promise<NativeMetronomeState>;
  getState(): Promise<NativeMetronomeState>;
  getCurrentAudioOutputRoute(): Promise<NativeAudioRouteInfo | null>;
  /** Optional: absent on app binaries built before the function existed — call with `?.`. */
  getCurrentAudioRouteLatencyMs?(): Promise<NativeAudioRouteLatency | null>;
  /** Optional: apply click volume live without restarting the beat grid. */
  setClickVolume?(volume: number): Promise<NativeMetronomeState>;
  /** Optional: the running grid's anchor (epoch time of pulse 0 + exact pulse spacing). */
  getGridAnchor?(): Promise<NativeGridAnchor>;
  start(): Promise<NativeMetronomeState>;
  startCountIn(bars: number): Promise<NativeMetronomeState>;
  /** Optional: true on binaries whose engines can start the loop mid-bar. */
  supportsPhaseStart?(): boolean;
  /** Optional: true on binaries whose engines schedule clicks along a tempo map
   *  (seamless bar-anchored tempo/meter changes). */
  supportsTempoMap?(): boolean;
  /** Optional: true on binaries whose engines honor `subdivision` and `clickVoice` in
   *  configure(). Absent on older binaries — call with `?.`; hide the controls then. */
  supportsClickStyle?(): boolean;
  /** Optional: true on binaries whose engines render an accent weight of 0 as a true
   *  rest (no click at all) instead of a quiet click — the calibration gap pattern
   *  depends on this. Absent on older binaries — call with `?.`. */
  supportsSilentBeats?(): boolean;
  /** Optional: install a tempo map. While installed, start/startCountIn/startAtPhase
   *  run in map mode (startAtPhase's offset becomes a whole-grid position). A
   *  structural configure() clears it. Absent on older binaries — call with `?.`. */
  configureTempoMap?(segments: NativeTempoMapSegment[]): Promise<NativeMetronomeState>;
  clearTempoMap?(): Promise<NativeMetronomeState>;
  /** Optional: start the click with the loop already `offsetMs` into the bar, so it
   *  joins moving playback in phase. Absent on older binaries — call with `?.`. */
  startAtPhase?(offsetMs: number): Promise<NativeMetronomeState>;
  stop(): Promise<NativeMetronomeState>;
}

export default requireOptionalNativeModule<SongNookMetronomeModule>("SongNookMetronome");
