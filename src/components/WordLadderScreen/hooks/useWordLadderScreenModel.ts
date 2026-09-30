import { useCallback, useMemo, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { useDraftText } from "../../../hooks/useDraftText";
import { AppAlert } from "../../common/AppAlert";
import { toast } from "../../common/toastStore";
import { sparkSaveTitle } from "../../../domain/notepad";
import { useUndoHistory } from "../../common/useUndoHistory";
import { actionIcons } from "../../common/actionIcons";
import {
  randomPlaceIdea,
  randomRoleIdea,
  suggestNouns,
  suggestVerbs,
} from "../../../domain/wordLadderIdeas";
import {
  addWord,
  createPairing,
  dropPairingsForRemovedWords,
  removePairing,
  removeWord,
  shufflePairings,
  toggleLock,
  updateWordText,
} from "../../../domain/wordLadder";
import type { WordLadderExercise, WordLadderStep, WordLadderWord } from "../../../types";
import { useTranslation } from "react-i18next";

export function useWordLadderScreenModel() {
  const { t, i18n } = useTranslation();
  const ideaLang = i18n.language === "he" ? "he" : "en";
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const exerciseId = route.params?.exerciseId as string | undefined;

  const wordLadders = useStore((s) => s.wordLadders);
  const updateWordLadder = useStore((s) => s.updateWordLadder);
  const deleteWordLadder = useStore((s) => s.deleteWordLadder);
  const addNote = useStore((s) => s.addNote);
  const notes = useStore((s) => s.notes);
  const updateNote = useStore((s) => s.updateNote);

  const exercise = useMemo(
    () => wordLadders.find((item) => item.id === exerciseId) ?? null,
    [wordLadders, exerciseId]
  );

  const [armedWord, setArmedWord] = useState<{ column: "a" | "b"; wordId: string } | null>(null);

  const translatedTitle = useCallback((roleValue: string, placeValue: string) => {
    const role = roleValue.trim();
    const place = placeValue.trim();
    if (role && place) return t("wordLadder.titleBoth", { role, place });
    if (role) return t("wordLadder.titleRole", { role });
    if (place) return t("wordLadder.titlePlace", { place });
    return t("wordLadder.untitled");
  }, [t]);

  // The poem fields commit on a pause, not per keystroke (useDraftText): a
  // character used to write the whole ladder into the store and notify every
  // mounted selector. Every other write lands the pending drafts first, so a
  // later commit can never overwrite what an action just wrote; the actions
  // that read the text read the local drafts, which are always current.
  const commitDraft = useCallback(
    (draft: string) => {
      if (exerciseId) updateWordLadder(exerciseId, { draft });
    },
    [exerciseId, updateWordLadder]
  );
  const commitRevision = useCallback(
    (revision: string) => {
      if (exerciseId) updateWordLadder(exerciseId, { revision });
    },
    [exerciseId, updateWordLadder]
  );
  const draftField = useDraftText(exercise?.draft ?? "", commitDraft);
  const revisionField = useDraftText(exercise?.revision ?? "", commitRevision);
  const flushDraft = draftField.flush;
  const flushRevision = revisionField.flush;
  const flushDrafts = useCallback(() => {
    flushDraft();
    flushRevision();
  }, [flushDraft, flushRevision]);

  const apply = useCallback(
    (updates: Parameters<typeof updateWordLadder>[1]) => {
      if (!exerciseId) return;
      flushDrafts();
      updateWordLadder(exerciseId, updates);
    },
    [exerciseId, updateWordLadder, flushDrafts]
  );

  // Undo/redo over the pairing board (connect, unpair, shuffle).
  const restorePairings = useCallback(
    (pairings: WordLadderExercise["pairings"]) => apply({ pairings }),
    [apply]
  );
  const pairingHistory = useUndoHistory(exercise?.pairings ?? [], restorePairings);

  // ── Wizard navigation ─────────────────────────────────────────────────────
  // "setup" is a one-way gate: once committed, the seeds are frozen and the
  // writer moves between pairing and the line draft. The current step is
  // persisted on the exercise so reopening resumes where they left off.
  const step: WordLadderStep = exercise?.step ?? "setup";

  const goToStep = useCallback(
    (next: WordLadderStep) => {
      apply({ step: next });
    },
    [apply]
  );

  /** Records that the current step's help has been opened, so its highlight can
   * recede to a quiet link on return visits. */
  const markHelpSeen = useCallback(
    (which: WordLadderStep) => {
      if (!exercise || exercise.seenHelpSteps.includes(which)) return;
      apply({ seenHelpSteps: [...exercise.seenHelpSteps, which] });
    },
    [apply, exercise]
  );

  const setRoleSeed = useCallback(
    (roleSeed: string) => {
      if (!exercise) return;
      apply({ roleSeed, title: translatedTitle(roleSeed, exercise.placeSeed) });
    },
    [apply, exercise, translatedTitle]
  );

  const setPlaceSeed = useCallback(
    (placeSeed: string) => {
      if (!exercise) return;
      apply({ placeSeed, title: translatedTitle(exercise.roleSeed, placeSeed) });
    },
    [apply, exercise, translatedTitle]
  );

  // ── Inspiration (setup step) ──────────────────────────────────────────────
  // One tap fills a seed with a curated random job/place; another sprinkles a
  // few matching words into a column. Everything stays editable.
  const surpriseRole = useCallback(() => {
    if (!exercise) return;
    const idea = randomRoleIdea(ideaLang, exercise.roleSeed);
    apply({ roleSeed: idea.seed, title: translatedTitle(idea.seed, exercise.placeSeed) });
  }, [apply, exercise, translatedTitle, ideaLang]);

  const surprisePlace = useCallback(() => {
    if (!exercise) return;
    const idea = randomPlaceIdea(ideaLang, exercise.placeSeed);
    apply({ placeSeed: idea.seed, title: translatedTitle(exercise.roleSeed, idea.seed) });
  }, [apply, exercise, translatedTitle, ideaLang]);

  const suggestColumnWords = useCallback(
    (column: "a" | "b") => {
      if (!exercise) return;
      if (column === "a") {
        const existing = exercise.columnA.map((word) => word.text);
        let columnA = exercise.columnA;
        for (const verb of suggestVerbs(ideaLang, exercise.roleSeed, existing, 4)) columnA = addWord(columnA, verb);
        apply({ columnA });
      } else {
        const existing = exercise.columnB.map((word) => word.text);
        let columnB = exercise.columnB;
        for (const noun of suggestNouns(ideaLang, exercise.placeSeed, existing, 4)) columnB = addWord(columnB, noun);
        apply({ columnB });
      }
    },
    [apply, exercise, ideaLang]
  );

  const addColumnWord = useCallback(
    (column: "a" | "b", text: string) => {
      if (!exercise) return;
      if (column === "a") apply({ columnA: addWord(exercise.columnA, text) });
      else apply({ columnB: addWord(exercise.columnB, text) });
    },
    [apply, exercise]
  );

  const editColumnWord = useCallback(
    (column: "a" | "b", wordId: string, text: string) => {
      if (!exercise) return;
      if (column === "a") apply({ columnA: updateWordText(exercise.columnA, wordId, text) });
      else apply({ columnB: updateWordText(exercise.columnB, wordId, text) });
    },
    [apply, exercise]
  );

  const reorderColumnWords = useCallback(
    (column: "a" | "b", words: WordLadderWord[]) => {
      if (column === "a") apply({ columnA: words });
      else apply({ columnB: words });
    },
    [apply]
  );

  const removeColumnWord = useCallback(
    (column: "a" | "b", wordId: string) => {
      if (!exercise) return;
      const columnA = column === "a" ? removeWord(exercise.columnA, wordId) : exercise.columnA;
      const columnB = column === "b" ? removeWord(exercise.columnB, wordId) : exercise.columnB;
      const pairings = dropPairingsForRemovedWords(exercise.pairings, columnA, columnB);
      apply({ columnA, columnB, pairings });
      setArmedWord((prev) => (prev && prev.wordId === wordId ? null : prev));
    },
    [apply, exercise]
  );

  /** Two-step tap-to-pair: tap a word in one column to arm it, then tap a word
   * in the other column to connect them. Tapping the same armed word again
   * disarms it. Tapping a word in the same column re-arms that one instead. */
  const handleWordTapForPairing = useCallback(
    (column: "a" | "b", wordId: string) => {
      if (!exercise) return;
      if (!armedWord) {
        setArmedWord({ column, wordId });
        return;
      }
      if (armedWord.column === column) {
        setArmedWord(armedWord.wordId === wordId ? null : { column, wordId });
        return;
      }
      const columnAWordId = armedWord.column === "a" ? armedWord.wordId : wordId;
      const columnBWordId = armedWord.column === "b" ? armedWord.wordId : wordId;
      pairingHistory.record(exercise.pairings);
      apply({ pairings: [...exercise.pairings, createPairing(columnAWordId, columnBWordId)] });
      setArmedWord(null);
    },
    [apply, armedWord, exercise, pairingHistory]
  );

  const unpairWord = useCallback(
    (pairingId: string) => {
      if (!exercise) return;
      pairingHistory.record(exercise.pairings);
      apply({ pairings: removePairing(exercise.pairings, pairingId) });
    },
    [apply, exercise, pairingHistory]
  );

  const toggleLockPairing = useCallback(
    (pairingId: string) => {
      if (!exercise) return;
      apply({ pairings: toggleLock(exercise.pairings, pairingId) });
    },
    [apply, exercise]
  );

  const shuffle = useCallback(() => {
    if (!exercise) return;
    pairingHistory.record(exercise.pairings);
    apply({ pairings: shufflePairings(exercise) });
  }, [apply, exercise, pairingHistory]);


  const toggleSparkUsed = useCallback(
    (pairingId: string) => {
      if (!exercise) return;
      const used = exercise.usedSparkIds.includes(pairingId)
        ? exercise.usedSparkIds.filter((id) => id !== pairingId)
        : [...exercise.usedSparkIds, pairingId];
      apply({ usedSparkIds: used });
    },
    [apply, exercise]
  );


  const deleteExercise = useCallback(() => {
    if (!exerciseId) return;
    AppAlert.destructive(
      t("wordLadder.deleteTitle"),
      t("wordLadder.deleteBody"),
      () => {
        deleteWordLadder(exerciseId);
        navigation.navigate("SparkHome");
      },
      { confirmLabel: t("wordSparks.delete") }
    );
  }, [deleteWordLadder, exerciseId, navigation, t]);

  /** Saves the revision (falling back to the draft) as a new page in the global
   * Lyrics Pad, then opens it there. */
  const draftText = draftField.draft;
  const revisionText = revisionField.draft;
  const saveAsLyrics = useCallback(() => {
    if (!exercise) return;
    flushDrafts();
    const text = (revisionText.trim() ? revisionText : draftText).trim();
    if (!text) {
      AppAlert.info(t("wordSparks.nothingSave"), t("wordLadder.nothingBody"));
      return;
    }
    const noteId = addNote();
    updateNote(noteId, { title: sparkSaveTitle(exercise.title, t("wordSparks.wordLadder"), notes), body: text });
    // Saving completes the exercise: the page in the pad is now the real thing,
    // so the scaffolding leaves the Sparks tab.
    toast(t("wordSparks.savedToPad"), "checkmark-outline");
    navigation.navigate("NotepadHome", { noteId, openToken: Date.now() });
    if (exerciseId) deleteWordLadder(exerciseId);
  }, [exercise, exerciseId, notes, addNote, updateNote, deleteWordLadder, navigation, t, flushDrafts, draftText, revisionText]);

  const hasContent =
    !!exercise &&
    (exercise.roleSeed.trim().length > 0 ||
      exercise.placeSeed.trim().length > 0 ||
      exercise.columnA.length > 0 ||
      exercise.columnB.length > 0 ||
      draftText.trim().length > 0 ||
      revisionText.trim().length > 0);

  const goBack = useCallback(() => {
    // Already saved to the Lyrics Pad → just leave (the exercise stays for resuming).
    if (exercise?.savedLyricId) {
      navigation.navigate("SparkHome");
      return;
    }

    // A freshly-opened spark with nothing in it should not linger in the pad —
    // discard the auto-created record rather than silently keeping it.
    if (!hasContent) {
      if (exerciseId) deleteWordLadder(exerciseId);
      navigation.navigate("SparkHome");
      return;
    }

    AppAlert.custom(t("wordSparks.saveUnfinishedTitle"), t("wordSparks.saveUnfinishedBody"), [
      {
        label: t("wordSparks.discard"),
        style: "destructive",
        icon: actionIcons.discard,
        onPress: () => {
          if (exerciseId) deleteWordLadder(exerciseId);
          navigation.navigate("SparkHome");
        },
      },
      {
        label: t("wordSparks.saveUnfinished"),
        style: "default",
        icon: actionIcons.bookmark,
        onPress: () => navigation.navigate("SparkHome"),
      },
      { label: t("wordSparks.keepWorking"), style: "cancel" },
    ]);
  }, [exercise?.savedLyricId, hasContent, exerciseId, deleteWordLadder, navigation, t]);

  // Catch every other way of leaving. Hardware back runs the same prompt as the
  // in-app Back button. A drawer switch can't be intercepted before it happens, so
  // on blur we silently discard an empty, unsaved spark (a started one is kept as
  // unfinished, like Lyrics Pad notes). Refs keep the focus effect from
  // re-subscribing on every keystroke — which would delete the spark mid-edit.
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const abandonRef = useRef({ exerciseId, savedLyricId: exercise?.savedLyricId ?? null, hasContent });
  abandonRef.current = { exerciseId, savedLyricId: exercise?.savedLyricId ?? null, hasContent };

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBackRef.current();
        return true;
      });
      return () => {
        sub.remove();
        const snapshot = abandonRef.current;
        if (snapshot.exerciseId && !snapshot.savedLyricId && !snapshot.hasContent) {
          deleteWordLadder(snapshot.exerciseId);
        }
      };
    }, [deleteWordLadder])
  );

  return {
    exercise,
    step,
    goToStep,
    markHelpSeen,
    pairingHistory,
    armedWord,
    setRoleSeed,
    surpriseRole,
    surprisePlace,
    suggestColumnWords,
    setPlaceSeed,
    addColumnWord,
    editColumnWord,
    reorderColumnWords,
    removeColumnWord,
    handleWordTapForPairing,
    unpairWord,
    toggleLockPairing,
    shuffle,
    draftField,
    toggleSparkUsed,
    revisionField,
    deleteExercise,
    saveAsLyrics,
    goBack,
  };
}
