export type NativeMetronomeConfig = {
  bpm: number;
  meterId: string;
  pulsesPerBar: number;
  denominator: number;
  accentPattern: number[];
  clickEnabled: boolean;
  clickVolume: number;
  /** Output latency (ms) of the active route. Delays only the visual beat so it lands with
   *  the audible click (e.g. Bluetooth lag). Omit / 0 = immediate, no compensation. */
  outputLatencyMs?: number;
};

export type NativeAudioRouteInfo = {
  name: string;
  type: string;
};

/** OS-reported latency of the active audio route. Fields are omitted when the platform
 *  can't report them (Android reporting is OEM-variable) — callers must treat absence as
 *  "unknown", never as zero. */
export type NativeAudioRouteLatency = {
  /** Output (playback) latency in ms, including Bluetooth codec buffering where the OS knows it. */
  outputMs?: number;
  /** Input (capture) latency in ms. */
  inputMs?: number;
};

export type NativeMetronomeState = {
  isAvailable: boolean;
  isRunning: boolean;
  isCountIn: boolean;
  bpm: number;
  meterId: string;
  pulsesPerBar: number;
  denominator: number;
  clickEnabled: boolean;
  clickVolume: number;
  beatIntervalMs: number;
  beatInBar: number;
  barNumber: number;
  absolutePulse: number;
  countInBarsRemaining: number;
};

export type BeatEventPayload = {
  beatInBar: number;
  barNumber: number;
  absolutePulse: number;
  isDownbeat: boolean;
  accent: number;
  isCountIn: boolean;
  countInBarsRemaining: number;
  timestampMs: number;
};

export type CountInCompleteEventPayload = {
  timestampMs: number;
};

export type ErrorEventPayload = {
  message: string;
};

export type SongseedMetronomeModuleEvents = {
  onBeat: (params: BeatEventPayload) => void;
  onStateChange: (params: NativeMetronomeState) => void;
  onCountInComplete: (params: CountInCompleteEventPayload) => void;
  onError: (params: ErrorEventPayload) => void;
};
