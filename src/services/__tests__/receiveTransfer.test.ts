jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  makeDirectoryAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

jest.mock("../../config/sendService", () => ({
  SEND_SERVICE_BASE_URL: "https://send.songnook.app",
}));

import { parseTransferUrl, validateTransferPayload } from "../receiveTransfer";

const transferId = "t_0123456789abcdef";
const itemId = "i_01234567";

const payload = (overrides: Record<string, unknown> = {}) => ({
  transferId,
  title: "Stems",
  sender: { name: "Ben", userId: null },
  message: "Track two first",
  createdAt: "2026-07-19T10:00:00.000Z",
  expiresAt: "2026-07-26T10:00:00.000Z",
  items: [
    {
      itemId,
      fileName: "bass.m4a",
      size: 1234,
      mimeType: "audio/mp4",
      downloadUrl: `https://send.songnook.app/t/${transferId}/dl/${itemId}`,
    },
  ],
  ...overrides,
});

describe("parseTransferUrl", () => {
  it("accepts raw ids, trusted https links, and app-scheme links", () => {
    expect(parseTransferUrl(transferId)).toBe(transferId);
    expect(parseTransferUrl(`https://send.songnook.app/t/${transferId}`)).toBe(transferId);
    expect(parseTransferUrl(`songnook://t/${transferId}`)).toBe(transferId);
  });

  it("rejects lookalike hosts", () => {
    expect(parseTransferUrl(`https://evil.example/t/${transferId}`)).toBeNull();
    expect(parseTransferUrl(`https://send.songnook.app.evil.example/t/${transferId}`)).toBeNull();
  });
});

describe("validateTransferPayload", () => {
  it("accepts a valid service payload", () => {
    const parsed = validateTransferPayload(payload(), transferId);
    expect(parsed.transferId).toBe(transferId);
    expect(parsed.items[0]?.fileName).toBe("bass.m4a");
  });

  it("rejects unexpected download hosts", () => {
    expect(() =>
      validateTransferPayload(
        payload({
          items: [
            {
              itemId,
              fileName: "bass.m4a",
              size: 1234,
              mimeType: "audio/mp4",
              downloadUrl: `https://evil.example/t/${transferId}/dl/${itemId}`,
            },
          ],
        }),
        transferId
      )
    ).toThrow("unexpected download host");
  });

  it("rejects unsupported item types", () => {
    expect(() =>
      validateTransferPayload(
        payload({
          items: [
            {
              itemId,
              fileName: "invoice.pdf",
              size: 1234,
              mimeType: "application/pdf",
              downloadUrl: `https://send.songnook.app/t/${transferId}/dl/${itemId}`,
            },
          ],
        }),
        transferId
      )
    ).toThrow("not supported");
  });
});
