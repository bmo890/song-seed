import { Platform } from "react-native";

/**
 * iOS presents one Modal at a time from a view controller. Anything presented while a
 * sheet or dialog is still on screen, or still sliding out (another sheet, the system
 * share sheet, a file or photo picker), is silently refused, and the screen can stop
 * taking touches (2026-10-18, the frozen recorder). Close the overlay first, then await
 * this before presenting the next thing. Android presents each in its own window and
 * needs no wait.
 */
const IOS_OVERLAY_DISMISS_SETTLE_MS = 400;

export function afterOverlayCloses(): Promise<void> {
  if (Platform.OS !== "ios") return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, IOS_OVERLAY_DISMISS_SETTLE_MS));
}
