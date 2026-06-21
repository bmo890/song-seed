import { useEffect, useRef, useState } from "react";

type UndoState = {
  id: string;
  message: string;
  undo: () => void;
  onExpire?: () => void;
};

export function useCollectionSelection() {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoStateRef = useRef<UndoState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      undoStateRef.current?.onExpire?.();
      undoStateRef.current = null;
    };
  }, []);

  const clearPendingUndo = (commit: boolean) => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const pending = undoStateRef.current;
    if (commit) {
      pending?.onExpire?.();
    }
    undoStateRef.current = null;
    setUndoState(null);
  };

  const showUndo = (message: string, undo: () => void, onExpire?: () => void) => {
    clearPendingUndo(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nextUndoState = { id, message, undo, onExpire };
    undoStateRef.current = nextUndoState;
    setUndoState(nextUndoState);
    undoTimerRef.current = setTimeout(() => {
      const pending = undoStateRef.current;
      if (pending?.id === id) {
        pending.onExpire?.();
        undoStateRef.current = null;
        setUndoState(null);
      }
      undoTimerRef.current = null;
    }, 5000);
  };

  const triggerUndo = () => {
    const pending = undoStateRef.current;
    if (!pending) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    pending.undo();
    undoStateRef.current = null;
    setUndoState(null);
  };

  return {
    undoState,
    showUndo,
    triggerUndo,
    clearUndo: () => clearPendingUndo(true),
  };
}
