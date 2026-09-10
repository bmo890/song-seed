/**
 * Tiny module-level pub/sub for the in-app dialog system.
 * Keeps dialog state out of the main Zustand store while still
 * being callable from non-React code (actions, hooks, utils).
 */

import type { IoniconName } from "./actionIcons";

export type DialogButtonStyle = "default" | "cancel" | "destructive";

export type DialogButton = {
  label: string;
  style?: DialogButtonStyle;
  /** Icon shown alongside the label (left of it in compact mode, in a tinted
   *  circle in rich mode). Use keys from `actionIcons` for cross-app consistency. */
  icon?: IoniconName;
  /** Secondary line under the label. When present, this button renders as a
   *  full-width "option row" (icon · bold label · description) instead of a
   *  plain button — ideal for choice dialogs. */
  description?: string;
  onPress?: () => void;
};

export type DialogConfig = {
  title: string;
  message?: string;
  buttons: DialogButton[];
  /** Runs when the dialog is dismissed WITHOUT a button — scrim tap or Android back.
   *  A dialog whose cancel button carries state ("Not now" lifting a persist freeze)
   *  must pass the same handler here, or a back-press leaves that state stuck. */
  onDismiss?: () => void;
};

type Listener = (config: DialogConfig | null) => void;
type HostListener = (sheetHosts: number) => void;

let _config: DialogConfig | null = null;
const _listeners = new Set<Listener>();
// Open bottom sheets are native Modals. iOS refuses to present a second Modal
// from the root while one is up, so a dialog raised from inside a sheet would
// never appear (2026-09-10). Sheets register as hosts; while any is open the
// root host stands down and the sheet's own nested host draws the dialog.
let _sheetHosts = 0;
const _hostListeners = new Set<HostListener>();

export const dialogStore = {
  show(config: DialogConfig) {
    _config = config;
    _listeners.forEach((fn) => fn(_config));
  },

  dismiss() {
    _config = null;
    _listeners.forEach((fn) => fn(null));
  },

  subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    fn(_config); // immediately sync current state
    return () => {
      _listeners.delete(fn);
    };
  },

  /** A visible bottom sheet calls this; the returned function unregisters it. */
  registerSheetHost(): () => void {
    _sheetHosts += 1;
    _hostListeners.forEach((fn) => fn(_sheetHosts));
    return () => {
      _sheetHosts = Math.max(0, _sheetHosts - 1);
      _hostListeners.forEach((fn) => fn(_sheetHosts));
    };
  },

  subscribeSheetHosts(fn: HostListener): () => void {
    _hostListeners.add(fn);
    fn(_sheetHosts);
    return () => {
      _hostListeners.delete(fn);
    };
  },
};
