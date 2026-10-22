import { readUint32LE, wavHeaderMatchesFile } from "../wavHeaderReady";

describe("a just-stopped take's WAV header", () => {
  it("reads the data size little-endian", () => {
    // 0x0010_8A40 = 1_083_968 bytes, about 12.3 s of mono 44.1 kHz 16-bit.
    expect(readUint32LE(btoa(String.fromCharCode(0x40, 0x8a, 0x10, 0x00)))).toBe(1_083_968);
    expect(readUint32LE(btoa(String.fromCharCode(0xff, 0xff, 0xff, 0xff)))).toBe(4_294_967_295);
  });

  it("is final only when it states the bytes on disk", () => {
    expect(wavHeaderMatchesFile(1_084_992, 1_084_992 + 44)).toBe(true);
    // The placeholder header (0) and a stale size both mean: not yet.
    expect(wavHeaderMatchesFile(0, 2_260_000)).toBe(false);
    expect(wavHeaderMatchesFile(1_084_992, 2_260_044)).toBe(false);
    expect(wavHeaderMatchesFile(null, 2_260_044)).toBe(false);
  });
});
