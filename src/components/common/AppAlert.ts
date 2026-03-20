import { Alert } from "react-native";

type ConfirmOpts = { confirmLabel?: string; cancelLabel?: string };
type DestructiveOpts = { confirmLabel?: string; cancelLabel?: string };

/**
 * Reusable alert helpers with consistent button ordering.
 * Use these instead of raw Alert.alert() so dialogs can be
 * redesigned from a single place in the future.
 */
export const AppAlert = {
  /** Yes/No confirmation — confirm button on right. */
  confirm(title: string, message: string, onConfirm: () => void, opts?: ConfirmOpts): void {
    Alert.alert(title, message, [
      { text: opts?.cancelLabel ?? "Cancel", style: "cancel" },
      { text: opts?.confirmLabel ?? "Confirm", onPress: onConfirm },
    ]);
  },

  /** Destructive action — red destructive button on right. */
  destructive(title: string, message: string, onConfirm: () => void, opts?: DestructiveOpts): void {
    Alert.alert(title, message, [
      { text: opts?.cancelLabel ?? "Cancel", style: "cancel" },
      { text: opts?.confirmLabel ?? "Delete", style: "destructive", onPress: onConfirm },
    ]);
  },

  /** Info / error — single dismiss button. */
  info(title: string, message?: string): void {
    Alert.alert(title, message, [{ text: "OK" }]);
  },
};
