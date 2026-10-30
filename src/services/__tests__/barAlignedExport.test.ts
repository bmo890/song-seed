import type { RecordingGrid } from "../../types";

const mockDisk = new Map<string, Uint8Array>();

jest.mock("expo-file-system", () => {
    class FakeHandle {
        offset: number | null = 0;
        uri: string;
        constructor(target: string) {
            this.uri = target;
        }
        get size() {
            return mockDisk.get(this.uri)?.length ?? 0;
        }
        readBytes(length: number) {
            const bytes = mockDisk.get(this.uri) ?? new Uint8Array();
            const from = this.offset ?? 0;
            const out = bytes.slice(from, from + length);
            this.offset = from + out.length;
            return out;
        }
        writeBytes(chunk: Uint8Array) {
            const bytes = mockDisk.get(this.uri) ?? new Uint8Array();
            const from = this.offset ?? 0;
            const next = new Uint8Array(Math.max(bytes.length, from + chunk.length));
            next.set(bytes);
            next.set(chunk, from);
            mockDisk.set(this.uri, next);
            this.offset = from + chunk.length;
        }
        close() {}
    }
    return {
        File: class {
            uri: string;
            constructor(target: string) {
                this.uri = target;
            }
            create() {
                mockDisk.set(this.uri, new Uint8Array());
            }
            open() {
                return new FakeHandle(this.uri);
            }
        },
    };
});
jest.mock("../persistLog", () => ({ persistLog: jest.fn() }));

import { writeBarAlignedCopy } from "../barAlignedExport";

const SR = 8_000;
// 120 bpm in 4/4: bar = 2000 ms = 16 000 frames.
const BAR_FRAMES = 16_000;
const LEAD_FRAMES = 4_000; // first bar line 500 ms in

function grid(): RecordingGrid {
    return { bpm: 120, meterId: "4/4", countInBars: 0, clickThroughTake: true, firstDownbeatMs: 500, source: "metronome" };
}

/** Mono 16-bit take: a value per frame, so every sample can be traced. */
function writeTake(uri: string, sampleAt: (frame: number) => number, frames = 40_000) {
    const bytes = new Uint8Array(44 + frames * 2);
    const view = new DataView(bytes.buffer);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    view.setUint32(4, 36 + frames * 2, true);
    bytes.set([0x57, 0x41, 0x56, 0x45], 8);
    bytes.set([0x66, 0x6d, 0x74, 0x20], 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, SR, true);
    view.setUint32(28, SR * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    bytes.set([0x64, 0x61, 0x74, 0x61], 36);
    view.setUint32(40, frames * 2, true);
    for (let frame = 0; frame < frames; frame += 1) view.setInt16(44 + frame * 2, sampleAt(frame), true);
    mockDisk.set(uri, bytes);
}

function samplesOf(uri: string) {
    const bytes = mockDisk.get(uri)!;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(view.getUint32(40, true)).toBe(bytes.length - 44);
    return Array.from({ length: (bytes.length - 44) / 2 }, (_, frame) => view.getInt16(44 + frame * 2, true));
}

// Each sample's value names its frame (wrapping), loud enough to count as playing.
const traced = (frame: number) => 1000 + (frame % 20_000);

beforeEach(() => mockDisk.clear());

it("pads a take with a pickup so its first bar line lands one bar in, every sample kept", async () => {
    writeTake("file:///take.wav", traced);
    await expect(writeBarAlignedCopy("file:///take.wav", grid(), "file:///out.wav")).resolves.toBe("pad");
    const out = samplesOf("file:///out.wav");
    const pad = BAR_FRAMES - LEAD_FRAMES;
    expect(out.length).toBe(40_000 + pad);
    expect(out.slice(0, pad).every((value) => value === 0)).toBe(true);
    expect(out.slice(pad)).toEqual(samplesOf("file:///take.wav"));
    // The take's bar line now sits exactly one bar into the file.
    expect(out[BAR_FRAMES]).toBe(traced(LEAD_FRAMES));
});

it("cuts a silent lead-in so the file starts on beat 1", async () => {
    writeTake("file:///take.wav", (frame) => (frame < LEAD_FRAMES ? 3 : traced(frame)));
    await expect(writeBarAlignedCopy("file:///take.wav", grid(), "file:///out.wav")).resolves.toBe("cut");
    const out = samplesOf("file:///out.wav");
    expect(out.length).toBe(40_000 - LEAD_FRAMES);
    expect(out[0]).toBe(traced(LEAD_FRAMES));
    expect(out.slice(-1)[0]).toBe(traced(39_999));
});

it("writes nothing for a take that wasn't recorded to the click, or isn't a WAV", async () => {
    writeTake("file:///take.wav", traced);
    await expect(writeBarAlignedCopy("file:///take.wav", null, "file:///out.wav")).resolves.toBe("asIs");
    await expect(writeBarAlignedCopy("file:///take.m4a", grid(), "file:///out.m4a")).resolves.toBe("asIs");
    expect(mockDisk.has("file:///out.wav")).toBe(false);
});

it("never touches the take in the library", async () => {
    writeTake("file:///take.wav", traced);
    const before = mockDisk.get("file:///take.wav")!.slice();
    await writeBarAlignedCopy("file:///take.wav", grid(), "file:///out.wav");
    expect(mockDisk.get("file:///take.wav")).toEqual(before);
});
