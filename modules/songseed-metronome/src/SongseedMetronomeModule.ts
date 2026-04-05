import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  NativeMetronomeConfig,
  NativeMetronomeState,
  SongseedMetronomeModuleEvents,
} from "./SongseedMetronome.types";

declare class SongseedMetronomeModule extends NativeModule<SongseedMetronomeModuleEvents> {
  isAvailable(): boolean;
  configure(config: NativeMetronomeConfig): Promise<NativeMetronomeState>;
  getState(): Promise<NativeMetronomeState>;
  start(): Promise<NativeMetronomeState>;
  startCountIn(bars: number): Promise<NativeMetronomeState>;
  stop(): Promise<NativeMetronomeState>;
}

export default requireOptionalNativeModule<SongseedMetronomeModule>("SongseedMetronome");
