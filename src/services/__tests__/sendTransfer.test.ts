jest.mock("../sendIdentity", () => ({
  sendIdentityHeaders: async () => ({ "x-songnook-sender": "sk_testtesttesttesttesttest" }),
}));

jest.mock("expo-file-system/legacy", () => ({
  createUploadTask: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 1 },
  FileSystemSessionType: { BACKGROUND: 0 },
}));

jest.mock("../../config/sendService", () => ({
  SEND_SERVICE_BASE_URL: "https://send.songnook.app",
}));

import * as FileSystem from "expo-file-system/legacy";
import {
  createTransfer,
  deleteTransfer,
  describeSendTransferError,
  registerAndUploadFile,
  SendTransferError,
} from "../sendTransfer";

const registered = {
  itemId: "i_01234567",
  uploadUrl: "https://r2.example/put",
  method: "PUT",
  headers: {},
};

describe("registerAndUploadFile", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => registered,
      text: async () => "",
    })) as unknown as typeof fetch;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("cancels the upload task and reports a coded failure when the ceiling passes (sweep #17)", async () => {
    const cancelAsync = jest.fn(async () => undefined);
    (FileSystem.createUploadTask as jest.Mock).mockReturnValue({
      uploadAsync: () => new Promise(() => {}), // a socket that never answers
      cancelAsync,
    });
    const pending = registerAndUploadFile(
      "t_0123456789abcdef",
      "token",
      { fileUri: "file:///tmp/a.m4a", fileName: "a.m4a", mimeType: "audio/mp4", size: 10 }
    );
    const outcome = pending.then(
      () => "resolved",
      (error: unknown) => error
    );
    await jest.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    const error = await outcome;
    expect(error).toBeInstanceOf(SendTransferError);
    expect((error as SendTransferError).code).toBe("uploadFailed");
    expect((error as SendTransferError).message).toContain("timed out");
    expect(cancelAsync).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("clears the ceiling timer once the upload lands", async () => {
    (FileSystem.createUploadTask as jest.Mock).mockReturnValue({
      uploadAsync: async () => ({ status: 200 }),
      cancelAsync: jest.fn(),
    });
    const pending = registerAndUploadFile(
      "t_0123456789abcdef",
      "token",
      { fileUri: "file:///tmp/a.m4a", fileName: "a.m4a", mimeType: "audio/mp4", size: 10 }
    );
    await jest.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toBe("i_01234567");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("explains a refusal in the app's language, with the status", () => {
    const error = new SendTransferError("file type \".opus\" is not accepted", 415, "rejected");
    expect(describeSendTransferError(error)).toBe("SongNook Send refused the request (415).");
  });
});

describe("who is sending", () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const answer = (status: number, body: unknown = {}) => {
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: status < 400, status, json: async () => body, text: async () => "" };
    }) as unknown as typeof fetch;
  };
  beforeEach(() => {
    calls.length = 0;
  });

  it("names this install when it starts a link", async () => {
    answer(201, { transferId: "t_1", uploadToken: "ut_1", expiresAt: "2026-11-08T00:00:00Z" });
    await createTransfer({ title: "Blue Hour" });
    expect((calls[0]!.init.headers as Record<string, string>)["x-songnook-sender"]).toBe("sk_testtesttesttesttesttest");
  });

  it("a spent free allowance reads as the limit, not a refusal", async () => {
    answer(402);
    await expect(createTransfer({ title: "x" })).rejects.toMatchObject({ code: "limit", status: 402 });
  });

  it("deleting a link sends its upload token, and an empty answer is success", async () => {
    answer(204);
    await expect(deleteTransfer("t_1", "ut_secret")).resolves.toBeUndefined();
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toBe("https://send.songnook.app/api/transfers/t_1");
    expect((calls[0]!.init.headers as Record<string, string>)["x-upload-token"]).toBe("ut_secret");
  });
});
