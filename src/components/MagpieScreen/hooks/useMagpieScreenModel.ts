import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { toast } from "../../common/toastStore";
import { sparkSaveTitle } from "../../../domain/notepad";
import { useUndoHistory } from "../../common/useUndoHistory";
import { actionIcons } from "../../common/actionIcons";
import {
  addFragments,
  assembleDraft,
  deriveMagpieTitle,
  drawPage,
  editFragmentText,
  MagpieFetchError,
  type MagpieFetchErrorKind,
  mergeFragmentWithNext,
  removeFragment as removeFragmentOp,
  reorderFragments,
  splitFragment as splitFragmentOp,
} from "../../../domain/magpie";
import type { MagpieFragment, MagpieLanguage, MagpieStep } from "../../../types";
import type { MagpieHeGenre } from "../../../config/magpieService";
import { useMagpiePrefsStore } from "../../../state/useMagpiePrefsStore";
import { useTranslation } from "react-i18next";

type LoadStatus = { loading: boolean; error: MagpieFetchErrorKind | null };

export function useMagpieScreenModel() {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const sparkId = route.params?.sparkId as string | undefined;

  const magpieSparks = useStore((s) => s.magpieSparks);
  const updateMagpieSpark = useStore((s) => s.updateMagpieSpark);
  const heGenres = useMagpiePrefsStore((s) => s.heGenres);
  const toggleHeGenrePref = useMagpiePrefsStore((s) => s.toggleHeGenre);
  const deleteMagpieSpark = useStore((s) => s.deleteMagpieSpark);
  const addNote = useStore((s) => s.addNote);
  const notes = useStore((s) => s.notes);
  const updateNote = useStore((s) => s.updateNote);

  const spark = magpieSparks.find((item) => item.id === sparkId) ?? null;
  const step: MagpieStep = spark?.step ?? "page";

  const [status, setStatus] = useState<LoadStatus>({ loading: false, error: null });
  // Guards against the mount effect firing a second auto-load; the in-flight
  // request id lets a newer draw supersede a slow older one.
  const requestSeq = useRef(0);
  const autoLoadedRef = useRef(false);

  const apply = useCallback(
    (updates: Parameters<typeof updateMagpieSpark>[1]) => {
      if (!sparkId) return;
      updateMagpieSpark(sparkId, updates);
    },
    [sparkId, updateMagpieSpark]
  );

  // ── Fetching a page ─────────────────────────────────────────────────────────
  const load = useCallback(
    async (
      mode: "book" | "page",
      overrides?: { language?: MagpieLanguage; heGenres?: MagpieHeGenre[] }
    ) => {
      if (!spark) return;
      const seq = ++requestSeq.current;
      setStatus({ loading: true, error: null });
      try {
        // Overrides let a just-changed setting (language, genres) take effect on
        // this draw without waiting for the store round-trip / re-render.
        const effective = {
          ...spark,
          heGenres: overrides?.heGenres ?? heGenres,
          ...overrides,
        };
        const { book, pageText } = await drawPage(effective, mode);
        if (seq !== requestSeq.current) return; // superseded by a newer draw
        apply({ book, pageText });
        setStatus({ loading: false, error: null });
      } catch (err) {
        if (seq !== requestSeq.current) return;
        const kind = err instanceof MagpieFetchError ? err.kind : "unavailable";
        setStatus({ loading: false, error: kind });
      }
    },
    [spark, apply, heGenres]
  );

  const newBook = useCallback(() => void load("book"), [load]);
  const newPage = useCallback(() => void load("page"), [load]);
  const retry = useCallback(() => void load(spark?.book ? "page" : "book"), [load, spark?.book]);

  // First open (or a spark whose page never loaded): pull a page automatically.
  useEffect(() => {
    if (!spark || autoLoadedRef.current) return;
    if (!spark.book || !spark.pageText) {
      autoLoadedRef.current = true;
      void load("book");
    } else {
      autoLoadedRef.current = true;
    }
  }, [spark, load]);

  const setWholeLibrary = useCallback(
    (wholeLibrary: boolean) => {
      apply({ wholeLibrary });
    },
    [apply]
  );

  // Switching source language clears the current page and immediately draws a
  // fresh one from the new library (the passage on screen is in the old language).
  const setLanguage = useCallback(
    (language: MagpieLanguage) => {
      if (!spark || spark.language === language) return;
      apply({ language, book: null, pageText: "" });
      void load("book", { language });
    },
    [spark, apply, load]
  );

  // Changing the Hebrew genre selection is an app-wide preference; in Hebrew mode
  // it also redraws the current page from the new genre set.
  const toggleHeGenre = useCallback(
    (genre: MagpieHeGenre) => {
      toggleHeGenrePref(genre);
      if (spark?.language === "he") {
        const next = useMagpiePrefsStore.getState().heGenres;
        apply({ book: null, pageText: "" });
        void load("book", { heGenres: next });
      }
    },
    [toggleHeGenrePref, spark?.language, apply, load]
  );

  // Undo/redo over the collection (collect, remove, split, merge, reorder).
  const restoreFragments = useCallback(
    (fragments: MagpieFragment[]) => apply({ fragments }),
    [apply]
  );
  const fragmentHistory = useUndoHistory(spark?.fragments ?? [], restoreFragments);

  // ── Collecting words ────────────────────────────────────────────────────────
  const pocketPhrases = useCallback(
    (phrases: string[]) => {
      if (!spark || phrases.length === 0) return;
      fragmentHistory.record(spark.fragments);
      const fragments = addFragments(spark.fragments, phrases, spark.book);
      apply({ fragments, title: deriveMagpieTitle({ draft: spark.draft, fragments }) });
    },
    [spark, apply, fragmentHistory]
  );

  const removeFragment = useCallback(
    (id: string) => {
      if (!spark) return;
      fragmentHistory.record(spark.fragments);
      apply({
        fragments: removeFragmentOp(spark.fragments, id),
        usedFragmentIds: spark.usedFragmentIds.filter((used) => used !== id),
      });
    },
    [spark, apply, fragmentHistory]
  );

  const splitFragment = useCallback(
    (id: string) => {
      if (!spark) return;
      // The pieces are new fragments — drop the old id from the used tally.
      fragmentHistory.record(spark.fragments);
      apply({
        fragments: splitFragmentOp(spark.fragments, id),
        usedFragmentIds: spark.usedFragmentIds.filter((used) => used !== id),
      });
    },
    [spark, apply, fragmentHistory]
  );

  const mergeFragment = useCallback(
    (id: string) => {
      if (!spark) return;
      fragmentHistory.record(spark.fragments);
      apply({ fragments: mergeFragmentWithNext(spark.fragments, id) });
    },
    [spark, apply, fragmentHistory]
  );

  // ── The "used" tally (build-step palette) ─────────────────────────────────────
  // Marked when a scrap is dropped into the draft; a soft cue, never bound to the
  // draft text. `mark` is additive (idempotent); `clear` lets the writer un-tick.
  const markFragmentUsed = useCallback(
    (id: string) => {
      if (!spark || spark.usedFragmentIds.includes(id)) return;
      apply({ usedFragmentIds: [...spark.usedFragmentIds, id] });
    },
    [spark, apply]
  );

  const clearFragmentUsed = useCallback(
    (id: string) => {
      if (!spark) return;
      apply({ usedFragmentIds: spark.usedFragmentIds.filter((used) => used !== id) });
    },
    [spark, apply]
  );

  const editFragment = useCallback(
    (id: string, text: string) => {
      if (!spark) return;
      apply({ fragments: editFragmentText(spark.fragments, id, text) });
    },
    [spark, apply]
  );

  const reorder = useCallback(
    (orderedIds: string[]) => {
      if (!spark) return;
      fragmentHistory.record(spark.fragments);
      apply({ fragments: reorderFragments(spark.fragments, orderedIds) });
    },
    [spark, apply, fragmentHistory]
  );

  // ── Wizard nav + draft ──────────────────────────────────────────────────────
  const goToStep = useCallback(
    (next: MagpieStep) => {
      if (!spark) return;
      if (next === "build" && !spark.draft.trim()) {
        apply({ step: next, draft: assembleDraft(spark.fragments) });
      } else {
        apply({ step: next });
      }
    },
    [spark, apply]
  );

  const markHelpSeen = useCallback(
    (which: MagpieStep) => {
      if (!spark || spark.seenHelpSteps.includes(which)) return;
      apply({ seenHelpSteps: [...spark.seenHelpSteps, which] });
    },
    [spark, apply]
  );

  const setDraft = useCallback(
    (draft: string) => {
      if (!spark) return;
      apply({ draft, title: deriveMagpieTitle({ draft, fragments: spark.fragments }) });
    },
    [spark, apply]
  );

  const rebuildDraft = useCallback(() => {
    if (!spark) return;
    apply({ draft: assembleDraft(spark.fragments) });
  }, [spark, apply]);

  // Pour every scrap into the (blank) draft in order, and mark them all used.
  const pourScraps = useCallback(() => {
    if (!spark) return;
    apply({
      draft: assembleDraft(spark.fragments),
      usedFragmentIds: spark.fragments.map((f) => f.id),
    });
  }, [spark, apply]);

  // ── Save / delete ───────────────────────────────────────────────────────────
  const saveAsLyrics = useCallback(() => {
    if (!spark) return;
    const text = (spark.draft.trim() ? spark.draft : assembleDraft(spark.fragments)).trim();
    if (!text) {
      AppAlert.info(t("wordSparks.nothingSave"), t("magpie.nothingBody"));
      return;
    }
    const noteId = addNote();
    updateNote(noteId, { title: sparkSaveTitle(spark.title, t("wordSparks.magpie"), notes), body: text });
    // Saving completes the exercise: the page in the pad is now the real thing,
    // so the scaffolding leaves the Sparks tab.
    toast(t("wordSparks.savedToPad"), "checkmark-outline");
    navigation.navigate("NotepadHome", { noteId, openToken: Date.now() });
    if (sparkId) deleteMagpieSpark(sparkId);
  }, [spark, sparkId, notes, addNote, updateNote, deleteMagpieSpark, navigation, t]);

  const deleteSpark = useCallback(() => {
    if (!sparkId) return;
    AppAlert.destructive(
      t("magpie.deleteTitle"),
      t("magpie.deleteBody"),
      () => {
        deleteMagpieSpark(sparkId);
        navigation.navigate("NotepadHome");
      },
      { confirmLabel: t("wordSparks.delete") }
    );
  }, [deleteMagpieSpark, sparkId, navigation, t]);

  const hasContent =
    !!spark && (spark.fragments.length > 0 || spark.draft.trim().length > 0);

  const goBack = useCallback(() => {
    if (spark?.savedLyricId) {
      navigation.navigate("NotepadHome");
      return;
    }
    if (!hasContent) {
      if (sparkId) deleteMagpieSpark(sparkId);
      navigation.navigate("NotepadHome");
      return;
    }
    AppAlert.custom(t("wordSparks.saveUnfinishedTitle"), t("wordSparks.saveUnfinishedBody"), [
      {
        label: t("wordSparks.discard"),
        style: "destructive",
        icon: actionIcons.discard,
        onPress: () => {
          if (sparkId) deleteMagpieSpark(sparkId);
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
  }, [spark?.savedLyricId, hasContent, sparkId, deleteMagpieSpark, navigation, t]);

  // Intercept hardware back + drawer-switch blur, mirroring the Cut-Up spark: an
  // empty, unsaved spark is silently discarded so it doesn't litter the notebook.
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
          deleteMagpieSpark(snapshot.sparkId);
        }
      };
    }, [deleteMagpieSpark])
  );

  return {
    spark,
    step,
    status,
    newBook,
    newPage,
    retry,
    setWholeLibrary,
    setLanguage,
    heGenres,
    toggleHeGenre,
    pocketPhrases,
    removeFragment,
    splitFragment,
    mergeFragment,
    markFragmentUsed,
    clearFragmentUsed,
    editFragment,
    reorder,
    goToStep,
    markHelpSeen,
    setDraft,
    rebuildDraft,
    pourScraps,
    saveAsLyrics,
    fragmentHistory,
    deleteSpark,
    goBack,
  };
}
