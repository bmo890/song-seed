import { useCallback, useMemo, useRef, useState } from "react";
import { BackHandler, Dimensions } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { toast } from "../../common/toastStore";
import { sparkSaveTitle } from "../../../domain/notepad";
import { actionIcons } from "../../common/actionIcons";
import {
  assembleDraftFromCanvas,
  bindWordRange,
  boardItemText,
  buildBoardItems,
  canvasNeedsDeal,
  canvasScrapTexts,
  chunkTextsEqual,
  composeShuffledTexts,
  type CutUpComposeFlavor,
  deriveCutUpTitle,
  duplicateBoardItem,
  generateChunks,
  generateChunksFromSeams,
  mergeChunkWithNext,
  moveCanvasScrap,
  nextFreeBand,
  packSourceLines,
  placeMissingScraps,
  poolAllScraps,
  restorePooledScraps,
  reconcileBoard,
  seedCutSeams,
  setBoardItemRemoved,
  setBoardItemText,
  shuffleCanvas,
  splitBoardItemByTexts,
  splitChunk,
  toggleBoardItemLock,
  toggleChunkIncluded,
  toggleSeam,
  tokenizeWords,
} from "../../../domain/cutUp";
import { detectTextDirection } from "../../../i18n/direction";
import { useSparkTextScale } from "../../common/sparkTextScale";
import type { CutUpBoardItem, CutUpChunkMode, CutUpSpark, CutUpStep, Note } from "../../../types";
import { useTranslation } from "react-i18next";

/** Reader for a scrap's displayed text, keyed by board-item id. */
function makeTextOf(spark: CutUpSpark) {
  return (id: string) => {
    const item = spark.boardItems.find((it) => it.id === id);
    return item ? boardItemText(item, spark.chunks) : "";
  };
}

/** Whether the table's content reads right-to-left (Hebrew source). */
function canvasRtl(spark: CutUpSpark): boolean {
  const sample = spark.chunks.map((c) => c.text).join(" ");
  return detectTextDirection(sample) === "rtl";
}

export function useCutUpScreenModel() {
  const { t } = useTranslation();
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
  const { size: scrapFontSize } = useSparkTextScale();

  /** Generous serif width estimate for a scrap, for layouts computed before the
   * scraps have been measured (initial deal). Over-estimating is safe — it only
   * wraps a line a little early, never overlaps. */
  const estimateWidthOf = useCallback(
    (spark2: CutUpSpark) => {
      const textOf = makeTextOf(spark2);
      return (id: string) => 30 + textOf(id).length * scrapFontSize * 0.62;
    },
    [scrapFontSize]
  );
  const fallbackCanvasW = Dimensions.get("window").width - 32;
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
        // Turn the current cut into chunks; only re-deal the table when the cut
        // actually changed, so revisiting keeps the writer's arrangement.
        const fresh = generateChunksFromSeams(spark.sourceText, spark.cutSeams ?? []);
        if (chunkTextsEqual(fresh, spark.chunks)) {
          let items = reconcileBoard(spark.chunks, spark.boardItems);
          if (canvasNeedsDeal(items)) items = placeMissingScraps(items);
          apply({ step: next, boardItems: items });
        } else {
          // A fresh cut opens laid out as the lyric is written — each source
          // line on its own rule (estimated widths; measured ones refine later).
          let items = buildBoardItems(fresh);
          items = packSourceLines(
            items,
            fresh,
            spark.sourceText,
            estimateWidthOf({ ...spark, chunks: fresh, boardItems: items }),
            fallbackCanvasW,
            8
          );
          clearBoardHistory();
          apply({ step: next, chunks: fresh, boardItems: items });
        }
      } else if (next === "draft") {
        const assembled = spark.assembledDraftText.trim()
          ? spark.assembledDraftText
          : assembleDraftFromCanvas(spark.boardItems, makeTextOf(spark), canvasRtl(spark));
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
    (note: Note, text?: string) => {
      const sourceText = text ?? note.body;
      apply({
        sourceText,
        sourceLyricId: note.id,
        title: note.title.trim() ? note.title : deriveCutUpTitle(sourceText),
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

  // ── Board step (the table) ─────────────────────────────────────────────────
  // Scraps carry a free x (px) and a ruled-band index y. There is no slot
  // logic: a drop just writes the position, and the draft reads the table
  // band by band. `rtl` orients reading order for Hebrew scraps.
  const rtl = spark ? canvasRtl(spark) : false;

  // Undo/redo over table changes (positions, shuffle, dup, split, remove…).
  // Text edits are excluded — they'd flood the stack one keystroke at a time.
  const [boardHistory, setBoardHistory] = useState<{
    undo: CutUpBoardItem[][];
    redo: CutUpBoardItem[][];
  }>({ undo: [], redo: [] });

  const clearBoardHistory = useCallback(() => setBoardHistory({ undo: [], redo: [] }), []);

  /** Applies a board change, recording the previous table for undo. */
  const applyBoard = useCallback(
    (items: CutUpBoardItem[]) => {
      if (!spark) return;
      const prev = spark.boardItems;
      setBoardHistory((h) => ({ undo: [...h.undo.slice(-39), prev], redo: [] }));
      apply({ boardItems: items });
    },
    [apply, spark]
  );

  const undoBoard = useCallback(() => {
    if (!spark) return;
    setBoardHistory((h) => {
      if (h.undo.length === 0) return h;
      const prev = h.undo[h.undo.length - 1];
      apply({ boardItems: prev });
      return { undo: h.undo.slice(0, -1), redo: [...h.redo.slice(-39), spark.boardItems] };
    });
  }, [apply, spark]);

  const redoBoard = useCallback(() => {
    if (!spark) return;
    setBoardHistory((h) => {
      if (h.redo.length === 0) return h;
      const next = h.redo[h.redo.length - 1];
      apply({ boardItems: next });
      return { undo: [...h.undo.slice(-39), spark.boardItems], redo: h.redo.slice(0, -1) };
    });
  }, [apply, spark]);

  const canUndoBoard = boardHistory.undo.length > 0;
  const canRedoBoard = boardHistory.redo.length > 0;

  /** Random re-deal into rows of varied length. Widths come from the UI's
   * measured scraps so rows pack to the real canvas. */
  const shuffle = useCallback(
    (widths: Record<string, number>, canvasW: number) => {
      if (!spark) return;
      const widthOf = (id: string) => widths[id] ?? 120;
      applyBoard(shuffleCanvas(spark.boardItems, widthOf, canvasW, 8));
    },
    [applyBoard, spark]
  );

  /** Lays the table out as the lyric is written — source lines on rules. */
  const resetOrder = useCallback(
    (widths: Record<string, number>, canvasW: number) => {
      if (!spark) return;
      const widthOf = (id: string) => widths[id] ?? estimateWidthOf(spark)(id);
      applyBoard(packSourceLines(spark.boardItems, spark.chunks, spark.sourceText, widthOf, canvasW, 8));
    },
    [applyBoard, spark, estimateWidthOf]
  );

  /** A drop: the scrap lands at x, settled onto ruled band `band`. */
  const moveScrap = useCallback(
    (id: string, x: number, band: number) => {
      if (!spark) return;
      applyBoard(moveCanvasScrap(spark.boardItems, id, x, band));
    },
    [applyBoard, spark]
  );

  /** Sends every scrap to the pool (set-aside tray) to browse the whole set. */
  const poolAll = useCallback(() => {
    if (!spark) return;
    applyBoard(poolAllScraps(spark.boardItems));
  }, [applyBoard, spark]);

  /** Brings the whole pool back onto the table, below anything already placed. */
  const restoreAll = useCallback(() => {
    if (!spark) return;
    applyBoard(restorePooledScraps(spark.boardItems));
  }, [applyBoard, spark]);

  const activeCount = spark ? spark.boardItems.filter((it) => !it.removed).length : 0;
  const pooledCount = spark ? spark.boardItems.filter((it) => it.removed).length : 0;

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
      const source = spark.boardItems.find((it) => it.id === itemId);
      let items = duplicateBoardItem(spark.boardItems, itemId);
      const oldIds = new Set(spark.boardItems.map((it) => it.id));
      const copy = items.find((it) => !oldIds.has(it.id));
      // The copy lands just below its source so it's visibly a new scrap.
      if (copy && source) {
        items = moveCanvasScrap(items, copy.id, (source.x ?? 0) + 18, (source.y ?? 0) + 1);
      }
      applyBoard(items);
    },
    [applyBoard, spark]
  );

  const removeStrip = useCallback(
    (itemId: string) => {
      if (!spark) return;
      applyBoard(setBoardItemRemoved(spark.boardItems, itemId, true));
    },
    [applyBoard, spark]
  );

  const restoreStrip = useCallback(
    (itemId: string) => {
      if (!spark) return;
      let items = setBoardItemRemoved(spark.boardItems, itemId, false);
      // Back onto the table on the first free rule below everything.
      items = moveCanvasScrap(items, itemId, 0, nextFreeBand(spark.boardItems));
      applyBoard(items);
    },
    [applyBoard, spark]
  );

  const editStripText = useCallback(
    (itemId: string, text: string) => {
      if (!spark) return;
      apply({ boardItems: setBoardItemText(spark.boardItems, itemId, text) });
    },
    [apply, spark]
  );

  /** Re-cuts one scrap into pieces from the table, the pieces cascading from the
   * source scrap's spot on its rule. */
  const splitStrip = useCallback(
    (itemId: string, pieceTexts: string[]) => {
      if (!spark) return;
      const source = spark.boardItems.find((it) => it.id === itemId);
      let items = splitBoardItemByTexts(spark.boardItems, itemId, pieceTexts);
      const oldIds = new Set(spark.boardItems.map((it) => it.id));
      const pieces = items.filter((it) => !oldIds.has(it.id));
      pieces.forEach((piece, i) => {
        items = moveCanvasScrap(items, piece.id, (source?.x ?? 0) + i * 18, (source?.y ?? 0) + (i > 0 ? i : 0));
      });
      applyBoard(items);
    },
    [applyBoard, spark]
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
    apply({ assembledDraftText: assembleDraftFromCanvas(spark.boardItems, makeTextOf(spark), canvasRtl(spark)) });
  }, [apply, spark]);

  const composeDraft = useCallback(
    (flavor: CutUpComposeFlavor) => {
      if (!spark) return;
      const texts = canvasScrapTexts(spark.boardItems, makeTextOf(spark), canvasRtl(spark));
      apply({ assembledDraftText: composeShuffledTexts(texts, flavor) });
    },
    [apply, spark]
  );

  // ── Save / delete ──────────────────────────────────────────────────────────
  const saveAsLyrics = useCallback(() => {
    if (!spark) return;
    const text = (
      spark.assembledDraftText.trim()
        ? spark.assembledDraftText
        : assembleDraftFromCanvas(spark.boardItems, makeTextOf(spark), canvasRtl(spark))
    ).trim();
    if (!text) {
      AppAlert.info(t("wordSparks.nothingSave"), t("cutUp.nothingBody"));
      return;
    }
    const noteId = addNote();
    updateNote(noteId, { title: sparkSaveTitle(spark.title, t("wordSparks.cutUp"), notes), body: text });
    // Saving completes the exercise: the page in the pad is now the real thing,
    // so the scaffolding leaves the Sparks tab.
    toast(t("wordSparks.savedToPad"), "checkmark-outline");
    navigation.navigate("NotepadHome", { noteId, openToken: Date.now() });
    if (sparkId) deleteCutUpSpark(sparkId);
  }, [spark, sparkId, notes, addNote, updateNote, deleteCutUpSpark, navigation, t]);

  const deleteSpark = useCallback(() => {
    if (!sparkId) return;
    AppAlert.destructive(
      t("cutUp.deleteTitle"),
      t("cutUp.deleteBody"),
      () => {
        deleteCutUpSpark(sparkId);
        navigation.navigate("NotepadHome");
      },
      { confirmLabel: t("wordSparks.delete") }
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

    AppAlert.custom(t("wordSparks.saveUnfinishedTitle"), t("wordSparks.saveUnfinishedBody"), [
      {
        label: t("wordSparks.discard"),
        style: "destructive",
        icon: actionIcons.discard,
        onPress: () => {
          if (sparkId) deleteCutUpSpark(sparkId);
          navigation.navigate("NotepadHome");
        },
      },
      {
        label: t("wordSparks.saveUnfinished"),
        style: "default",
        icon: actionIcons.bookmark,
        onPress: () => navigation.navigate("NotepadHome"),
      },
      { label: t("wordSparks.keepWorking"), style: "cancel" },
    ]);
  }, [spark?.savedLyricId, hasContent, sparkId, deleteCutUpSpark, navigation, t]);

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
    rtl,
    shuffle,
    resetOrder,
    moveScrap,
    poolAll,
    restoreAll,
    activeCount,
    pooledCount,
    undoBoard,
    redoBoard,
    canUndoBoard,
    canRedoBoard,
    toggleStripLock,
    duplicateStrip,
    removeStrip,
    restoreStrip,
    editStripText,
    splitStrip,
    setDraft,
    rebuildDraftFromBoard,
    composeDraft,
    saveAsLyrics,
    deleteSpark,
    goBack,
  };
}
