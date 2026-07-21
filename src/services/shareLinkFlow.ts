/**
 * UX wrapper around createShareLink: shows a progress toast, copies the finished
 * link to the clipboard, and offers a "Share" tap-through to the OS share sheet.
 * Keeps the models thin and the feedback identical across setlist/songbook/etc.
 */
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AppAlert } from "../components/common/AppAlert";
import { toast, toastStore } from "../components/common/toastStore";
import { EmptyShareError, SendTransferError } from "./shareLink";
import type { SentLink } from "../domain/sentLinks";
import { i18n } from "../i18n/instance";

export async function presentShareLink(
  create: () => Promise<SentLink>,
  copy: { emptyMessage: string }
): Promise<SentLink | null> {
  // Long duration — replaced by the success/error path below.
  toast(i18n.t("shareLink.creating"), "cloud-upload-outline", { durationMs: 60_000 });
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
    } else if (err instanceof SendTransferError) {
      AppAlert.info(i18n.t("shareLink.failureTitle"), err.message);
    } else {
      AppAlert.info(i18n.t("shareLink.failureTitle"), i18n.t("shareLink.retry"));
    }
    return null;
  }
}
