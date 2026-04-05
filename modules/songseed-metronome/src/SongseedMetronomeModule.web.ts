import { NativeModule, registerWebModule } from "expo";

import type {
  NativeMetronomeConfig,
  NativeMetronomeState,
  SongseedMetronomeModuleEvents,
} from "./SongseedMetronome.types";

const DEFAULT_STATE: NativeMetronomeState = {
  isAvailable: false,
  isRunning: false,
  isCountIn: false,
  bpm: 92,
  meterId: "4/4",
  pulsesPerBar: 4,
  denominator: 4,
  clickEnabled: true,
  clickVolume: 0.5,
  beatIntervalMs: 60000 / 92,
  beatInBar: 1,
  barNumber: 1,
  absolutePulse: 0,
  countInBarsRemaining: 0,
};

class SongseedMetronomeModule extends NativeModule<SongseedMetronomeModuleEvents> {
  private state = DEFAULT_STATE;

  isAvailable(): boolean {
    return false;
  }

  async configure(config: NativeMetronomeConfig): Promise<NativeMetronomeState> {
    this.state = {
      ...this.state,
      bpm: config.bpm,
      meterId: config.meterId,
      pulsesPerBar: config.pulsesPerBar,
      denominator: config.denominator,
      clickEnabled: config.clickEnabled,
      clickVolume: config.clickVolume,
      beatIntervalMs: 60000 / config.bpm,
    };
    return this.state;
  }

  async getState(): Promise<NativeMetronomeState> {
    return this.state;
  }

  async start(): Promise<NativeMetronomeState> {
    this.state = {
      ...this.state,
      isRunning: true,
      isCountIn: false,
      countInBarsRemaining: 0,
    };
    return this.state;
  }

  async startCountIn(bars: number): Promise<NativeMetronomeState> {
    this.state = {
      ...this.state,
      isRunning: true,
      isCountIn: bars > 0,
      countInBarsRemaining: Math.max(0, bars),
    };
    return this.state;
  }

  async stop(): Promise<NativeMetronomeState> {
    this.state = {
      ...this.state,
      isRunning: false,
      isCountIn: false,
      countInBarsRemaining: 0,
    };
    return this.state;
  }
}

export default registerWebModule(SongseedMetronomeModule, "SongseedMetronome");
