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
};

type Listener = (config: DialogConfig | null) => void;

let _config: DialogConfig | null = null;
let _listener: Listener | null = null;

export const dialogStore = {
  show(config: DialogConfig) {
    _config = config;
    _listener?.(_config);
  },

  dismiss() {
    _config = null;
    _listener?.(null);
  },

  subscribe(fn: Listener): () => void {
    _listener = fn;
    fn(_config); // immediately sync current state
    return () => {
      if (_listener === fn) _listener = null;
    };
  },
};
