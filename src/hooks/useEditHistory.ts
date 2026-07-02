import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Undo/redo history for an editor value. Extracted from the Lyrics Pad note
 * editor so every text editor shares the same behavior: rapid keystrokes are
 * debounced into one history entry, a pending entry is flushed before an undo
 * so the newest keystrokes aren't lost, and redo entries are discarded on the
 * next edit.
 *
 * The caller owns the value: report edits with `schedulePush()` after applying
 * them, and `apply` is invoked with the snapshot to restore on undo/redo.
 * History lives in refs (no re-render per keystroke); only canUndo/canRedo are
 * state so toolbar buttons update.
 */
export function useEditHistory<T>(
  current: T,
  apply: (snapshot: T) => void,
  options?: { debounceMs?: number; capacity?: number }
) {
  const debounceMs = options?.debounceMs ?? 400;
  const capacity = options?.capacity ?? 200;

  const historyRef = useRef<T[]>([current]);
  const indexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Always-current value so the debounced push isn't stale.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const syncState = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  const pushNow = useCallback(() => {
    const history = historyRef.current;
    // Identical snapshot (e.g. a change that was typed and deleted within one
    // debounce window) adds nothing to step back to.
    if (history[indexRef.current] === currentRef.current) {
      syncState();
      return;
    }
    history.splice(indexRef.current + 1); // typing after undo discards redo entries
    history.push(currentRef.current);
    if (history.length > capacity) history.shift();
    indexRef.current = history.length - 1;
    syncState();
  }, [capacity, syncState]);

  const schedulePush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pushNow();
    }, debounceMs);
  }, [debounceMs, pushNow]);

  const flushPending = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    pushNow();
  }, [pushNow]);

  const undo = useCallback(() => {
    flushPending();
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    const snapshot = historyRef.current[indexRef.current];
    currentRef.current = snapshot;
    apply(snapshot);
    syncState();
  }, [apply, flushPending, syncState]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    const snapshot = historyRef.current[indexRef.current];
    currentRef.current = snapshot;
    apply(snapshot);
    syncState();
  }, [apply, syncState]);

  /** Start a fresh history from `initial` — call when the edited document changes. */
  const reset = useCallback(
    (initial: T) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      historyRef.current = [initial];
      indexRef.current = 0;
      currentRef.current = initial;
      syncState();
    },
    [syncState]
  );

  return { canUndo, canRedo, schedulePush, undo, redo, reset };
}
