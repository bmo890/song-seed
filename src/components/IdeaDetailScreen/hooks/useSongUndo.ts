import { useEffect, useRef, useState } from "react";

type UndoState = {
  id: string;
  message: string;
  undo: () => void;
};

type UseSongUndoParams = {
  floatingBaseBottom: number;
  isProject: boolean;
  isEditMode: boolean;
  clipSelectionMode: boolean;
  isParentPicking: boolean;
  songTab: "takes" | "lyrics" | "notes";
};

export function useSongUndo({
  floatingBaseBottom,
  isProject,
  isEditMode,
  clipSelectionMode,
  isParentPicking,
  songTab,
}: UseSongUndoParams) {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  function clearUndo() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoState(null);
  }

  function showUndo(message: string, undo: () => void) {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUndoState({ id, message, undo });
    undoTimerRef.current = setTimeout(() => {
      setUndoState((prev) => (prev?.id === id ? null : prev));
      undoTimerRef.current = null;
    }, 5000);
  }

  const songUndoBottom =
    isProject &&
    !isEditMode &&
    !clipSelectionMode &&
    !isParentPicking &&
    songTab === "takes"
      ? floatingBaseBottom + 72
      : floatingBaseBottom;

  return {
    undoState,
    showUndo,
    clearUndo,
    songUndoBottom,
  };
}
