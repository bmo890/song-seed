import * as FileSystem from "expo-file-system/legacy";
import { clampMetronomeBpm, getMetronomeBeatIntervalMs, METRONOME_LOOP_BEAT_COUNT } from "../metronome";

const SAMPLE_RATE = 44100;
const CHANNEL_COUNT = 1;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const BYTE_RATE = SAMPLE_RATE * CHANNEL_COUNT * BYTES_PER_SAMPLE;
const BLOCK_ALIGN = CHANNEL_COUNT * BYTES_PER_SAMPLE;
const CLICK_DURATION_MS = 34;
const ATTACK_MS = 3;
const METRONOME_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ""}songseed/metronome`;

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

function buildClickLoopBytes(bpm: number) {
  const beatIntervalMs = getMetronomeBeatIntervalMs(bpm);
  const beatFrames = Math.max(1, Math.round((SAMPLE_RATE * beatIntervalMs) / 1000));
  const totalFrames = beatFrames * METRONOME_LOOP_BEAT_COUNT;
  const totalSamples = totalFrames * CHANNEL_COUNT;
  const pcm = new Float32Array(totalSamples);
  const clickFrameCount = Math.min(
    totalFrames,
    Math.max(1, Math.round((SAMPLE_RATE * CLICK_DURATION_MS) / 1000))
  );
  const attackFrameCount = Math.max(1, Math.round((SAMPLE_RATE * ATTACK_MS) / 1000));

  for (let beatIndex = 0; beatIndex < METRONOME_LOOP_BEAT_COUNT; beatIndex += 1) {
    const startFrame = beatIndex * beatFrames;
    const isDownbeat = beatIndex === 0;
    const baseFrequency = isDownbeat ? 1960 : 1560;
    const overtoneFrequency = isDownbeat ? 2940 : 2350;
    const amplitude = isDownbeat ? 0.62 : 0.42;

    for (let frameIndex = 0; frameIndex < clickFrameCount; frameIndex += 1) {
      const absoluteFrame = startFrame + frameIndex;
      if (absoluteFrame >= totalFrames) {
        break;
      }

      const sampleTime = frameIndex / SAMPLE_RATE;
      const attack = Math.min(1, frameIndex / attackFrameCount);
      const decay = Math.pow(1 - frameIndex / clickFrameCount, isDownbeat ? 2.8 : 2.4);
      const envelope = attack * decay;
      const sample =
        (Math.sin(2 * Math.PI * baseFrequency * sampleTime) * 0.78 +
          Math.sin(2 * Math.PI * overtoneFrequency * sampleTime) * 0.22) *
        amplitude *
        envelope;

      pcm[absoluteFrame] = clampSample(pcm[absoluteFrame] + sample);
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

export async function ensureMetronomeLoopFile(bpm: number) {
  const normalizedBpm = clampMetronomeBpm(bpm);
  const beatIntervalMs = getMetronomeBeatIntervalMs(normalizedBpm);
  const durationMs = beatIntervalMs * METRONOME_LOOP_BEAT_COUNT;
  const filename = `loop-${normalizedBpm}-${METRONOME_LOOP_BEAT_COUNT}.wav`;

  await ensureMetronomeDirectory();

  const uri = `${METRONOME_DIR}/${filename}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    const wavBytes = buildClickLoopBytes(normalizedBpm);
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
