const mockFiles = new Map<string, Uint8Array>();

jest.mock("expo-file-system", () => ({
    File: class {
        private bytes: Uint8Array | undefined;
        constructor(uri: string) {
            this.bytes = mockFiles.get(uri);
        }
        get exists() {
            return !!this.bytes;
        }
        get size() {
            return this.bytes?.length ?? 0;
        }
        open() {
            const bytes = this.bytes!;
            return {
                offset: 0,
                readBytes(length: number) {
                    return bytes.slice(this.offset, this.offset + length);
                },
                close() {},
            };
        }
    },
}));

import { readVideoCreationTimeMs } from "../videoCreationTime";

const QUICKTIME_EPOCH_OFFSET_S = 2082844800;

function box(type: string, content: Uint8Array): Uint8Array {
    const out = new Uint8Array(8 + content.length);
    new DataView(out.buffer).setUint32(0, out.length);
    for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
    out.set(content, 8);
    return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
}

function movie(createdAtMs: number): Uint8Array {
    const mvhd = new Uint8Array(100);
    new DataView(mvhd.buffer).setUint32(4, Math.floor(createdAtMs / 1000) + QUICKTIME_EPOCH_OFFSET_S);
    return concat(
        box("ftyp", new Uint8Array(8)),
        box("mdat", new Uint8Array(64)),
        box("moov", concat(box("mvhd", mvhd), box("trak", new Uint8Array(16))))
    );
}

describe("readVideoCreationTimeMs", () => {
    it("reads the recording time from the movie header, wherever moov sits", () => {
        const recordedAt = Date.UTC(2025, 5, 14, 18, 30, 12);
        mockFiles.set("file:///cache/video.mov", movie(recordedAt));
        expect(readVideoCreationTimeMs("file:///cache/video.mov")).toBe(recordedAt);
    });

    it("ignores a camera with no clock (time zero) and files that aren't movies", () => {
        mockFiles.set("file:///cache/zero.mov", movie(-QUICKTIME_EPOCH_OFFSET_S * 1000));
        mockFiles.set("file:///cache/text.mov", new TextEncoder().encode("not a movie at all"));
        expect(readVideoCreationTimeMs("file:///cache/zero.mov")).toBeNull();
        expect(readVideoCreationTimeMs("file:///cache/text.mov")).toBeNull();
        expect(readVideoCreationTimeMs("file:///cache/missing.mov")).toBeNull();
    });
});
