import { createShareLink, EmptyShareError } from "../shareLink";
import * as transport from "../sendTransfer";
import * as libraryExport from "../libraryExport";
import { useSentLinksStore } from "../../state/useSentLinksStore";

jest.mock("../sendTransfer", () => ({
  __esModule: true,
  SendTransferError: class extends Error {},
  createTransfer: jest.fn(),
  registerAndUploadFile: jest.fn(),
  finalizeTransfer: jest.fn(),
  fileSize: jest.fn(),
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

const fakeArgs = { format: "songstead-archive" } as unknown as libraryExport.ExportLibraryArgs;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.createTransfer.mockResolvedValue({
    transferId: "t_ABC",
    uploadToken: "ut_SECRET",
    expiresAt: "2026-08-01T00:00:00.000Z",
  });
  mocked.prepare.mockResolvedValue({
    archiveUri: "file:///share/Set.songstead",
    archiveTitle: "Set",
    archiveExtension: "songstead",
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
    expect(mocked.createTransfer).toHaveBeenCalledWith({
      title: "Set",
      senderName: "Ben",
      message: undefined,
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

    // Uploads the prepared archive as an opaque .songstead file.
    expect(mocked.registerAndUploadFile).toHaveBeenCalledWith(
      "t_ABC",
      "ut_SECRET",
      {
        fileUri: "file:///share/Set.songstead",
        fileName: "Set.songstead",
        mimeType: "application/octet-stream",
        size: 4242,
      }
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
});
