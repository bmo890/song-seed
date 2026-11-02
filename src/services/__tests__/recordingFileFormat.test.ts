import { RECORDING_FILE_FORMAT, RECORDING_TAKE_SHAPE, recordedBytesPerMinute } from "../recordingTakeSession";
import { assessWavHeader, parseWavLayout } from "../../domain/wavHeader";
import { wavHeaderMatchesFile } from "../wavHeaderReady";

/**
 * Decision F (2026-11-02): a take is 16-bit PCM WAV, 44.1 kHz mono. The audit read
 * 32-bit float off a placeholder analysis object; the recorders' own defaults were
 * 16-bit all along, but nothing in the app SAID so. A library default changing to
 * float would double every take and break the iOS live stream (it converts the
 * buffer as Int16). The format is now stated where the config is built.
 */
describe("the take's file format", () => {
  it("asks both recorders for 16-bit PCM by name", () => {
    // Android reads `encoding`, iOS reads `bitDepth` (RecordingSettings.swift).
    expect(RECORDING_FILE_FORMAT).toEqual({ encoding: "pcm_16bit", bitDepth: 16 });
    expect(RECORDING_TAKE_SHAPE).toMatchObject({ sampleRate: 44100, channels: 1 });
  });

  it("costs about 5.3 MB a minute", () => {
    expect(recordedBytesPerMinute()).toBe(5_292_000);
  });
});

/** The 44-byte header both recorders write: PCM tag 1 (or 3 for float), then the data chunk. */
function header({ tag, bits, dataBytes }: { tag: number; bits: number; dataBytes: number }) {
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const blockAlign = bits / 8;
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + dataBytes, true);
  bytes.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, tag, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, 44100 * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bits, true);
  bytes.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, dataBytes, true);
  return bytes;
}

describe("every WAV reader takes both the new and the old take files", () => {
  const cases = [
    { name: "16-bit PCM (every take)", tag: 1, bits: 16, sampleFormat: "int" },
    { name: "32-bit float (older or outside files)", tag: 3, bits: 32, sampleFormat: "float" },
  ] as const;

  it.each(cases)("$name: layout, duration and header readiness", ({ tag, bits, sampleFormat }) => {
    const oneSecond = 44100 * (bits / 8);
    const file = header({ tag, bits, dataBytes: oneSecond });
    expect(parseWavLayout(file, file.length)).toEqual({
      dataStart: 44,
      dataBytes: oneSecond,
      sampleRate: 44100,
      channels: 1,
      bitsPerSample: bits,
      blockAlign: bits / 8,
      sampleFormat,
    });
    expect(assessWavHeader(file, file.length)).toEqual({ kind: "finalized" });
    expect(wavHeaderMatchesFile(oneSecond, file.length)).toBe(true);
  });

  it.each(cases)("$name: a killed take is finalized to its real length", ({ tag, bits }) => {
    const oneSecond = 44100 * (bits / 8);
    const file = header({ tag, bits, dataBytes: oneSecond });
    new DataView(file.buffer).setUint32(40, 0, true);
    const assessment = assessWavHeader(file, file.length);
    expect(assessment.kind).toBe("unfinalized");
    if (assessment.kind === "unfinalized") expect(assessment.patch.durationMs).toBe(1000);
  });
});
