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

import * as FileSystem from "expo-file-system/legacy";
import {
  downloadTransferItem,
  isArchiveItem,
  normalizeTransferKind,
  parseTransferUrl,
  validateTransferPayload,
} from "../receiveTransfer";
import { describeSendTransferError, SendCancelledError, SendTransferError } from "../sendTransfer";

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

  it("codes every refusal so the alert is translated and the message stays for the log", () => {
    const unsupported = () =>
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
      );
    expect(unsupported).toThrow(SendTransferError);
    try {
      unsupported();
    } catch (error) {
      expect((error as SendTransferError).code).toBe("unsupportedItem");
      expect((error as SendTransferError).message).toContain("invoice.pdf");
      expect(describeSendTransferError(error as SendTransferError)).not.toContain("invoice.pdf");
    }
    try {
      validateTransferPayload(payload({ items: [] }), transferId);
    } catch (error) {
      expect((error as SendTransferError).code).toBe("invalidTransfer");
    }
  });
});

describe("isArchiveItem", () => {
  it("recognises .songnook only — the service never registers a .zip", () => {
    const item = (fileName: string) => ({ ...payload().items[0]!, fileName });
    expect(isArchiveItem(item("Parcel.songnook"))).toBe(true);
    expect(isArchiveItem(item("Parcel.SONGNOOK"))).toBe(true);
    expect(isArchiveItem(item("parcel.zip"))).toBe(false);
    expect(isArchiveItem(item("bass.m4a"))).toBe(false);
  });
});

describe("downloadTransferItem", () => {
  it("cancels the download in flight when the signal aborts", async () => {
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    let settle: (value: undefined) => void = () => {};
    const cancelAsync = jest.fn(async () => settle(undefined));
    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({
      downloadAsync: () => new Promise<undefined>((resolve) => (settle = resolve)),
      cancelAsync,
    });
    const controller = new AbortController();
    const pending = downloadTransferItem(payload().items[0]!, undefined, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(SendCancelledError);
    expect(cancelAsync).toHaveBeenCalledTimes(1);
  });

  it("refuses to start once the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      downloadTransferItem(payload().items[0]!, undefined, { signal: controller.signal })
    ).rejects.toBeInstanceOf(SendCancelledError);
  });
});

describe("transfer kind", () => {
  it("accepts every ShareKind the app can send, and reads anything else as clips", () => {
    for (const kind of ["setlist", "playlist", "songbook", "sketch", "collection", "workspace", "clips", "library"]) {
      expect(validateTransferPayload(payload({ kind }), transferId).kind).toBe(kind);
    }
    // Older parcels carry no kind; a web sender can't declare a package kind.
    expect(validateTransferPayload(payload(), transferId).kind).toBe("clips");
    expect(normalizeTransferKind("stems")).toBe("clips");
    expect(normalizeTransferKind(7)).toBe("clips");
  });
});
