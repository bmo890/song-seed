import { dialogStore, type DialogButton } from "./dialogStore";
import { actionIcons, type IoniconName } from "./actionIcons";

type ConfirmOpts = { confirmLabel?: string; cancelLabel?: string; icon?: IoniconName };
type DestructiveOpts = { confirmLabel?: string; cancelLabel?: string; icon?: IoniconName };

/**
 * App-wide alert helpers. Route through the styled in-app AppDialog
 * instead of the native Alert.alert, so every dialog matches the
 * Nocturne Paper design system and carries a relevant action icon.
 *
 * Use these instead of raw Alert.alert() everywhere.
 */
export const AppAlert = {
  /** Yes/No confirmation — confirm button on right, with a checkmark by default. */
  confirm(title: string, message: string, onConfirm: () => void, opts?: ConfirmOpts): void {
    dialogStore.show({
      title,
      message,
      buttons: [
        { label: opts?.cancelLabel ?? "Cancel", style: "cancel" },
        {
          label: opts?.confirmLabel ?? "Confirm",
          style: "default",
          icon: opts?.icon ?? actionIcons.confirm,
          onPress: onConfirm,
        },
      ],
    });
  },

  /** Destructive action — red button, trash icon by default. */
  destructive(title: string, message: string, onConfirm: () => void, opts?: DestructiveOpts): void {
    dialogStore.show({
      title,
      message,
      buttons: [
        { label: opts?.cancelLabel ?? "Cancel", style: "cancel" },
        {
          label: opts?.confirmLabel ?? "Delete",
          style: "destructive",
          icon: opts?.icon ?? actionIcons.delete,
          onPress: onConfirm,
        },
      ],
    });
  },

  /** Info / error — single dismiss button. */
  info(title: string, message?: string): void {
    dialogStore.show({
      title,
      message,
      buttons: [{ label: "OK", style: "default" }],
    });
  },

  /** Fully custom button set (icons / descriptions supported). */
  custom(title: string, message: string | undefined, buttons: DialogButton[]): void {
    dialogStore.show({ title, message, buttons });
  },
};
