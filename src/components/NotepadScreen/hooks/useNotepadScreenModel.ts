import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Share } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { buildShareTextFromNotes } from "../../../notepad";
import { canSaveWordSpark } from "../../../proGating";
import { hasProAccess } from "../../../entitlements";
import { openProUpsell } from "../../common/proUpsell";
import type { Note, WordLadderExercise, CutUpSpark, MagpieSpark } from "../../../types";

export type NotebookEntry =
  | { kind: "note"; updatedAt: number; isPinned: boolean; note: Note }
  | { kind: "ladder"; updatedAt: number; isPinned: false; exercise: WordLadderExercise }
  | { kind: "cutup"; updatedAt: number; isPinned: false; spark: CutUpSpark }
  | { kind: "magpie"; updatedAt: number; isPinned: false; spark: MagpieSpark };

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
  const cutUpSparks = useStore((s) => s.cutUpSparks);
  const addCutUpSpark = useStore((s) => s.addCutUpSpark);
  const deleteCutUpSpark = useStore((s) => s.deleteCutUpSpark);
  const magpieSparks = useStore((s) => s.magpieSparks);
  const addMagpieSpark = useStore((s) => s.addMagpieSpark);
  const deleteMagpieSpark = useStore((s) => s.deleteMagpieSpark);

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedLadderIds, setSelectedLadderIds] = useState<string[]>([]);
  const [selectedCutUpIds, setSelectedCutUpIds] = useState<string[]>([]);
  const [selectedMagpieIds, setSelectedMagpieIds] = useState<string[]>([]);
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

  const filteredCutUps = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return cutUpSparks;
    return cutUpSparks.filter((spark) => {
      return (
        spark.title.toLowerCase().includes(needle) ||
        spark.sourceText.toLowerCase().includes(needle) ||
        spark.assembledDraftText.toLowerCase().includes(needle)
      );
    });
  }, [cutUpSparks, searchQuery]);

  const filteredMagpies = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return magpieSparks;
    return magpieSparks.filter((spark) => {
      return (
        spark.title.toLowerCase().includes(needle) ||
        spark.draft.toLowerCase().includes(needle) ||
        spark.fragments.some((f) => f.text.toLowerCase().includes(needle)) ||
        (spark.book?.title.toLowerCase().includes(needle) ?? false) ||
        (spark.book?.author.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [magpieSparks, searchQuery]);

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
    const cutUpEntries: NotebookEntry[] = filteredCutUps.map((spark) => ({
      kind: "cutup",
      updatedAt: spark.updatedAt,
      isPinned: false,
      spark,
    }));
    const magpieEntries: NotebookEntry[] = filteredMagpies.map((spark) => ({
      kind: "magpie",
      updatedAt: spark.updatedAt,
      isPinned: false,
      spark,
    }));
    return [...noteEntries, ...ladderEntries, ...cutUpEntries, ...magpieEntries];
  }, [filteredNotes, filteredLadders, filteredCutUps, filteredMagpies]);

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
  const totalEntryCount =
    notes.length + wordLadders.length + cutUpSparks.length + magpieSparks.length;
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
    // Free users keep a limited number of sparks PER TOOL; existing ones stay fully editable.
    if (!canSaveWordSpark(wordLadders.length, hasProAccess("word-sparks-unlimited"))) {
      openProUpsell("word-sparks-unlimited");
      return;
    }
    const id = addWordLadder("", "");
    navigation.navigate("WordLadderHome", { exerciseId: id });
  }, [addWordLadder, navigation, wordLadders.length]);

  const handleNewCutUp = useCallback(() => {
    if (!canSaveWordSpark(cutUpSparks.length, hasProAccess("word-sparks-unlimited"))) {
      openProUpsell("word-sparks-unlimited");
      return;
    }
    const id = addCutUpSpark("");
    navigation.navigate("CutUpHome", { sparkId: id });
  }, [addCutUpSpark, navigation, cutUpSparks.length]);

  const handleNewMagpie = useCallback(() => {
    if (!canSaveWordSpark(magpieSparks.length, hasProAccess("word-sparks-unlimited"))) {
      openProUpsell("word-sparks-unlimited");
      return;
    }
    const id = addMagpieSpark();
    navigation.navigate("MagpieHome", { sparkId: id });
  }, [addMagpieSpark, navigation, magpieSparks.length]);

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

  const handleOpenCutUp = useCallback(
    (spark: CutUpSpark) => {
      if (selectionMode) {
        toggleSelectCutUp(spark.id);
        return;
      }
      navigation.navigate("CutUpHome", { sparkId: spark.id });
    },
    [navigation, selectionMode] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleOpenMagpie = useCallback(
    (spark: MagpieSpark) => {
      if (selectionMode) {
        toggleSelectMagpie(spark.id);
        return;
      }
      navigation.navigate("MagpieHome", { sparkId: spark.id });
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
    setSelectedCutUpIds([]);
    setSelectedMagpieIds([]);
  }, []);

  const beginLadderSelection = useCallback((ladderId: string) => {
    setSelectionMode(true);
    setSelectedLadderIds([ladderId]);
    setSelectedNoteIds([]);
    setSelectedCutUpIds([]);
    setSelectedMagpieIds([]);
  }, []);

  const beginCutUpSelection = useCallback((cutUpId: string) => {
    setSelectionMode(true);
    setSelectedCutUpIds([cutUpId]);
    setSelectedNoteIds([]);
    setSelectedLadderIds([]);
    setSelectedMagpieIds([]);
  }, []);

  const beginMagpieSelection = useCallback((magpieId: string) => {
    setSelectionMode(true);
    setSelectedMagpieIds([magpieId]);
    setSelectedNoteIds([]);
    setSelectedLadderIds([]);
    setSelectedCutUpIds([]);
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

  const toggleSelectCutUp = useCallback((cutUpId: string) => {
    setSelectedCutUpIds((prev) =>
      prev.includes(cutUpId) ? prev.filter((id) => id !== cutUpId) : [...prev, cutUpId]
    );
  }, []);

  const toggleSelectMagpie = useCallback((magpieId: string) => {
    setSelectedMagpieIds((prev) =>
      prev.includes(magpieId) ? prev.filter((id) => id !== magpieId) : [...prev, magpieId]
    );
  }, []);

  // Leave selection mode automatically once nothing is selected, regardless of
  // whether the last item deselected was a note or a spark.
  useEffect(() => {
    if (
      selectionMode &&
      selectedNoteIds.length === 0 &&
      selectedLadderIds.length === 0 &&
      selectedCutUpIds.length === 0 &&
      selectedMagpieIds.length === 0
    ) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedNoteIds, selectedLadderIds, selectedCutUpIds, selectedMagpieIds]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedNoteIds([]);
    setSelectedLadderIds([]);
    setSelectedCutUpIds([]);
    setSelectedMagpieIds([]);
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedNoteIds(filteredNotes.map((note) => note.id));
    setSelectedLadderIds(filteredLadders.map((exercise) => exercise.id));
    setSelectedCutUpIds(filteredCutUps.map((spark) => spark.id));
    setSelectedMagpieIds(filteredMagpies.map((spark) => spark.id));
  }, [filteredNotes, filteredLadders, filteredCutUps, filteredMagpies]);

  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedNoteIds.includes(note.id)),
    [notes, selectedNoteIds]
  );

  const allSelected =
    filteredNotes.length + filteredLadders.length + filteredCutUps.length + filteredMagpies.length > 0 &&
    filteredNotes.every((note) => selectedNoteIds.includes(note.id)) &&
    filteredLadders.every((exercise) => selectedLadderIds.includes(exercise.id)) &&
    filteredCutUps.every((spark) => selectedCutUpIds.includes(spark.id)) &&
    filteredMagpies.every((spark) => selectedMagpieIds.includes(spark.id));
  const allSelectedPinned = selectedNotes.length > 0 && selectedNotes.every((note) => note.isPinned);

  const handleDeleteSelected = useCallback(() => {
    selectedNoteIds.forEach((id) => deleteNote(id));
    selectedLadderIds.forEach((id) => deleteWordLadder(id));
    selectedCutUpIds.forEach((id) => deleteCutUpSpark(id));
    selectedMagpieIds.forEach((id) => deleteMagpieSpark(id));
    cancelSelection();
  }, [selectedNoteIds, selectedLadderIds, selectedCutUpIds, selectedMagpieIds, deleteNote, deleteWordLadder, deleteCutUpSpark, deleteMagpieSpark, cancelSelection]);

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
    handleNewCutUp,
    handleNewMagpie,
    handleOpenNote,
    handleOpenLadder,
    handleOpenCutUp,
    handleOpenMagpie,
    handleCloseNote,
    handleUpdateNote,
    handleTogglePin,
    handleDeleteNote,

    selectionMode,
    selectedNoteIds,
    selectedLadderIds,
    selectedCutUpIds,
    selectedMagpieIds,
    selectedNotes,
    allSelected,
    allSelectedPinned,
    beginSelection,
    beginLadderSelection,
    beginCutUpSelection,
    beginMagpieSelection,
    toggleSelectNote,
    toggleSelectLadder,
    toggleSelectCutUp,
    toggleSelectMagpie,
    cancelSelection,
    selectAllVisible,
    handleDeleteSelected,
    handleToggleSelectedPin,
    handleDuplicateSelected,
    handleShareSelected,
    handleStartAddToSong,
  };
}
