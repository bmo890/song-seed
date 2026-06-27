import { useCallback, useMemo } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import {
  assembleDraftText,
  deriveCutUpTitle,
  duplicateBoardItem,
  generateChunks,
  mergeChunkWithNext,
  reconcileBoard,
  reorderBoard,
  resetBoardOrder,
  setBoardItemRemoved,
  setBoardItemText,
  shuffleBoard,
  splitChunk,
  toggleBoardItemLock,
  toggleChunkIncluded,
} from "../../../cutUp";
import type { CutUpChunkMode, CutUpStep, Note } from "../../../types";

export function useCutUpScreenModel() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const sparkId = route.params?.sparkId as string | undefined;

  const cutUpSparks = useStore((s) => s.cutUpSparks);
  const updateCutUpSpark = useStore((s) => s.updateCutUpSpark);
  const deleteCutUpSpark = useStore((s) => s.deleteCutUpSpark);
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);

  const spark = useMemo(
    () => cutUpSparks.find((item) => item.id === sparkId) ?? null,
    [cutUpSparks, sparkId]
  );

  const apply = useCallback(
    (updates: Parameters<typeof updateCutUpSpark>[1]) => {
      if (!sparkId) return;
      updateCutUpSpark(sparkId, updates);
    },
    [sparkId, updateCutUpSpark]
  );

  const step: CutUpStep = spark?.step ?? "source";
  const effectiveMode = (mode: CutUpChunkMode): Exclude<CutUpChunkMode, "custom"> =>
    mode === "custom" ? "phrase" : mode;

  // ── Wizard navigation ──────────────────────────────────────────────────────
  const goToStep = useCallback(
    (next: CutUpStep) => {
      if (!spark) return;
      if (next === "chunk") {
        // First entry into chunking with no chunks yet: cut the source now.
        if (spark.chunks.length === 0 && spark.sourceText.trim()) {
          const mode = effectiveMode(spark.chunkMode);
          apply({ step: next, chunkMode: mode, chunks: generateChunks(spark.sourceText, mode) });
          return;
        }
        apply({ step: next });
      } else if (next === "board") {
        apply({ step: next, boardItems: reconcileBoard(spark.chunks, spark.boardItems) });
      } else if (next === "draft") {
        const assembled = spark.assembledDraftText.trim()
          ? spark.assembledDraftText
          : assembleDraftText(spark.chunks, spark.boardItems);
        apply({ step: next, assembledDraftText: assembled });
      } else {
        apply({ step: next });
      }
    },
    [apply, spark]
  );

  const markHelpSeen = useCallback(
    (which: CutUpStep) => {
      if (!spark || spark.seenHelpSteps.includes(which)) return;
      apply({ seenHelpSteps: [...spark.seenHelpSteps, which] });
    },
    [apply, spark]
  );

  // ── Source step ────────────────────────────────────────────────────────────
  const setSourceText = useCallback(
    (sourceText: string) => {
      // Manual edits break the link to a source lyric page.
      apply({ sourceText, title: deriveCutUpTitle(sourceText), sourceLyricId: undefined });
    },
    [apply]
  );

  const pickSourceNote = useCallback(
    (note: Note) => {
      apply({
        sourceText: note.body,
        sourceLyricId: note.id,
        title: note.title.trim() ? note.title : deriveCutUpTitle(note.body),
        chunks: [],
        boardItems: [],
      });
    },
    [apply]
  );

  // ── Chunk step ─────────────────────────────────────────────────────────────
  // Structural changes (mode switch, re-cut, split, merge) mint new chunk ids, so
  // the board is cleared to rebuild fresh; toggling inclusion keeps the board
  // (it reconciles on the next visit).
  const setChunkMode = useCallback(
    (mode: Exclude<CutUpChunkMode, "custom">) => {
      if (!spark) return;
      apply({ chunkMode: mode, chunks: generateChunks(spark.sourceText, mode), boardItems: [] });
    },
    [apply, spark]
  );

  const recut = useCallback(() => {
    if (!spark) return;
    const mode = effectiveMode(spark.chunkMode);
    apply({ chunkMode: mode, chunks: generateChunks(spark.sourceText, mode), boardItems: [] });
  }, [apply, spark]);

  const toggleChunk = useCallback(
    (chunkId: string) => {
      if (!spark) return;
      apply({ chunks: toggleChunkIncluded(spark.chunks, chunkId) });
    },
    [apply, spark]
  );

  const split = useCallback(
    (chunkId: string) => {
      if (!spark) return;
      apply({ chunks: splitChunk(spark.chunks, chunkId), chunkMode: "custom", boardItems: [] });
    },
    [apply, spark]
  );

  const merge = useCallback(
    (chunkId: string) => {
      if (!spark) return;
      apply({ chunks: mergeChunkWithNext(spark.chunks, chunkId), chunkMode: "custom", boardItems: [] });
    },
    [apply, spark]
  );

  // ── Board step ─────────────────────────────────────────────────────────────
  const shuffle = useCallback(() => {
    if (!spark) return;
    apply({ boardItems: shuffleBoard(spark.boardItems) });
  }, [apply, spark]);

  const reorder = useCallback(
    (orderedIds: string[]) => {
      if (!spark) return;
      apply({ boardItems: reorderBoard(spark.boardItems, orderedIds) });
    },
    [apply, spark]
  );

  const resetOrder = useCallback(() => {
    if (!spark) return;
    apply({ boardItems: resetBoardOrder(spark.boardItems, spark.chunks) });
  }, [apply, spark]);

  const toggleStripLock = useCallback(
    (itemId: string) => {
      if (!spark) return;
      apply({ boardItems: toggleBoardItemLock(spark.boardItems, itemId) });
    },
    [apply, spark]
  );

  const duplicateStrip = useCallback(
    (itemId: string) => {
      if (!spark) return;
      apply({ boardItems: duplicateBoardItem(spark.boardItems, itemId) });
    },
    [apply, spark]
  );

  const removeStrip = useCallback(
    (itemId: string) => {
      if (!spark) return;
      apply({ boardItems: setBoardItemRemoved(spark.boardItems, itemId, true) });
    },
    [apply, spark]
  );

  const restoreStrip = useCallback(
    (itemId: string) => {
      if (!spark) return;
      apply({ boardItems: setBoardItemRemoved(spark.boardItems, itemId, false) });
    },
    [apply, spark]
  );

  const editStripText = useCallback(
    (itemId: string, text: string) => {
      if (!spark) return;
      apply({ boardItems: setBoardItemText(spark.boardItems, itemId, text) });
    },
    [apply, spark]
  );

  // ── Draft step ─────────────────────────────────────────────────────────────
  const setDraft = useCallback(
    (assembledDraftText: string) => {
      apply({ assembledDraftText });
    },
    [apply]
  );

  const rebuildDraftFromBoard = useCallback(() => {
    if (!spark) return;
    apply({ assembledDraftText: assembleDraftText(spark.chunks, spark.boardItems) });
  }, [apply, spark]);

  // ── Save / delete ──────────────────────────────────────────────────────────
  const saveAsLyrics = useCallback(() => {
    if (!spark) return;
    const text = (
      spark.assembledDraftText.trim()
        ? spark.assembledDraftText
        : assembleDraftText(spark.chunks, spark.boardItems)
    ).trim();
    if (!text) {
      AppAlert.info("Nothing to save", "Arrange a few strips and rebuild a draft first.");
      return;
    }
    const noteId = addNote();
    updateNote(noteId, { title: spark.title, body: text });
    apply({ savedLyricId: noteId });
    navigation.navigate("NotepadHome", { noteId, openToken: Date.now() });
  }, [spark, addNote, updateNote, apply, navigation]);

  const deleteSpark = useCallback(() => {
    if (!sparkId) return;
    AppAlert.destructive(
      "Delete this Cut-Up?",
      "Its source, chunks, board, and draft will be gone for good.",
      () => {
        deleteCutUpSpark(sparkId);
        navigation.navigate("NotepadHome");
      },
      { confirmLabel: "Delete" }
    );
  }, [deleteCutUpSpark, sparkId, navigation]);

  const goBack = useCallback(() => {
    // Already saved to the Lyrics Pad → just leave (the spark stays for resuming).
    if (spark?.savedLyricId) {
      navigation.navigate("NotepadHome");
      return;
    }

    const hasContent =
      !!spark &&
      (spark.sourceText.trim().length > 0 ||
        spark.chunks.length > 0 ||
        spark.assembledDraftText.trim().length > 0);

    // A freshly-opened spark with nothing in it should not linger in the pad —
    // discard the auto-created record rather than silently keeping it.
    if (!hasContent) {
      if (sparkId) deleteCutUpSpark(sparkId);
      navigation.navigate("NotepadHome");
      return;
    }

    AppAlert.custom("Save as unfinished?", "Keep this exercise to come back to, or discard it.", [
      {
        label: "Discard",
        style: "destructive",
        icon: actionIcons.discard,
        onPress: () => {
          if (sparkId) deleteCutUpSpark(sparkId);
          navigation.navigate("NotepadHome");
        },
      },
      {
        label: "Save as unfinished",
        style: "default",
        icon: actionIcons.bookmark,
        onPress: () => navigation.navigate("NotepadHome"),
      },
    ]);
  }, [spark, sparkId, deleteCutUpSpark, navigation]);

  return {
    spark,
    step,
    notes,
    goToStep,
    markHelpSeen,
    setSourceText,
    pickSourceNote,
    setChunkMode,
    recut,
    toggleChunk,
    split,
    merge,
    shuffle,
    reorder,
    resetOrder,
    toggleStripLock,
    duplicateStrip,
    removeStrip,
    restoreStrip,
    editStripText,
    setDraft,
    rebuildDraftFromBoard,
    saveAsLyrics,
    deleteSpark,
    goBack,
  };
}
