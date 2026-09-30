import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { createDraftCommitter } from "../domain/draftCommitter";

const DEFAULT_IDLE_MS = 500;

/**
 * A text field that commits on a pause, not on every keystroke.
 *
 * Writing straight into the library store per character cost a full store
 * notify (every mounted selector), the persist scheduler, the manifest and —
 * for the chart — an activity event and an undo step per letter (2026-09-30).
 * The field keeps its own draft; `commit` runs after `idleMs` of quiet, and
 * always on unmount and when the app leaves the foreground, so a kill loses
 * at most the last half-second of typing. Callers flush before anything that
 * reads the committed value (back, a word-tool apply).
 *
 * The draft re-seeds from `value` whenever the source changes while nothing
 * is pending (undo/redo, switching records), so outside edits still show. The
 * commit captured at typing time is the one that runs, so a draft never lands
 * on a record the user switched to afterwards.
 */
export function useDraftText(
  value: string,
  commit: (next: string) => void,
  options?: { idleMs?: number }
): { draft: string; onChangeText: (next: string) => void; flush: () => void } {
  const idleMs = options?.idleMs ?? DEFAULT_IDLE_MS;
  const [draft, setDraft] = useState(value);
  const committerRef = useRef(
    createDraftCommitter(value, (flush) => {
      const timer = setTimeout(flush, idleMs);
      return () => clearTimeout(timer);
    })
  );
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const flush = useCallback(() => committerRef.current.flush(), []);

  const onChangeText = useCallback((next: string) => {
    committerRef.current.change(next, commitRef.current);
    setDraft(next);
  }, []);

  useEffect(() => {
    if (committerRef.current.seed(value)) setDraft(value);
  }, [value]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  return { draft, onChangeText, flush };
}
