import { createFilesShareLink, createShareLink, EmptyShareError, TooLargeShareError } from "../shareLink";
import * as transport from "../sendTransfer";
import * as libraryExport from "../libraryExport";
import { useSentLinksStore } from "../../state/useSentLinksStore";

jest.mock("../sendTransfer", () => ({
  __esModule: true,
  SendTransferError: class extends Error {},
  SendCancelledError: class extends Error {},
  throwIfSendCancelled: (signal?: AbortSignal) => {
    if (signal?.aborted) throw new Error("cancelled");
  },
  createTransfer: jest.fn(),
  registerAndUploadFile: jest.fn(),
  finalizeTransfer: jest.fn(),
  fileSize: jest.fn(),
}));
jest.mock("../linkAudioEncoder", () => ({
  __esModule: true,
  encodeAudioForLink: jest.fn(async () => ({ encoded: new Map(), tempUris: [] })),
  deleteEncodedAudio: jest.fn(async () => undefined),
}));
jest.mock("../libraryExport", () => ({
  __esModule: true,
  prepareLibraryExportArchive: jest.fn(),
}));
jest.mock("../../state/useSentLinksStore", () => ({
  __esModule: true,
  useSentLinksStore: { getState: jest.fn() },
}));

const mocked = {
  createTransfer: transport.createTransfer as jest.Mock,
  registerAndUploadFile: transport.registerAndUploadFile as jest.Mock,
  finalizeTransfer: transport.finalizeTransfer as jest.Mock,
  fileSize: transport.fileSize as jest.Mock,
  prepare: libraryExport.prepareLibraryExportArchive as jest.Mock,
  getState: useSentLinksStore.getState as jest.Mock,
};

const fakeArgs = { format: "songnook-archive" } as unknown as libraryExport.ExportLibraryArgs;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.createTransfer.mockResolvedValue({
    transferId: "t_ABC",
    uploadToken: "ut_SECRET",
    expiresAt: "2026-08-01T00:00:00.000Z",
  });
  mocked.prepare.mockResolvedValue({
    archiveUri: "file:///share/Set.songnook",
    archiveTitle: "Set",
    archiveExtension: "songnook",
  });
  mocked.fileSize.mockResolvedValue(4242);
  mocked.registerAndUploadFile.mockResolvedValue("i_1");
  mocked.finalizeTransfer.mockResolvedValue({ shareUrl: "https://send.songnook.app/t/t_ABC" });
});

describe("createShareLink", () => {
  it("stamps the transferId into the archive BEFORE upload, then finalizes and records", async () => {
    const recordLink = jest.fn();
    mocked.getState.mockReturnValue({ recordLink });

    const buildArgs = jest.fn().mockReturnValue(fakeArgs);
    const record = await createShareLink({
      title: "Set",
      kind: "setlist",
      entityId: "setlist-9",
      senderName: "Ben",
      buildArgs,
    });

    // transferId is known at create and handed to the archive builder.
    // The declared kind rides on the wire too, so the recipient page and the
    // receive screen can name the parcel before any file is opened.
    expect(mocked.createTransfer).toHaveBeenCalledWith({
      title: "Set",
      senderName: "Ben",
      message: undefined,
      kind: "setlist",
    });
    expect(buildArgs).toHaveBeenCalledWith("t_ABC");

    // Ordering: build args → prepare → upload → finalize.
    const buildOrder = buildArgs.mock.invocationCallOrder[0];
    const prepareOrder = mocked.prepare.mock.invocationCallOrder[0];
    const uploadOrder = mocked.registerAndUploadFile.mock.invocationCallOrder[0];
    const finalizeOrder = mocked.finalizeTransfer.mock.invocationCallOrder[0];
    expect(buildOrder).toBeLessThan(prepareOrder);
    expect(prepareOrder).toBeLessThan(uploadOrder);
    expect(uploadOrder).toBeLessThan(finalizeOrder);

    // Uploads the prepared archive as an opaque .songnook file.
    expect(mocked.registerAndUploadFile).toHaveBeenCalledWith(
      "t_ABC",
      "ut_SECRET",
      {
        fileUri: "file:///share/Set.songnook",
        fileName: "Set.songnook",
        mimeType: "application/octet-stream",
        size: 4242,
      },
      expect.objectContaining({ onProgress: expect.any(Function) })
    );

    // Records the finished link.
    expect(recordLink).toHaveBeenCalledTimes(1);
    expect(record.shareUrl).toBe("https://send.songnook.app/t/t_ABC");
    expect(record.transferId).toBe("t_ABC");
    expect(record.expiresAt).toBe(Date.parse("2026-08-01T00:00:00.000Z"));
    expect(record.entityId).toBe("setlist-9");
  });

  it("throws EmptyShareError and never uploads when there is nothing to build", async () => {
    mocked.getState.mockReturnValue({ recordLink: jest.fn() });
    const buildArgs = jest.fn().mockReturnValue(null);

    await expect(
      createShareLink({ title: "Empty", kind: "setlist", buildArgs })
    ).rejects.toBeInstanceOf(EmptyShareError);

    expect(mocked.prepare).not.toHaveBeenCalled();
    expect(mocked.registerAndUploadFile).not.toHaveBeenCalled();
    expect(mocked.finalizeTransfer).not.toHaveBeenCalled();
  });

  it("refuses an archive past the per-file cap before any byte is uploaded", async () => {
    mocked.getState.mockReturnValue({ recordLink: jest.fn() });
    mocked.fileSize.mockResolvedValue(1200 * 1024 * 1024); // a workspace of stems, past the 1 GB file line

    await expect(
      createShareLink({ title: "Big", kind: "workspace", buildArgs: () => fakeArgs })
    ).rejects.toBeInstanceOf(TooLargeShareError);

    // The draft is left unfinalized (swept at expiry); nothing was uploaded.
    expect(mocked.registerAndUploadFile).not.toHaveBeenCalled();
    expect(mocked.finalizeTransfer).not.toHaveBeenCalled();
  });
});

describe("createFilesShareLink", () => {
  it("checks sizes before creating the transfer, and refuses a parcel past the total cap", async () => {
    mocked.getState.mockReturnValue({ recordLink: jest.fn() });
    mocked.fileSize.mockResolvedValue(400 * 1024 * 1024); // three of these pass the 1 GB line

    await expect(
      createFilesShareLink({
        title: "Stems",
        kind: "clips",
        files: [1, 2, 3].map((n) => ({ fileUri: `file:///c/${n}.wav`, fileName: `${n}.wav`, mimeType: "audio/wav" })),
      })
    ).rejects.toBeInstanceOf(TooLargeShareError);

    expect(mocked.createTransfer).not.toHaveBeenCalled();
    expect(mocked.registerAndUploadFile).not.toHaveBeenCalled();
  });

  it("uploads every file with its measured size and the declared kind", async () => {
    const recordLink = jest.fn();
    mocked.getState.mockReturnValue({ recordLink });
    mocked.fileSize.mockResolvedValueOnce(10).mockResolvedValueOnce(20);

    const record = await createFilesShareLink({
      title: "Two takes",
      kind: "clips",
      files: [
        { fileUri: "file:///c/a.wav", fileName: "a.wav", mimeType: "audio/wav" },
        { fileUri: "file:///c/b.wav", fileName: "b.wav", mimeType: "audio/wav" },
      ],
    });

    expect(mocked.createTransfer).toHaveBeenCalledWith(expect.objectContaining({ kind: "clips" }));
    expect(mocked.registerAndUploadFile).toHaveBeenNthCalledWith(1, "t_ABC", "ut_SECRET", expect.objectContaining({ fileName: "a.wav", size: 10 }), expect.anything());
    expect(mocked.registerAndUploadFile).toHaveBeenNthCalledWith(2, "t_ABC", "ut_SECRET", expect.objectContaining({ fileName: "b.wav", size: 20 }), expect.anything());
    expect(record.itemCount).toBe(2);
    expect(recordLink).toHaveBeenCalledTimes(1);
  });
});
