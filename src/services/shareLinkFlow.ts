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

export async function presentShareLink(
  create: () => Promise<SentLink>,
  copy: { emptyMessage: string }
): Promise<SentLink | null> {
  // Long duration — replaced by the success/error path below.
  toast("Creating link…", "cloud-upload-outline", { durationMs: 60_000 });
  try {
    const record = await create();
    await Clipboard.setStringAsync(record.shareUrl).catch(() => {});
    toast("Link copied — expires soon", "checkmark-outline", {
      durationMs: 4000,
      action: {
        label: "Share",
        onPress: () => {
          void Share.share({ message: record.shareUrl }).catch(() => {});
        },
      },
    });
    return record;
  } catch (err) {
    toastStore.dismiss();
    if (err instanceof EmptyShareError) {
      AppAlert.info("Nothing to share", copy.emptyMessage);
    } else if (err instanceof SendTransferError) {
      AppAlert.info("Couldn't create link", err.message);
    } else {
      AppAlert.info("Couldn't create link", "Please try again.");
    }
    return null;
  }
}
