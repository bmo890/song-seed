import { createHash } from "crypto";

const mockFiles = new Map<string, Uint8Array>();
const mockReadAsStringAsync = jest.fn(async (uri: string, options?: { encoding?: string }) => {
    const file = mockFiles.get(uri);
    if (!file) throw new Error(`Missing mock file: ${uri}`);
    if (options?.encoding !== "base64") throw new Error("Expected a base64 read.");
    return Buffer.from(file).toString("base64");
});
const mockDigestStringAsync = jest.fn(async (_algorithm: string, value: string) =>
    createHash("sha256").update(value).digest("hex")
);

jest.mock("expo-file-system/legacy", () => ({
    EncodingType: { Base64: "base64", UTF8: "utf8" },
    readAsStringAsync: (uri: string, options?: { encoding?: string }) =>
        mockReadAsStringAsync(uri, options),
}));

jest.mock("expo-file-system", () => {
    class MockFile {
        uri: string;

        constructor(uri: string) {
            this.uri = uri;
        }

        open() {
            const uri = this.uri;
            let offset = 0;
            return {
                readBytes: (length: number) => {
                    const source = mockFiles.get(uri);
                    if (!source) throw new Error(`Missing mock file: ${uri}`);
                    const chunk = source.slice(offset, offset + length);
                    offset += chunk.length;
                    return chunk;
                },
                close: () => {},
            };
        }
    }
    return { File: MockFile };
});

jest.mock("expo-crypto", () => ({
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digestStringAsync: (algorithm: string, value: string) =>
        mockDigestStringAsync(algorithm, value),
}));

import { sha256OfFileBase64 } from "../fileHashing";

const URI = "file:///doc/songnook/audio/clip.m4a";

function expectedV1Digest(bytes: Uint8Array) {
    return createHash("sha256").update(Buffer.from(bytes).toString("base64")).digest("hex");
}

beforeEach(() => {
    mockFiles.clear();
    mockReadAsStringAsync.mockClear();
    mockDigestStringAsync.mockClear();
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
});

describe("sha256OfFileBase64", () => {
    it("produces the v1 manifest digest via the native fast path", async () => {
        const bytes = Uint8Array.from({ length: 100 * 1024 + 3 }, (_, index) => (index * 31 + 7) & 0xff);
        mockFiles.set(URI, bytes);

        await expect(sha256OfFileBase64(URI, bytes.length)).resolves.toBe(expectedV1Digest(bytes));
        expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
    });

    it("falls back to the bounded-memory streaming hash above the native cap", async () => {
        const bytes = Uint8Array.from({ length: 3 * 1024 + 1 }, (_, index) => (index * 13 + 5) & 0xff);
        mockFiles.set(URI, bytes);

        await expect(sha256OfFileBase64(URI, bytes.length, undefined, 1024)).resolves.toBe(
            expectedV1Digest(bytes)
        );
        expect(mockReadAsStringAsync).not.toHaveBeenCalled();
        expect(mockDigestStringAsync).not.toHaveBeenCalled();
    });

    it("both paths agree on the same content", async () => {
        const bytes = Uint8Array.from({ length: 7777 }, (_, index) => (index * 101 + 3) & 0xff);
        mockFiles.set(URI, bytes);

        const native = await sha256OfFileBase64(URI, bytes.length);
        const streamed = await sha256OfFileBase64(URI, bytes.length, undefined, 16);
        expect(native).toBe(streamed);
        expect(native).toBe(expectedV1Digest(bytes));
    });

    it("honors cancellation before reading", async () => {
        const controller = new AbortController();
        controller.abort();
        mockFiles.set(URI, Uint8Array.from([1, 2, 3]));

        await expect(
            sha256OfFileBase64(URI, 3, { signal: controller.signal })
        ).rejects.toThrow("cancelled");
    });
});
