import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Share } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { buildShareTextFromNotes } from "../../../notepad";
import type { Note } from "../../../types";

export function useNotepadScreenModel() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const startSongTargetPicking = useStore((s) => s.startSongTargetPicking);

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const handledRouteOpenTokenRef = useRef<number | null>(null);
  const hasAutoOpenedRef = useRef(false);

  const filteredNotes = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => {
      return (
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle)
      );
    });
  }, [notes, searchQuery]);

  const sections = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();
    const startOfYesterdayMs = startOfTodayMs - 24 * 60 * 60 * 1000;
    const startOfWeekMs = startOfTodayMs - 7 * 24 * 60 * 60 * 1000;

    const pinned: Note[] = [];
    const today: Note[] = [];
    const yesterday: Note[] = [];
    const thisWeek: Note[] = [];
    const earlier: Note[] = [];

    for (const note of filteredNotes) {
      if (note.isPinned) {
        pinned.push(note);
        continue;
      }
      if (note.updatedAt >= startOfTodayMs) {
        today.push(note);
      } else if (note.updatedAt >= startOfYesterdayMs) {
        yesterday.push(note);
      } else if (note.updatedAt >= startOfWeekMs) {
        thisWeek.push(note);
      } else {
        earlier.push(note);
      }
    }

    const sortDesc = (a: Note, b: Note) => b.updatedAt - a.updatedAt;
    const buckets: Array<{ key: string; label: string; notes: Note[] }> = [
      { key: "pinned", label: "Pinned", notes: pinned.sort(sortDesc) },
      { key: "today", label: "Today", notes: today.sort(sortDesc) },
      { key: "yesterday", label: "Yesterday", notes: yesterday.sort(sortDesc) },
      { key: "thisWeek", label: "Earlier this week", notes: thisWeek.sort(sortDesc) },
      { key: "earlier", label: "Earlier", notes: earlier.sort(sortDesc) },
    ];

    return buckets.filter((bucket) => bucket.notes.length > 0);
  }, [filteredNotes]);

  const totalNoteCount = notes.length;
  const isSearching = searchQuery.trim().length > 0;

  const activeNote = useMemo(
    () => (activeNoteId ? notes.find((n) => n.id === activeNoteId) ?? null : null),
    [activeNoteId, notes]
  );

  useEffect(() => {
    const routeNoteId = route.params?.noteId as string | undefined;
    const routeOpenToken = route.params?.openToken as number | undefined;
    if (!routeNoteId || typeof routeOpenToken !== "number" || handledRouteOpenTokenRef.current === routeOpenToken) {
      return;
    }

    if (!notes.some((note) => note.id === routeNoteId)) {
      return;
    }

    handledRouteOpenTokenRef.current = routeOpenToken;
    setActiveNoteId(routeNoteId);
  }, [notes, route.params?.noteId, route.params?.openToken]);

  const handleNewNote = useCallback(() => {
    const id = addNote();
    setActiveNoteId(id);
  }, [addNote]);

  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (totalNoteCount !== 0) {
      hasAutoOpenedRef.current = true;
      return;
    }
    if (activeNoteId !== null) return;
    hasAutoOpenedRef.current = true;
    handleNewNote();
  }, [totalNoteCount, activeNoteId, handleNewNote]);

  const handleOpenNote = useCallback(
    (note: Note) => {
      if (selectionMode) {
        toggleSelectNote(note.id);
        return;
      }
      setActiveNoteId(note.id);
    },
    [selectionMode] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleCloseNote = useCallback(() => {
    if (activeNoteId) {
      const note = notes.find((n) => n.id === activeNoteId);
      if (note && !note.title.trim() && !note.body.trim()) {
        deleteNote(activeNoteId);
      }
    }
    setActiveNoteId(null);
  }, [activeNoteId, notes, deleteNote]);

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

  // ── Selection mode ──────────────────────────────────────────────────────
  const beginSelection = useCallback((noteId: string) => {
    setSelectionMode(true);
    setSelectedNoteIds([noteId]);
  }, []);

  const toggleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId];
      if (next.length === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedNoteIds([]);
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedNoteIds(filteredNotes.map((note) => note.id));
  }, [filteredNotes]);

  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedNoteIds.includes(note.id)),
    [notes, selectedNoteIds]
  );

  const allSelected =
    filteredNotes.length > 0 && filteredNotes.every((note) => selectedNoteIds.includes(note.id));
  const allSelectedPinned = selectedNotes.length > 0 && selectedNotes.every((note) => note.isPinned);

  const handleDeleteSelected = useCallback(() => {
    selectedNoteIds.forEach((id) => deleteNote(id));
    cancelSelection();
  }, [selectedNoteIds, deleteNote, cancelSelection]);

  const handleToggleSelectedPin = useCallback(() => {
    const nextPinned = !allSelectedPinned;
    selectedNoteIds.forEach((id) => updateNote(id, { isPinned: nextPinned }));
    cancelSelection();
  }, [selectedNoteIds, allSelectedPinned, updateNote, cancelSelection]);

  const handleDuplicateSelected = useCallback(() => {
    const notesToCopy = selectedNotes;
    notesToCopy.forEach((note) => {
      const newId = addNote();
      updateNote(newId, {
        title: note.title.trim() ? `${note.title} (Copy)` : note.title,
        body: note.body,
      });
    });
    cancelSelection();
    return notesToCopy.length;
  }, [selectedNotes, addNote, updateNote, cancelSelection]);

  const handleShareSelected = useCallback(() => {
    const text = buildShareTextFromNotes(selectedNotes);
    if (!text) return;
    const count = selectedNotes.length;
    void Share.share({
      title: count === 1 ? "Lyrics Pad page" : `${count} Lyrics Pad pages`,
      message: text,
    });
  }, [selectedNotes]);

  // ── Add to song ─────────────────────────────────────────────────────────
  // Hands the pending pages off to the global song-target-picker and sends the
  // user to the workspace list to navigate to whichever song they want, the same
  // way clipboard copy/move works elsewhere in the app.
  const handleStartAddToSong = useCallback(() => {
    startSongTargetPicking(selectedNoteIds);
    cancelSelection();
    navigation.navigate("Workspaces");
  }, [startSongTargetPicking, selectedNoteIds, cancelSelection, navigation]);

  return {
    sections,
    totalNoteCount,
    isSearching,
    searchQuery,
    setSearchQuery,
    activeNote,
    handleNewNote,
    handleOpenNote,
    handleCloseNote,
    handleUpdateNote,
    handleTogglePin,
    handleDeleteNote,

    selectionMode,
    selectedNoteIds,
    selectedNotes,
    allSelected,
    allSelectedPinned,
    beginSelection,
    toggleSelectNote,
    cancelSelection,
    selectAllVisible,
    handleDeleteSelected,
    handleToggleSelectedPin,
    handleDuplicateSelected,
    handleShareSelected,
    handleStartAddToSong,
  };
}
