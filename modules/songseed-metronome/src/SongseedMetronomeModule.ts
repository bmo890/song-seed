import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  NativeAudioRouteInfo,
  NativeAudioRouteLatency,
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
  start(): Promise<NativeMetronomeState>;
  startCountIn(bars: number): Promise<NativeMetronomeState>;
  stop(): Promise<NativeMetronomeState>;
}

export default requireOptionalNativeModule<SongseedMetronomeModule>("SongseedMetronome");
