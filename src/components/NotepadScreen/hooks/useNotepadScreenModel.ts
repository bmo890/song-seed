import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Share } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { buildShareTextFromNotes } from "../../../notepad";
import type { Note, WordLadderExercise } from "../../../types";

export type NotebookEntry =
  | { kind: "note"; updatedAt: number; isPinned: boolean; note: Note }
  | { kind: "ladder"; updatedAt: number; isPinned: false; exercise: WordLadderExercise };

export function useNotepadScreenModel() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const startSongTargetPicking = useStore((s) => s.startSongTargetPicking);
  const wordLadders = useStore((s) => s.wordLadders);
  const addWordLadder = useStore((s) => s.addWordLadder);
  const deleteWordLadder = useStore((s) => s.deleteWordLadder);

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedLadderIds, setSelectedLadderIds] = useState<string[]>([]);
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

  const filteredLadders = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return wordLadders;
    return wordLadders.filter((exercise) => {
      return (
        exercise.title.toLowerCase().includes(needle) ||
        exercise.roleSeed.toLowerCase().includes(needle) ||
        exercise.placeSeed.toLowerCase().includes(needle) ||
        exercise.draft.toLowerCase().includes(needle) ||
        exercise.revision.toLowerCase().includes(needle)
      );
    });
  }, [wordLadders, searchQuery]);

  const entries: NotebookEntry[] = useMemo(() => {
    const noteEntries: NotebookEntry[] = filteredNotes.map((note) => ({
      kind: "note",
      updatedAt: note.updatedAt,
      isPinned: note.isPinned,
      note,
    }));
    const ladderEntries: NotebookEntry[] = filteredLadders.map((exercise) => ({
      kind: "ladder",
      updatedAt: exercise.updatedAt,
      isPinned: false,
      exercise,
    }));
    return [...noteEntries, ...ladderEntries];
  }, [filteredNotes, filteredLadders]);

  const sections = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();
    const startOfYesterdayMs = startOfTodayMs - 24 * 60 * 60 * 1000;
    const startOfWeekMs = startOfTodayMs - 7 * 24 * 60 * 60 * 1000;

    const pinned: NotebookEntry[] = [];
    const today: NotebookEntry[] = [];
    const yesterday: NotebookEntry[] = [];
    const thisWeek: NotebookEntry[] = [];
    const earlier: NotebookEntry[] = [];

    for (const entry of entries) {
      if (entry.isPinned) {
        pinned.push(entry);
        continue;
      }
      if (entry.updatedAt >= startOfTodayMs) {
        today.push(entry);
      } else if (entry.updatedAt >= startOfYesterdayMs) {
        yesterday.push(entry);
      } else if (entry.updatedAt >= startOfWeekMs) {
        thisWeek.push(entry);
      } else {
        earlier.push(entry);
      }
    }

    const sortDesc = (a: NotebookEntry, b: NotebookEntry) => b.updatedAt - a.updatedAt;
    const buckets: Array<{ key: string; label: string; entries: NotebookEntry[] }> = [
      { key: "pinned", label: "Pinned", entries: pinned.sort(sortDesc) },
      { key: "today", label: "Today", entries: today.sort(sortDesc) },
      { key: "yesterday", label: "Yesterday", entries: yesterday.sort(sortDesc) },
      { key: "thisWeek", label: "Earlier this week", entries: thisWeek.sort(sortDesc) },
      { key: "earlier", label: "Earlier", entries: earlier.sort(sortDesc) },
    ];

    return buckets.filter((bucket) => bucket.entries.length > 0);
  }, [entries]);

  const totalNoteCount = notes.length;
  const totalEntryCount = notes.length + wordLadders.length;
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

  const handleNewWordLadder = useCallback(() => {
    const id = addWordLadder("", "");
    navigation.navigate("WordLadderHome", { exerciseId: id });
  }, [addWordLadder, navigation]);

  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (totalEntryCount !== 0) {
      hasAutoOpenedRef.current = true;
      return;
    }
    if (activeNoteId !== null) return;
    hasAutoOpenedRef.current = true;
    handleNewNote();
  }, [totalEntryCount, activeNoteId, handleNewNote]);

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

  const handleOpenLadder = useCallback(
    (exercise: WordLadderExercise) => {
      if (selectionMode) {
        toggleSelectLadder(exercise.id);
        return;
      }
      navigation.navigate("WordLadderHome", { exerciseId: exercise.id });
    },
    [navigation, selectionMode] // eslint-disable-line react-hooks/exhaustive-deps
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

  // ── Selection mode (notes and Word Ladder sparks can be bulk-selected) ──
  const beginSelection = useCallback((noteId: string) => {
    setSelectionMode(true);
    setSelectedNoteIds([noteId]);
    setSelectedLadderIds([]);
  }, []);

  const beginLadderSelection = useCallback((ladderId: string) => {
    setSelectionMode(true);
    setSelectedLadderIds([ladderId]);
    setSelectedNoteIds([]);
  }, []);

  const toggleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  }, []);

  const toggleSelectLadder = useCallback((ladderId: string) => {
    setSelectedLadderIds((prev) =>
      prev.includes(ladderId) ? prev.filter((id) => id !== ladderId) : [...prev, ladderId]
    );
  }, []);

  // Leave selection mode automatically once nothing is selected, regardless of
  // whether the last item deselected was a note or a spark.
  useEffect(() => {
    if (selectionMode && selectedNoteIds.length === 0 && selectedLadderIds.length === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedNoteIds, selectedLadderIds]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedNoteIds([]);
    setSelectedLadderIds([]);
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedNoteIds(filteredNotes.map((note) => note.id));
    setSelectedLadderIds(filteredLadders.map((exercise) => exercise.id));
  }, [filteredNotes, filteredLadders]);

  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedNoteIds.includes(note.id)),
    [notes, selectedNoteIds]
  );

  const allSelected =
    filteredNotes.length + filteredLadders.length > 0 &&
    filteredNotes.every((note) => selectedNoteIds.includes(note.id)) &&
    filteredLadders.every((exercise) => selectedLadderIds.includes(exercise.id));
  const allSelectedPinned = selectedNotes.length > 0 && selectedNotes.every((note) => note.isPinned);

  const handleDeleteSelected = useCallback(() => {
    selectedNoteIds.forEach((id) => deleteNote(id));
    selectedLadderIds.forEach((id) => deleteWordLadder(id));
    cancelSelection();
  }, [selectedNoteIds, selectedLadderIds, deleteNote, deleteWordLadder, cancelSelection]);

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
    totalEntryCount,
    isSearching,
    searchQuery,
    setSearchQuery,
    activeNote,
    handleNewNote,
    handleNewWordLadder,
    handleOpenNote,
    handleOpenLadder,
    handleCloseNote,
    handleUpdateNote,
    handleTogglePin,
    handleDeleteNote,

    selectionMode,
    selectedNoteIds,
    selectedLadderIds,
    selectedNotes,
    allSelected,
    allSelectedPinned,
    beginSelection,
    beginLadderSelection,
    toggleSelectNote,
    toggleSelectLadder,
    cancelSelection,
    selectAllVisible,
    handleDeleteSelected,
    handleToggleSelectedPin,
    handleDuplicateSelected,
    handleShareSelected,
    handleStartAddToSong,
  };
}
