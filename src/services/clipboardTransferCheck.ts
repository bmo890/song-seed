/**
 * iOS deferred deep link, v1: a user who tapped a Songnook Send link before
 * installing has the URL on their pasteboard (the web page copies it — as
 * PLAIN TEXT via navigator.clipboard.writeText, so we must read the string
 * pasteboard; UIPasteboard's url slot stays empty for it). On launch we check
 * ONCE EVER and OFFER to open — never silent: reading the pasteboard shows
 * iOS's paste banner, and navigation goes through a user-visible confirm.
 *
 * One-shot by design: the deferred-deep-link case is precisely the first
 * launch after install. A persisted flag keeps the paste banner from firing on
 * every subsequent launch, and declining can never turn into a recurring nag.
 * Android's half (Install Referrer) needs a native module — deferred.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { parseTransferUrl } from "./receiveTransfer";
import { useStore } from "../state/useStore";
import { useSentLinksStore } from "../state/useSentLinksStore";

const CHECKED_FLAG_KEY = "songstead-send-clipboard-checked";

/** Returns a transferId worth offering to open, or null. Runs at most once per
 *  install; filters out transfers we already have and links this device itself
 *  created. */
export async function checkClipboardForTransfer(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;

  try {
    if (await AsyncStorage.getItem(CHECKED_FLAG_KEY)) return null;
    // The check is spent whether or not we find anything — first launch is the
    // only moment a pre-install link can be waiting.
    await AsyncStorage.setItem(CHECKED_FLAG_KEY, "1");

    // hasStringAsync answers without triggering the paste banner; only a
    // non-empty pasteboard pays the banner cost of the actual read.
    if (!(await Clipboard.hasStringAsync())) return null;
    const text = await Clipboard.getStringAsync();
    const transferId = parseTransferUrl(text);
    if (!transferId) return null;

    // Already saved → nothing to offer.
    const alreadyReceived = useStore
      .getState()
      .workspaces.some((workspace) => workspace.received?.transferId === transferId);
    if (alreadyReceived) return null;

    // Our own outgoing link (just created/copied to share) — don't offer to
    // "receive" it back.
    const isOwnLink = useSentLinksStore
      .getState()
      .links.some((link) => link.transferId === transferId);
    if (isOwnLink) return null;

    return transferId;
  } catch {
    // Pasteboard/storage access can fail — never let the check interfere with
    // launch.
    return null;
  }
}
