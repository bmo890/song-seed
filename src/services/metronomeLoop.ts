import * as FileSystem from "expo-file-system/legacy";
import {
  clampMetronomeBpm,
  clampMetronomeSubdivision,
  getMetronomeBeatIntervalMs,
  METRONOME_LOOP_BEAT_COUNT,
  SUBDIVISION_CLICK_ACCENT,
  type MetronomeClickVoice,
  type MetronomeSubdivision,
} from "../domain/metronome";

const SAMPLE_RATE = 44100;
const CHANNEL_COUNT = 1;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const BYTE_RATE = SAMPLE_RATE * CHANNEL_COUNT * BYTES_PER_SAMPLE;
const BLOCK_ALIGN = CHANNEL_COUNT * BYTES_PER_SAMPLE;
const METRONOME_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ""}songnook/metronome`;

function clampSample(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function writeAscii(buffer: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    buffer[offset + index] = value.charCodeAt(index);
  }
}

function writeUInt16(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
}

function writeUInt32(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = (value >> 16) & 0xff;
  buffer[offset + 3] = (value >> 24) & 0xff;
}

function bytesToBase64(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const chunk = (a << 16) | (b << 8) | c;

    output += alphabet[(chunk >> 18) & 0x3f];
    output += alphabet[(chunk >> 12) & 0x3f];
    output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 0x3f] : "=";
    output += index + 2 < bytes.length ? alphabet[chunk & 0x3f] : "=";
  }

  return output;
}

function createWavHeader(dataSize: number) {
  const header = new Uint8Array(44);
  writeAscii(header, 0, "RIFF");
  writeUInt32(header, 4, 36 + dataSize);
  writeAscii(header, 8, "WAVE");
  writeAscii(header, 12, "fmt ");
  writeUInt32(header, 16, 16);
  writeUInt16(header, 20, 1);
  writeUInt16(header, 22, CHANNEL_COUNT);
  writeUInt32(header, 24, SAMPLE_RATE);
  writeUInt32(header, 28, BYTE_RATE);
  writeUInt16(header, 32, BLOCK_ALIGN);
  writeUInt16(header, 34, BITS_PER_SAMPLE);
  writeAscii(header, 36, "data");
  writeUInt32(header, 40, dataSize);
  return header;
}

type ClickLoopOptions = {
  beatCount?: number;
  accentDownbeat?: boolean;
  /** Per-beat played/silent mask (calibration gap patterns). Missing entries play. */
  beatPattern?: boolean[];
  /** Sub-clicks per beat (audio only) — 1 = beats only. */
  subdivision?: MetronomeSubdivision;
  clickVoice?: MetronomeClickVoice;
};

/**
 * One click timbre. The same table lives in both native engines — keep the three
 * verbatim so every surface sounds identical. (This renderer's MAIN-click amplitudes
 * stay at the legacy 0.62/0.42 levels it has always used.)
 */
type ClickVoiceSpec = {
  baseFrequency: number;
  overtoneFrequency: number;
  decayPower: number;
  mixBase: number;
  mixOvertone: number;
  durationMs: number;
  attackMs: number;
  amplitudeBase: number;
  amplitudeScale: number;
};

const CLICK_VOICES: Record<MetronomeClickVoice, { downbeat: ClickVoiceSpec; weak: ClickVoiceSpec }> = {
  click: {
    downbeat: { baseFrequency: 1960, overtoneFrequency: 2940, decayPower: 2.8, mixBase: 0.78, mixOvertone: 0.22, durationMs: 34, attackMs: 3, amplitudeBase: 0.22, amplitudeScale: 0.46 },
    weak: { baseFrequency: 1560, overtoneFrequency: 2350, decayPower: 2.4, mixBase: 0.78, mixOvertone: 0.22, durationMs: 34, attackMs: 3, amplitudeBase: 0.22, amplitudeScale: 0.46 },
  },
  wood: {
    downbeat: { baseFrequency: 1180, overtoneFrequency: 1770, decayPower: 3.2, mixBase: 0.7, mixOvertone: 0.3, durationMs: 46, attackMs: 1.5, amplitudeBase: 0.26, amplitudeScale: 0.5 },
    weak: { baseFrequency: 880, overtoneFrequency: 1320, decayPower: 2.9, mixBase: 0.7, mixOvertone: 0.3, durationMs: 46, attackMs: 1.5, amplitudeBase: 0.26, amplitudeScale: 0.5 },
  },
};

/** Additively mix one click into `pcm` at `onset`, truncated at `totalFrames`. */
function mixClick(pcm: Float32Array, onset: number, spec: ClickVoiceSpec, amplitude: number, totalFrames: number) {
  const clickFrameCount = Math.min(totalFrames, Math.max(1, Math.round((SAMPLE_RATE * spec.durationMs) / 1000)));
  const attackFrameCount = Math.max(1, Math.round((SAMPLE_RATE * spec.attackMs) / 1000));
  for (let frameIndex = 0; frameIndex < clickFrameCount; frameIndex += 1) {
    const absoluteFrame = onset + frameIndex;
    if (absoluteFrame >= totalFrames) {
      break;
    }
    const sampleTime = frameIndex / SAMPLE_RATE;
    const attack = Math.min(1, frameIndex / attackFrameCount);
    const decay = Math.pow(1 - frameIndex / clickFrameCount, spec.decayPower);
    const sample =
      (Math.sin(2 * Math.PI * spec.baseFrequency * sampleTime) * spec.mixBase +
        Math.sin(2 * Math.PI * spec.overtoneFrequency * sampleTime) * spec.mixOvertone) *
      amplitude *
      attack *
      decay;
    pcm[absoluteFrame] = clampSample(pcm[absoluteFrame] + sample);
  }
}

function buildClickLoopBytes(bpm: number, options: ClickLoopOptions = {}) {
  const beatCount = Math.max(1, options.beatCount ?? METRONOME_LOOP_BEAT_COUNT);
  const accentDownbeat = options.accentDownbeat ?? true;
  const beatPattern = options.beatPattern ?? null;
  const subdivision = clampMetronomeSubdivision(options.subdivision ?? 1);
  const voices = CLICK_VOICES[options.clickVoice ?? "click"];
  const beatIntervalMs = getMetronomeBeatIntervalMs(bpm);
  const beatFrames = Math.max(1, Math.round((SAMPLE_RATE * beatIntervalMs) / 1000));
  const totalFrames = beatFrames * beatCount;
  const totalSamples = totalFrames * CHANNEL_COUNT;
  const pcm = new Float32Array(totalSamples);

  for (let beatIndex = 0; beatIndex < beatCount; beatIndex += 1) {
    if (beatPattern && beatPattern[beatIndex] === false) {
      continue;
    }
    const startFrame = beatIndex * beatFrames;
    const isDownbeat = accentDownbeat && beatIndex === 0;
    mixClick(pcm, startFrame, isDownbeat ? voices.downbeat : voices.weak, isDownbeat ? 0.62 : 0.42, totalFrames);
    for (let step = 1; step < subdivision; step += 1) {
      const subFrame = startFrame + Math.round((step * beatFrames) / subdivision);
      mixClick(pcm, subFrame, voices.weak, voices.weak.amplitudeBase + SUBDIVISION_CLICK_ACCENT * voices.weak.amplitudeScale, totalFrames);
    }
  }

  const dataSize = totalSamples * BYTES_PER_SAMPLE;
  const wavBytes = new Uint8Array(44 + dataSize);
  wavBytes.set(createWavHeader(dataSize), 0);

  let offset = 44;
  for (let index = 0; index < totalSamples; index += 1) {
    const sample = Math.round(clampSample(pcm[index]) * 32767);
    wavBytes[offset] = sample & 0xff;
    wavBytes[offset + 1] = (sample >> 8) & 0xff;
    offset += 2;
  }

  return wavBytes;
}

async function ensureMetronomeDirectory() {
  if (!METRONOME_DIR) {
    throw new Error("File system directory unavailable for metronome loop rendering.");
  }

  const info = await FileSystem.getInfoAsync(METRONOME_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(METRONOME_DIR, { intermediates: true });
  }
}

export async function ensureMetronomeLoopFile(
  bpm: number,
  options: { subdivision?: MetronomeSubdivision; clickVoice?: MetronomeClickVoice } = {}
) {
  const normalizedBpm = clampMetronomeBpm(bpm);
  const subdivision = clampMetronomeSubdivision(options.subdivision ?? 1);
  const clickVoice = options.clickVoice ?? "click";
  const beatIntervalMs = getMetronomeBeatIntervalMs(normalizedBpm);
  const durationMs = beatIntervalMs * METRONOME_LOOP_BEAT_COUNT;
  // The ornament is baked into the samples, so it is baked into the name too; the stock
  // click keeps its old filename so existing cached loops stay valid.
  const filename =
    `loop-${normalizedBpm}-${METRONOME_LOOP_BEAT_COUNT}` +
    `${subdivision > 1 ? `-s${subdivision}` : ""}${clickVoice !== "click" ? `-${clickVoice}` : ""}.wav`;

  await ensureMetronomeDirectory();

  const uri = `${METRONOME_DIR}/${filename}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    const wavBytes = buildClickLoopBytes(normalizedBpm, { subdivision, clickVoice });
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(wavBytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return {
    uri,
    bpm: normalizedBpm,
    beatIntervalMs,
    durationMs,
    beatsPerLoop: METRONOME_LOOP_BEAT_COUNT,
  };
}

export async function ensureCalibrationClickTrackFile(
  bpm: number,
  beatCount: number,
  beatPattern?: boolean[]
) {
  const normalizedBpm = clampMetronomeBpm(bpm);
  const normalizedBeatCount = Math.max(1, Math.round(beatCount));
  const beatIntervalMs = getMetronomeBeatIntervalMs(normalizedBpm);
  const durationMs = beatIntervalMs * normalizedBeatCount;
  // The gap pattern is baked into the samples, so it must be baked into the name too —
  // a bitmask keeps each per-run pattern as its own small cached file.
  const patternKey = beatPattern
    ? `-${beatPattern.reduce((mask, played, index) => (played ? mask | (1 << index) : mask), 0).toString(16)}`
    : "";
  const filename = `calibration-${normalizedBpm}-${normalizedBeatCount}${patternKey}.wav`;

  await ensureMetronomeDirectory();

  const uri = `${METRONOME_DIR}/${filename}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    const wavBytes = buildClickLoopBytes(normalizedBpm, {
      beatCount: normalizedBeatCount,
      accentDownbeat: false,
      beatPattern,
    });
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(wavBytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return {
    uri,
    bpm: normalizedBpm,
    beatIntervalMs,
    durationMs,
    beatsPerLoop: normalizedBeatCount,
  };
}
