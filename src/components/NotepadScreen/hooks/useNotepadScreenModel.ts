import { useCallback, useMemo, useState } from "react";
import { useStore } from "../../../state/useStore";
import type { Note } from "../../../types";

export function useNotepadScreenModel() {
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const sortedNotes = useMemo(() => {
    const pinned = notes.filter((n) => n.isPinned).sort((a, b) => b.updatedAt - a.updatedAt);
    const unpinned = notes.filter((n) => !n.isPinned).sort((a, b) => b.updatedAt - a.updatedAt);
    return [...pinned, ...unpinned];
  }, [notes]);

  const activeNote = useMemo(
    () => (activeNoteId ? notes.find((n) => n.id === activeNoteId) ?? null : null),
    [activeNoteId, notes]
  );

  const handleNewNote = useCallback(() => {
    const id = addNote();
    setActiveNoteId(id);
  }, [addNote]);

  const handleOpenNote = useCallback((note: Note) => {
    setActiveNoteId(note.id);
  }, []);

  const handleCloseNote = useCallback(() => {
    setActiveNoteId(null);
  }, []);

  const handleUpdateNote = useCallback(
    (updates: { title?: string; body?: string }) => {
      if (!activeNoteId) return;
      updateNote(activeNoteId, updates);
    },
    [activeNoteId, updateNote]
  );

  const handleTogglePin = useCallback(
    (noteId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      updateNote(noteId, { isPinned: !note.isPinned });
    },
    [notes, updateNote]
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      deleteNote(noteId);
      if (activeNoteId === noteId) setActiveNoteId(null);
    },
    [activeNoteId, deleteNote]
  );

  return {
    sortedNotes,
    activeNote,
    handleNewNote,
    handleOpenNote,
    handleCloseNote,
    handleUpdateNote,
    handleTogglePin,
    handleDeleteNote,
  };
}
