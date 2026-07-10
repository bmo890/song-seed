import { useCallback, useMemo, useRef } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import {
  assembleDraftText,
  bindWordRange,
  buildBoardItems,
  chunkTextsEqual,
  composeDraftText,
  type CutUpComposeFlavor,
  deriveCutUpTitle,
  duplicateBoardItem,
  generateChunks,
  generateChunksFromSeams,
  mergeChunkWithNext,
  reconcileBoard,
  reorderBoard,
  resetBoardOrder,
  seedCutSeams,
  setBoardItemRemoved,
  setBoardItemText,
  shuffleBoard,
  splitChunk,
  toggleBoardItemLock,
  toggleChunkIncluded,
  toggleSeam,
  tokenizeWords,
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
        // First entry into the Cut surface: seed the seams from phrase breaks.
        if (spark.cutSeams === undefined && spark.sourceText.trim()) {
          const words = tokenizeWords(spark.sourceText);
          apply({ step: next, cutSeams: seedCutSeams(spark.sourceText, words) });
          return;
        }
        apply({ step: next });
      } else if (next === "board") {
        // Turn the current cut into chunks; only rebuild the board when the cut
        // actually changed, so revisiting keeps the writer's arrangement.
        const fresh = generateChunksFromSeams(spark.sourceText, spark.cutSeams ?? []);
        if (chunkTextsEqual(fresh, spark.chunks)) {
          apply({ step: next, boardItems: reconcileBoard(spark.chunks, spark.boardItems) });
        } else {
          apply({ step: next, chunks: fresh, boardItems: buildBoardItems(fresh) });
        }
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
      // Manual edits break the link to a source lyric page and re-seed the cut.
      apply({
        sourceText,
        title: deriveCutUpTitle(sourceText),
        sourceLyricId: undefined,
        cutSeams: undefined,
      });
    },
    [apply]
  );

  const pickSourceNote = useCallback(
    (note: Note) => {
      apply({
        sourceText: note.body,
        sourceLyricId: note.id,
        title: note.title.trim() ? note.title : deriveCutUpTitle(note.body),
        cutSeams: undefined,
        chunks: [],
        boardItems: [],
      });
    },
    [apply]
  );

  // ── Cut surface (seam editing) ─────────────────────────────────────────────
  const currentSeams = spark
    ? spark.cutSeams ?? seedCutSeams(spark.sourceText, tokenizeWords(spark.sourceText))
    : [];

  const toggleSeamAt = useCallback(
    (seam: number) => {
      if (!spark) return;
      const seams = spark.cutSeams ?? seedCutSeams(spark.sourceText, tokenizeWords(spark.sourceText));
      apply({ cutSeams: toggleSeam(seams, seam) });
    },
    [apply, spark]
  );

  const bindWords = useCallback(
    (startWord: number, endWord: number, wordCount: number) => {
      if (!spark) return;
      const seams = spark.cutSeams ?? seedCutSeams(spark.sourceText, tokenizeWords(spark.sourceText));
      apply({ cutSeams: bindWordRange(seams, startWord, endWord, wordCount) });
    },
    [apply, spark]
  );

  const resetCuts = useCallback(() => {
    if (!spark) return;
    apply({ cutSeams: seedCutSeams(spark.sourceText, tokenizeWords(spark.sourceText)) });
  }, [apply, spark]);

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

  const composeDraft = useCallback(
    (flavor: CutUpComposeFlavor) => {
      if (!spark) return;
      apply({ assembledDraftText: composeDraftText(spark.chunks, spark.boardItems, flavor) });
    },
    [apply, spark]
  );

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

  const hasContent =
    !!spark &&
    (spark.sourceText.trim().length > 0 ||
      spark.chunks.length > 0 ||
      spark.assembledDraftText.trim().length > 0);

  const goBack = useCallback(() => {
    // Already saved to the Lyrics Pad → just leave (the spark stays for resuming).
    if (spark?.savedLyricId) {
      navigation.navigate("NotepadHome");
      return;
    }

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
  }, [spark?.savedLyricId, hasContent, sparkId, deleteCutUpSpark, navigation]);

  // Catch every other way of leaving. Hardware back runs the same prompt as the
  // in-app Back button. A drawer switch can't be intercepted before it happens, so
  // on blur we silently discard an empty, unsaved spark (a started one is kept as
  // unfinished, like Lyrics Pad notes). Refs keep the focus effect from
  // re-subscribing on every keystroke — which would delete the spark mid-edit.
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const abandonRef = useRef({ sparkId, savedLyricId: spark?.savedLyricId ?? null, hasContent });
  abandonRef.current = { sparkId, savedLyricId: spark?.savedLyricId ?? null, hasContent };

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBackRef.current();
        return true;
      });
      return () => {
        sub.remove();
        const snapshot = abandonRef.current;
        if (snapshot.sparkId && !snapshot.savedLyricId && !snapshot.hasContent) {
          deleteCutUpSpark(snapshot.sparkId);
        }
      };
    }, [deleteCutUpSpark])
  );

  return {
    spark,
    step,
    notes,
    goToStep,
    markHelpSeen,
    setSourceText,
    pickSourceNote,
    currentSeams,
    toggleSeamAt,
    bindWords,
    resetCuts,
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
    composeDraft,
    saveAsLyrics,
    deleteSpark,
    goBack,
  };
}
