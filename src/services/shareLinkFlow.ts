/**
 * How a failed SongNook Send attempt is explained — one place, so every entry
 * point (the Send sheet today) says the same thing for the same failure.
 */
import { EmptyShareError, SendTransferError, TooLargeShareError } from "./shareLink";
import { describeSendTransferError } from "./sendTransfer";
import { i18n } from "../i18n/instance";

export function formatByteLimit(bytes: number): string {
  const mb = Math.round(bytes / (1024 * 1024));
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
}

export function describeShareLinkError(
  err: unknown,
  copy: { emptyMessage: string }
): { title: string; body: string } {
  if (err instanceof EmptyShareError) {
    return { title: i18n.t("shareLink.emptyTitle"), body: copy.emptyMessage };
  }
  if (err instanceof TooLargeShareError) {
    return {
      title: i18n.t("shareLink.tooLargeTitle"),
      body: i18n.t("shareLink.tooLargeBody", { limit: formatByteLimit(err.limitBytes) }),
    };
  }
  if (err instanceof SendTransferError) {
    // The code is translated; the raw message (often a server body) is for the log.
    console.warn("[send] transfer failed", err.message);
    return { title: i18n.t("shareLink.failureTitle"), body: describeSendTransferError(err) };
  }
  return { title: i18n.t("shareLink.failureTitle"), body: i18n.t("shareLink.retry") };
}
