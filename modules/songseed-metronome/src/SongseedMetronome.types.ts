export type NativeMetronomeConfig = {
  bpm: number;
  meterId: string;
  pulsesPerBar: number;
  denominator: number;
  accentPattern: number[];
  clickEnabled: boolean;
  clickVolume: number;
};

export type NativeAudioRouteInfo = {
  name: string;
  type: string;
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
