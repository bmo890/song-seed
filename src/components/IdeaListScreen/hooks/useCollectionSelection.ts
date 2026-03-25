import { useEffect, useRef, useState } from "react";

export function useCollectionSelection() {
  const [undoState, setUndoState] = useState<{
    id: string;
    message: string;
    undo: () => void;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const showUndo = (message: string, undo: () => void) => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUndoState({ id, message, undo });
    undoTimerRef.current = setTimeout(() => {
      setUndoState((prev) => (prev?.id === id ? null : prev));
      undoTimerRef.current = null;
    }, 5000);
  };

  const triggerUndo = () => {
    if (!undoState) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    undoState.undo();
    setUndoState(null);
  };

  return {
    undoState,
    showUndo,
    triggerUndo,
    clearUndo: () => setUndoState(null),
  };
}
