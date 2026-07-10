import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import {
  addFragments,
  assembleDraft,
  deriveMagpieTitle,
  editFragmentText,
  fetchPassage,
  MagpieFetchError,
  type MagpieFetchErrorKind,
  pickBook,
  removeFragment as removeFragmentOp,
  reorderFragments,
  splitFragment as splitFragmentOp,
} from "../../../magpie";
import type { MagpieBook, MagpieStep } from "../../../types";

type LoadStatus = { loading: boolean; error: MagpieFetchErrorKind | null };

export function useMagpieScreenModel() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const sparkId = route.params?.sparkId as string | undefined;

  const magpieSparks = useStore((s) => s.magpieSparks);
  const updateMagpieSpark = useStore((s) => s.updateMagpieSpark);
  const deleteMagpieSpark = useStore((s) => s.deleteMagpieSpark);
  const addNote = useStore((s) => s.addNote);
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
    async (mode: "book" | "page") => {
      if (!spark) return;
      const seq = ++requestSeq.current;
      setStatus({ loading: true, error: null });
      try {
        let book: MagpieBook | null = spark.book;
        if (mode === "book" || !book) book = await pickBook(spark.wholeLibrary);
        const pageText = await fetchPassage(book);
        if (seq !== requestSeq.current) return; // superseded by a newer draw
        apply({ book, pageText });
        setStatus({ loading: false, error: null });
      } catch (err) {
        if (seq !== requestSeq.current) return;
        const kind = err instanceof MagpieFetchError ? err.kind : "unavailable";
        setStatus({ loading: false, error: kind });
      }
    },
    [spark, apply]
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

  // ── Pocketing + the pile ────────────────────────────────────────────────────
  const pocketPhrases = useCallback(
    (phrases: string[]) => {
      if (!spark || phrases.length === 0) return;
      const fragments = addFragments(spark.fragments, phrases, spark.book);
      apply({ fragments, title: deriveMagpieTitle({ draft: spark.draft, fragments }) });
    },
    [spark, apply]
  );

  const removeFragment = useCallback(
    (id: string) => {
      if (!spark) return;
      apply({ fragments: removeFragmentOp(spark.fragments, id) });
    },
    [spark, apply]
  );

  const splitFragment = useCallback(
    (id: string) => {
      if (!spark) return;
      apply({ fragments: splitFragmentOp(spark.fragments, id) });
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
      apply({ fragments: reorderFragments(spark.fragments, orderedIds) });
    },
    [spark, apply]
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

  // ── Save / delete ───────────────────────────────────────────────────────────
  const saveAsLyrics = useCallback(() => {
    if (!spark) return;
    const text = (spark.draft.trim() ? spark.draft : assembleDraft(spark.fragments)).trim();
    if (!text) {
      AppAlert.info("Nothing to save", "Pocket a few words and build a draft first.");
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
      "Delete this Magpie?",
      "Its collected words and draft will be gone for good.",
      () => {
        deleteMagpieSpark(sparkId);
        navigation.navigate("NotepadHome");
      },
      { confirmLabel: "Delete" }
    );
  }, [deleteMagpieSpark, sparkId, navigation]);

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
    AppAlert.custom("Save as unfinished?", "Keep this exercise to come back to, or discard it.", [
      {
        label: "Discard",
        style: "destructive",
        icon: actionIcons.discard,
        onPress: () => {
          if (sparkId) deleteMagpieSpark(sparkId);
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
  }, [spark?.savedLyricId, hasContent, sparkId, deleteMagpieSpark, navigation]);

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
    pocketPhrases,
    removeFragment,
    splitFragment,
    editFragment,
    reorder,
    goToStep,
    markHelpSeen,
    setDraft,
    rebuildDraft,
    saveAsLyrics,
    deleteSpark,
    goBack,
  };
}
