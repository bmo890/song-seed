import type { IoniconName } from "./actionIcons";

/**
 * Tiny module-level pub/sub for quiet, non-blocking confirmations ("Saved",
 * "Added to playlist", "Copied") — the gap between AppDialog (blocking, for
 * decisions/errors) and silence. Mirrors dialogStore so it's callable from
 * non-React code (actions, hooks, services).
 *
 * One toast at a time: a new show() replaces the current one (no queue — quiet
 * confirmations are ephemeral; if two race, the newest is the one that matters).
 */

export type ToastConfig = {
  message: string;
  icon?: IoniconName;
  /** Auto-dismiss delay. Default 2000ms. */
  durationMs?: number;
};

type ActiveToast = ToastConfig & { id: number };

type Listener = (toast: ActiveToast | null) => void;

let _toast: ActiveToast | null = null;
let _listener: Listener | null = null;
let _nextId = 1;

export const toastStore = {
  show(config: ToastConfig) {
    _toast = { ...config, id: _nextId++ };
    _listener?.(_toast);
  },
  dismiss() {
    _toast = null;
    _listener?.(null);
  },
  /** Drop the current toast WITHOUT notifying — the host calls this once its own
   *  auto-hide animation has finished, so a later re-subscribe can't replay a stale one. */
  clear() {
    _toast = null;
  },
  subscribe(listener: Listener) {
    _listener = listener;
    listener(_toast);
    return () => {
      if (_listener === listener) _listener = null;
    };
  },
};

/** Convenience: `toast("Saved", "checkmark-outline")`. */
export function toast(message: string, icon?: IoniconName, durationMs?: number) {
  toastStore.show({ message, icon, durationMs });
}
