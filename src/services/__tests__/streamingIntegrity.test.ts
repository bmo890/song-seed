import { createHash } from "crypto";
import {
    IncrementalBase64Sha256,
    IncrementalCrc32,
    IncrementalSha256,
} from "../streamingIntegrity";

function fixture(size: number) {
    return Uint8Array.from({ length: size }, (_, index) => (index * 37 + 11) & 0xff);
}

function feedInChunks(
    bytes: Uint8Array,
    chunkSizes: number[],
    update: (chunk: Uint8Array) => void
) {
    let offset = 0;
    let chunkIndex = 0;
    while (offset < bytes.length) {
        const size = chunkSizes[chunkIndex % chunkSizes.length];
        update(bytes.slice(offset, offset + size));
        offset += size;
        chunkIndex += 1;
    }
}

describe("streaming integrity", () => {
    it.each([0, 1, 2, 3, 63, 64, 65, 1024, 64 * 1024 + 5])(
        "matches SHA-256 for %i raw bytes",
        (size) => {
            const bytes = fixture(size);
            const hash = new IncrementalSha256();
            feedInChunks(bytes, [1, 2, 7, 64, 511], (chunk) => hash.update(chunk));

            expect(hash.digestHex()).toBe(
                createHash("sha256").update(Buffer.from(bytes)).digest("hex")
            );
        }
    );

    it.each([0, 1, 2, 3, 4, 63, 64, 65, 1024, 64 * 1024 + 5])(
        "matches the v1 base64 SHA-256 format for %i bytes",
        (size) => {
            const bytes = fixture(size);
            const hash = new IncrementalBase64Sha256();
            feedInChunks(bytes, [1, 5, 2, 257], (chunk) => hash.update(chunk));

            const base64 = Buffer.from(bytes).toString("base64");
            expect(hash.digestHex()).toBe(createHash("sha256").update(base64).digest("hex"));
        }
    );

    it("matches the standard CRC-32 check value", () => {
        const bytes = Uint8Array.from(Buffer.from("123456789", "ascii"));
        const crc = new IncrementalCrc32();
        feedInChunks(bytes, [2, 1, 4], (chunk) => crc.update(chunk));
        expect(crc.digest()).toBe(0xcbf43926);
    });
});
