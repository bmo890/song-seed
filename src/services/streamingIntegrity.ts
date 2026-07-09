const SHA256_CONSTANTS = Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, count: number) {
    return (value >>> count) | (value << (32 - count));
}

export class IncrementalSha256 {
    private readonly state = Uint32Array.from([
        0x6a09e667,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ]);
    private readonly buffer = new Uint8Array(64);
    private readonly words = new Uint32Array(64);
    private bufferLength = 0;
    private bytesHashed = 0;
    private finished = false;

    update(bytes: Uint8Array) {
        if (this.finished) {
            throw new Error("SHA-256 digest has already been finalized.");
        }
        if (bytes.length === 0) return this;

        this.bytesHashed += bytes.length;
        let offset = 0;

        if (this.bufferLength > 0) {
            const needed = 64 - this.bufferLength;
            const copied = Math.min(needed, bytes.length);
            this.buffer.set(bytes.subarray(0, copied), this.bufferLength);
            this.bufferLength += copied;
            offset += copied;
            if (this.bufferLength === 64) {
                this.processBlock(this.buffer, 0);
                this.bufferLength = 0;
            }
        }

        while (offset + 64 <= bytes.length) {
            this.processBlock(bytes, offset);
            offset += 64;
        }

        if (offset < bytes.length) {
            const remainder = bytes.subarray(offset);
            this.buffer.set(remainder, 0);
            this.bufferLength = remainder.length;
        }

        return this;
    }

    digestHex() {
        this.finish();
        let output = "";
        for (const value of this.state) {
            output += value.toString(16).padStart(8, "0");
        }
        return output;
    }

    private finish() {
        if (this.finished) return;

        const messageBytes = this.bytesHashed;
        const paddingLength = this.bufferLength < 56 ? 64 - this.bufferLength : 128 - this.bufferLength;
        const padding = new Uint8Array(paddingLength);
        padding[0] = 0x80;

        const bitLength = messageBytes * 8;
        const highBits = Math.floor(bitLength / 0x100000000);
        const lowBits = bitLength >>> 0;
        const lengthOffset = padding.length - 8;
        padding[lengthOffset] = (highBits >>> 24) & 0xff;
        padding[lengthOffset + 1] = (highBits >>> 16) & 0xff;
        padding[lengthOffset + 2] = (highBits >>> 8) & 0xff;
        padding[lengthOffset + 3] = highBits & 0xff;
        padding[lengthOffset + 4] = (lowBits >>> 24) & 0xff;
        padding[lengthOffset + 5] = (lowBits >>> 16) & 0xff;
        padding[lengthOffset + 6] = (lowBits >>> 8) & 0xff;
        padding[lengthOffset + 7] = lowBits & 0xff;

        this.update(padding);
        this.finished = true;
    }

    private processBlock(bytes: Uint8Array, offset: number) {
        const words = this.words;
        for (let index = 0; index < 16; index += 1) {
            const base = offset + index * 4;
            words[index] =
                ((bytes[base] << 24) |
                    (bytes[base + 1] << 16) |
                    (bytes[base + 2] << 8) |
                    bytes[base + 3]) >>>
                0;
        }
        for (let index = 16; index < 64; index += 1) {
            const previous15 = words[index - 15];
            const previous2 = words[index - 2];
            const sigma0 =
                rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
            const sigma1 =
                rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
            words[index] =
                (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
        }

        let a = this.state[0];
        let b = this.state[1];
        let c = this.state[2];
        let d = this.state[3];
        let e = this.state[4];
        let f = this.state[5];
        let g = this.state[6];
        let h = this.state[7];

        for (let index = 0; index < 64; index += 1) {
            const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const choose = (e & f) ^ (~e & g);
            const temp1 = (h + sum1 + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
            const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (sum0 + majority) >>> 0;

            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }

        this.state[0] = (this.state[0] + a) >>> 0;
        this.state[1] = (this.state[1] + b) >>> 0;
        this.state[2] = (this.state[2] + c) >>> 0;
        this.state[3] = (this.state[3] + d) >>> 0;
        this.state[4] = (this.state[4] + e) >>> 0;
        this.state[5] = (this.state[5] + f) >>> 0;
        this.state[6] = (this.state[6] + g) >>> 0;
        this.state[7] = (this.state[7] + h) >>> 0;
    }
}

const BASE64_ALPHABET = new TextEncoder().encode(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
);

/**
 * Existing disaster-recovery manifests hash the file's base64 representation. This
 * encoder preserves that format while feeding SHA-256 in bounded chunks.
 */
export class IncrementalBase64Sha256 {
    private readonly hash = new IncrementalSha256();
    private carry = new Uint8Array(0);
    private finished = false;

    update(bytes: Uint8Array) {
        if (this.finished) {
            throw new Error("Base64 SHA-256 digest has already been finalized.");
        }
        if (bytes.length === 0) return this;

        const combined = new Uint8Array(this.carry.length + bytes.length);
        combined.set(this.carry, 0);
        combined.set(bytes, this.carry.length);
        const completeLength = combined.length - (combined.length % 3);

        if (completeLength > 0) {
            const encoded = new Uint8Array((completeLength / 3) * 4);
            let outputIndex = 0;
            for (let inputIndex = 0; inputIndex < completeLength; inputIndex += 3) {
                const chunk =
                    (combined[inputIndex] << 16) |
                    (combined[inputIndex + 1] << 8) |
                    combined[inputIndex + 2];
                encoded[outputIndex++] = BASE64_ALPHABET[(chunk >>> 18) & 0x3f];
                encoded[outputIndex++] = BASE64_ALPHABET[(chunk >>> 12) & 0x3f];
                encoded[outputIndex++] = BASE64_ALPHABET[(chunk >>> 6) & 0x3f];
                encoded[outputIndex++] = BASE64_ALPHABET[chunk & 0x3f];
            }
            this.hash.update(encoded);
        }

        this.carry = combined.slice(completeLength);
        return this;
    }

    digestHex() {
        if (!this.finished) {
            if (this.carry.length > 0) {
                const a = this.carry[0];
                const b = this.carry[1] ?? 0;
                const chunk = (a << 16) | (b << 8);
                const encoded = new Uint8Array(4);
                encoded[0] = BASE64_ALPHABET[(chunk >>> 18) & 0x3f];
                encoded[1] = BASE64_ALPHABET[(chunk >>> 12) & 0x3f];
                encoded[2] = this.carry.length === 2 ? BASE64_ALPHABET[(chunk >>> 6) & 0x3f] : 0x3d;
                encoded[3] = 0x3d;
                this.hash.update(encoded);
            }
            this.carry = new Uint8Array(0);
            this.finished = true;
        }
        return this.hash.digestHex();
    }
}

/**
 * Slice-by-16 CRC-32 tables. Identical digests to the classic byte-at-a-time table
 * loop, but processes 16 bytes per iteration — this runs over every backed-up,
 * exported, and restored byte (often more than once), so its throughput bounds how
 * long the JS thread is held between UI yields.
 */
const CRC32_TABLES = (() => {
    const tables = new Uint32Array(16 * 256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        tables[index] = value >>> 0;
    }
    for (let slice = 1; slice < 16; slice += 1) {
        for (let index = 0; index < 256; index += 1) {
            const previous = tables[(slice - 1) * 256 + index];
            tables[slice * 256 + index] =
                (tables[previous & 0xff] ^ (previous >>> 8)) >>> 0;
        }
    }
    return tables;
})();

export class IncrementalCrc32 {
    private value = 0xffffffff;

    update(bytes: Uint8Array) {
        const tables = CRC32_TABLES;
        let crc = this.value;
        let index = 0;
        const blockEnd = bytes.length - 15;

        while (index < blockEnd) {
            crc ^=
                bytes[index] |
                (bytes[index + 1] << 8) |
                (bytes[index + 2] << 16) |
                (bytes[index + 3] << 24);
            crc =
                tables[15 * 256 + (crc & 0xff)] ^
                tables[14 * 256 + ((crc >>> 8) & 0xff)] ^
                tables[13 * 256 + ((crc >>> 16) & 0xff)] ^
                tables[12 * 256 + (crc >>> 24)] ^
                tables[11 * 256 + bytes[index + 4]] ^
                tables[10 * 256 + bytes[index + 5]] ^
                tables[9 * 256 + bytes[index + 6]] ^
                tables[8 * 256 + bytes[index + 7]] ^
                tables[7 * 256 + bytes[index + 8]] ^
                tables[6 * 256 + bytes[index + 9]] ^
                tables[5 * 256 + bytes[index + 10]] ^
                tables[4 * 256 + bytes[index + 11]] ^
                tables[3 * 256 + bytes[index + 12]] ^
                tables[2 * 256 + bytes[index + 13]] ^
                tables[1 * 256 + bytes[index + 14]] ^
                tables[bytes[index + 15]];
            index += 16;
        }
        while (index < bytes.length) {
            crc = tables[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
            index += 1;
        }

        this.value = crc >>> 0;
        return this;
    }

    digest() {
        return (this.value ^ 0xffffffff) >>> 0;
    }
}
