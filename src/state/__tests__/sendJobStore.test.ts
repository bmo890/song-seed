jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("../../design/haptics", () => ({
  haptic: { success: jest.fn(), error: jest.fn(), light: jest.fn(), tap: jest.fn() },
}));
jest.mock("../../components/common/toastStore", () => ({ toast: jest.fn() }));
jest.mock("../../i18n/instance", () => ({ i18n: { t: (key: string) => key } }));
jest.mock("../../services/shareLink", () => {
  const { SendCancelledError } = jest.requireActual("../../services/sendTransfer");
  return { isSendCancelled: (err: unknown) => err instanceof SendCancelledError };
});
jest.mock("../../services/shareLinkFlow", () => ({
  describeShareLinkError: (err: unknown) => ({ title: "failed", body: String((err as Error).message) }),
}));

import * as Clipboard from "expo-clipboard";
import { useSendJobStore } from "../useSendJobStore";
import { SendCancelledError } from "../../services/sendTransfer";
import { toast } from "../../components/common/toastStore";
import { haptic } from "../../design/haptics";
import type { SendRequest } from "../useSendSheetStore";
import type { SendProgressOptions } from "../../domain/sendProgress";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function requestWith(create: SendRequest["create"], kind: SendRequest["kind"] = "sketch"): SendRequest {
  return { title: "Set", kind, emptyMessage: "nothing", create };
}
const link = {
  transferId: "t_1",
  shareUrl: "https://send.songnook.app/t/t_1",
  title: "Set",
  kind: "sketch" as const,
  createdAt: 0,
  expiresAt: 0,
  itemCount: 1,
};

beforeEach(() => {
  useSendJobStore.getState().dismiss();
  jest.clearAllMocks();
});

describe("useSendJobStore", () => {
  it("runs the seal behind a pill, reports progress, copies the link and lands on ready", async () => {
    let hooks: SendProgressOptions | undefined;
    const create = jest.fn(async (parcel: { progress?: SendProgressOptions }) => {
      hooks = parcel.progress;
      hooks?.onProgress?.({ phase: "packing", completedBytes: 1, totalBytes: 2 });
      hooks?.onProgress?.({ phase: "uploading", completedBytes: 0, totalBytes: 100 });
      return link;
    });
    useSendJobStore.getState().start(requestWith(create), { title: "Set", senderName: null, message: null });
    const running = useSendJobStore.getState().job!;
    expect(running.status).toBe("running");
    expect(running.expanded).toBe(false);
    expect(running.hasPacking).toBe(true);
    await flush();
    const done = useSendJobStore.getState().job!;
    expect(done.status).toBe("ready");
    expect(done.link?.shareUrl).toBe(link.shareUrl);
    expect(done.uploadStartedAt).not.toBeNull();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(link.shareUrl);
    expect(toast).toHaveBeenCalled();
    expect(haptic.success).toHaveBeenCalled();
  });

  it("cancel aborts the seal and clears the pill, and the late rejection changes nothing", async () => {
    let signal: AbortSignal | undefined;
    let reject: (err: unknown) => void = () => {};
    const create = jest.fn(
      (parcel: { progress?: SendProgressOptions }) =>
        new Promise<typeof link>((_, rej) => {
          signal = parcel.progress?.signal;
          reject = rej;
        })
    );
    useSendJobStore.getState().start(requestWith(create, "clips"), { title: "Clips", senderName: null, message: null });
    expect(useSendJobStore.getState().job?.hasPacking).toBe(false);
    useSendJobStore.getState().cancel();
    expect(signal?.aborted).toBe(true);
    expect(useSendJobStore.getState().job).toBeNull();
    reject(new SendCancelledError());
    await flush();
    expect(useSendJobStore.getState().job).toBeNull();
    expect(haptic.error).not.toHaveBeenCalled();
  });

  it("a failure keeps the pill with the reason, and Try again reseals the same parcel", async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new Error("Upload failed."))
      .mockResolvedValueOnce(link);
    useSendJobStore.getState().start(requestWith(create), { title: "Set", senderName: "Ben", message: "hi" });
    await flush();
    const failed = useSendJobStore.getState().job!;
    expect(failed.status).toBe("error");
    expect(failed.errorBody).toBe("Upload failed.");
    expect(haptic.error).toHaveBeenCalled();
    useSendJobStore.getState().retry();
    expect(useSendJobStore.getState().job?.status).toBe("running");
    expect(useSendJobStore.getState().job?.expanded).toBe(true);
    await flush();
    expect(useSendJobStore.getState().job?.status).toBe("ready");
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Set", senderName: "Ben", message: "hi" })
    );
  });

  it("a result for a job that was replaced is dropped", async () => {
    let resolveFirst: (value: typeof link) => void = () => {};
    const first = jest.fn(() => new Promise<typeof link>((resolve) => (resolveFirst = resolve)));
    useSendJobStore.getState().start(requestWith(first), { title: "One", senderName: null, message: null });
    useSendJobStore.getState().dismiss();
    useSendJobStore.getState().start(requestWith(jest.fn(() => new Promise<typeof link>(() => {}))), {
      title: "Two",
      senderName: null,
      message: null,
    });
    resolveFirst(link);
    await flush();
    expect(useSendJobStore.getState().job?.title).toBe("Two");
    expect(useSendJobStore.getState().job?.status).toBe("running");
  });
});
