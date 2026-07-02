import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  NativeAudioRouteInfo,
  NativeAudioRouteLatency,
  NativeGridAnchor,
  NativeMetronomeConfig,
  NativeMetronomeState,
  SongseedMetronomeModuleEvents,
} from "./SongseedMetronome.types";

declare class SongseedMetronomeModule extends NativeModule<SongseedMetronomeModuleEvents> {
  isAvailable(): boolean;
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
  stop(): Promise<NativeMetronomeState>;
}

export default requireOptionalNativeModule<SongseedMetronomeModule>("SongseedMetronome");
