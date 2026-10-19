import type { SelectionAction } from "./SelectionDock";

/**
 * The app's one action menu, callable from anywhere (2026-10-15): an item's
 * "…" (Shelf, Revisit, Activity, the player) opens the same bottom sheet the
 * selection docks use, instead of a centred dialog. Dialogs are for a
 * question with an answer; a list of things to do is a sheet.
 * `ActionMenuHost` (SelectionActionSheet.tsx) draws it; mount it once near the
 * root, beside AppDialogHost.
 */
export type ActionMenuConfig = {
  /** What the menu acts on, named the way the card names it. */
  title: string;
  titleContext?: string;
  actions: SelectionAction[];
  /** Closed without a choice (swipe, scrim). Runs after any chosen row's
   *  onPress, so a caller awaiting an answer gets the choice, not the close. */
  onDismiss?: () => void;
};

type Listener = (config: ActionMenuConfig | null) => void;
let _config: ActionMenuConfig | null = null;
const _listeners = new Set<Listener>();

export const actionMenuStore = {
  show(config: ActionMenuConfig) {
    _config = config;
    _listeners.forEach((fn) => fn(_config));
  },
  dismiss() {
    _config = null;
    _listeners.forEach((fn) => fn(null));
  },
  subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    fn(_config);
    return () => {
      _listeners.delete(fn);
    };
  },
};
