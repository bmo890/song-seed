jest.mock("../sendIdentity", () => ({
  sendIdentityHeaders: async () => ({}),
}));
jest.mock("expo-file-system/legacy", () => ({ cacheDirectory: "file:///cache/" }));
jest.mock("../../config/sendService", () => ({
  SEND_SERVICE_BASE_URL: "https://send.songnook.app",
  SEND_MAX_ITEM_BYTES: 1024 * 1024 * 1024,
  SEND_MAX_TRANSFER_BYTES: 1024 * 1024 * 1024,
}));
const mockEnvelope = { value: null as unknown };
jest.mock("../sendSeal", () => ({
  canOpenSealedParcels: () => true,
  openParcelEnvelope: async () => mockEnvelope.value,
  openSealedFile: jest.fn(),
}));

import { fetchTransfer, keepOpenableItems, withoutBrowserCopies, type TransferPayload } from "../receiveTransfer";
import { SendTransferError } from "../sendTransfer";
import { isSendableFile } from "../../domain/sendFormats";

/**
 * What a received parcel holds once the app has looked inside (audit
 * 2026-11-02, 12h H-1 and M-3): one odd file never refuses the whole parcel,
 * and only real browser copies are set aside.
 */

const transferId = "t_0123456789abcdef";

function sealedServerAnswer(count: number) {
  return {
    transferId,
    title: null,
    sender: { name: null, userId: null },
    message: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    expiresAt: "2026-11-08T10:00:00.000Z",
    sealed: true,
    sealedMeta: "U05TMQ",
    items: Array.from({ length: count }, (_, index) => ({
      itemId: `i_0000000${index + 1}`,
      fileName: `${index + 1}.sealed`,
      mimeType: "application/octet-stream",
      size: 100 + 31,
      downloadUrl: `https://send.songnook.app/t/${transferId}/dl/i_0000000${index + 1}`,
    })),
  };
}

function answerWith(body: unknown) {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => body, text: async () => "" })) as unknown as typeof fetch;
}

function envelope(items: Array<{ name: string; mime: string; copy?: true }>) {
  mockEnvelope.value = { v: 1, title: "Song", senderName: "Ben", message: "", items: items.map((item) => ({ size: 100, ...item })) };
}

it("a sketch with an .opus browser copy beside it opens: the copy is set aside, not the parcel refused", async () => {
  answerWith(sealedServerAnswer(2));
  envelope([
    { name: "Song.songnook", mime: "application/octet-stream" },
    { name: "Voice note.opus", mime: "audio/ogg", copy: true },
  ]);
  const transfer = await fetchTransfer(transferId, "k".repeat(43));
  expect(transfer.items.map((item) => item.fileName)).toEqual(["Song.songnook"]);
});

it("loose clips with one MIDI file: the others arrive, the MIDI is counted as left out", async () => {
  answerWith(sealedServerAnswer(3));
  envelope([
    { name: "a.m4a", mime: "audio/mp4" },
    { name: "riff.mid", mime: "audio/midi" },
    { name: "b.wav", mime: "audio/wav" },
  ]);
  const transfer = await fetchTransfer(transferId, "k".repeat(43));
  expect(transfer.items.map((item) => item.fileName)).toEqual(["a.m4a", "b.wav"]);
  expect(transfer.skippedItems).toBe(1);
});

it("a parcel of nothing openable is refused with a final reason", async () => {
  answerWith(sealedServerAnswer(1));
  envelope([{ name: "riff.mid", mime: "audio/midi" }]);
  await expect(fetchTransfer(transferId, "k".repeat(43))).rejects.toMatchObject({ code: "unsupportedItem" });
});

describe("withoutBrowserCopies", () => {
  const item = (fileName: string, browserCopy?: boolean) => ({
    itemId: "i_00000001",
    fileName,
    size: 1,
    mimeType: fileName.endsWith(".songnook") ? "application/octet-stream" : "audio/mp4",
    downloadUrl: "",
    ...(browserCopy ? { browserCopy } : null),
  });
  const parcel = (items: TransferPayload["items"]): TransferPayload => ({
    transferId,
    title: null,
    sender: { name: null, userId: null },
    message: null,
    kind: "clips",
    createdAt: "",
    expiresAt: "",
    items,
  });

  it("a web parcel of a package plus three real bounces keeps all four (12h M-3)", () => {
    // Since 2026-11-02 the app marks its copies; anything unmarked beside a
    // marked copy is the sender's own file.
    const out = withoutBrowserCopies(parcel([item("Set.songnook"), item("Copy.m4a", true), item("New 1.m4a"), item("New 2.m4a")]));
    expect(out.items.map((i) => i.fileName)).toEqual(["Set.songnook", "New 1.m4a", "New 2.m4a"]);
  });

  it("an older unmarked app parcel still takes the package alone", () => {
    const out = withoutBrowserCopies(parcel([item("Set.songnook"), item("Take.m4a")]));
    expect(out.items.map((i) => i.fileName)).toEqual(["Set.songnook"]);
  });

  it("keepOpenableItems leaves the parcel alone when everything opens", () => {
    const p = parcel([item("a.m4a")]);
    expect(keepOpenableItems(p)).toBe(p);
  });
});

describe("one list for every end", () => {
  it.each([
    ["take.m4a", "audio/mp4", true],
    ["take.wav", "application/octet-stream", true],
    ["Set.songnook", "application/octet-stream", true],
    ["Set.songnook", "audio/mp4", false],
    ["note.opus", "audio/ogg", false],
    ["memo.wma", "audio/x-ms-wma", false],
    ["riff.mid", "audio/midi", false],
    ["voice.mp4", "audio/mp4", false],
    ["take.m4a", "video/mp4", false],
  ])("%s (%s) → %s", (name, mime, ok) => {
    expect(isSendableFile(name, mime)).toBe(ok);
  });

  it("refusals stay coded", () => {
    expect(() => keepOpenableItems({ ...({} as TransferPayload), items: [{ itemId: "i", fileName: "x.mid", mimeType: "audio/midi", size: 1, downloadUrl: "" }] })).toThrow(SendTransferError);
  });
});
