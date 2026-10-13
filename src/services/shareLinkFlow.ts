/**
 * UX wrapper around createShareLink: shows a progress toast, copies the finished
 * link to the clipboard, and offers a "Share" tap-through to the OS share sheet.
 * Keeps the models thin and the feedback identical across setlist/songbook/etc.
 */
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AppAlert } from "../components/common/AppAlert";
import { toast, toastStore } from "../components/common/toastStore";
import { EmptyShareError, SendTransferError, TooLargeShareError } from "./shareLink";
import type { SentLink } from "../domain/sentLinks";
import { i18n } from "../i18n/instance";

function formatLimit(bytes: number): string {
  const mb = Math.round(bytes / (1024 * 1024));
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
}

export async function presentShareLink(
  create: () => Promise<SentLink>,
  copy: { emptyMessage: string }
): Promise<SentLink | null> {
  // Lives until the success/error path replaces it: a whole workspace can take
  // minutes to pack and upload, and a progress toast that quits early reads
  // as a failure.
  toast(i18n.t("shareLink.creating"), "cloud-upload-outline", { durationMs: 30 * 60_000 });
  try {
    const record = await create();
    await Clipboard.setStringAsync(record.shareUrl).catch(() => {});
    toast(i18n.t("shareLink.copied"), "checkmark-outline", {
      durationMs: 4000,
      action: {
        label: i18n.t("shareLink.share"),
        onPress: () => {
          void Share.share({ message: record.shareUrl }).catch(() => {});
        },
      },
    });
    return record;
  } catch (err) {
    toastStore.dismiss();
    if (err instanceof EmptyShareError) {
      AppAlert.info(i18n.t("shareLink.emptyTitle"), copy.emptyMessage);
    } else if (err instanceof TooLargeShareError) {
      AppAlert.info(
        i18n.t("shareLink.tooLargeTitle"),
        i18n.t("shareLink.tooLargeBody", { limit: formatLimit(err.limitBytes) })
      );
    } else if (err instanceof SendTransferError) {
      AppAlert.info(i18n.t("shareLink.failureTitle"), err.message);
    } else {
      AppAlert.info(i18n.t("shareLink.failureTitle"), i18n.t("shareLink.retry"));
    }
    return null;
  }
}
