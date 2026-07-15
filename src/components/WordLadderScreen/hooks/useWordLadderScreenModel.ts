import { useCallback, useMemo, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import {
  addWord,
  createPairing,
  deriveExerciseTitle,
  dropPairingsForRemovedWords,
  removePairing,
  removeWord,
  shufflePairings,
  toggleLock,
  updateWordText,
} from "../../../domain/wordLadder";
import type { WordLadderStep, WordLadderWord } from "../../../types";

export function useWordLadderScreenModel() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const exerciseId = route.params?.exerciseId as string | undefined;

  const wordLadders = useStore((s) => s.wordLadders);
  const updateWordLadder = useStore((s) => s.updateWordLadder);
  const deleteWordLadder = useStore((s) => s.deleteWordLadder);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);

  const exercise = useMemo(
    () => wordLadders.find((item) => item.id === exerciseId) ?? null,
    [wordLadders, exerciseId]
  );

  const [armedWord, setArmedWord] = useState<{ column: "a" | "b"; wordId: string } | null>(null);

  const apply = useCallback(
    (updates: Parameters<typeof updateWordLadder>[1]) => {
      if (!exerciseId) return;
      updateWordLadder(exerciseId, updates);
    },
    [exerciseId, updateWordLadder]
  );

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
      apply({ roleSeed, title: deriveExerciseTitle(roleSeed, exercise.placeSeed) });
    },
    [apply, exercise]
  );

  const setPlaceSeed = useCallback(
    (placeSeed: string) => {
      if (!exercise) return;
      apply({ placeSeed, title: deriveExerciseTitle(exercise.roleSeed, placeSeed) });
    },
    [apply, exercise]
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
      apply({ pairings: [...exercise.pairings, createPairing(columnAWordId, columnBWordId)] });
      setArmedWord(null);
    },
    [apply, armedWord, exercise]
  );

  const unpairWord = useCallback(
    (pairingId: string) => {
      if (!exercise) return;
      apply({ pairings: removePairing(exercise.pairings, pairingId) });
    },
    [apply, exercise]
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
    apply({ pairings: shufflePairings(exercise) });
  }, [apply, exercise]);

  const setDraft = useCallback(
    (draft: string) => {
      apply({ draft });
    },
    [apply]
  );

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

  const setRevision = useCallback(
    (revision: string) => {
      apply({ revision });
    },
    [apply]
  );

  const deleteExercise = useCallback(() => {
    if (!exerciseId) return;
    AppAlert.destructive(
      "Delete this Word Ladder?",
      "Its words, pairings, and poem will be gone for good.",
      () => {
        deleteWordLadder(exerciseId);
        navigation.navigate("NotepadHome");
      },
      { confirmLabel: "Delete" }
    );
  }, [deleteWordLadder, exerciseId, navigation]);

  /** Saves the revision (falling back to the draft) as a new page in the global
   * Lyrics Pad, then opens it there. */
  const saveAsLyrics = useCallback(() => {
    if (!exercise) return;
    const text = (exercise.revision.trim() ? exercise.revision : exercise.draft).trim();
    if (!text) {
      AppAlert.info("Nothing to save", "Write and revise a few lines first.");
      return;
    }
    const noteId = addNote();
    updateNote(noteId, { title: exercise.title, body: text });
    apply({ savedLyricId: noteId });
    navigation.navigate("NotepadHome", { noteId, openToken: Date.now() });
  }, [exercise, addNote, updateNote, apply, navigation]);

  const hasContent =
    !!exercise &&
    (exercise.roleSeed.trim().length > 0 ||
      exercise.placeSeed.trim().length > 0 ||
      exercise.columnA.length > 0 ||
      exercise.columnB.length > 0 ||
      exercise.draft.trim().length > 0 ||
      exercise.revision.trim().length > 0);

  const goBack = useCallback(() => {
    // Already saved to the Lyrics Pad → just leave (the exercise stays for resuming).
    if (exercise?.savedLyricId) {
      navigation.navigate("NotepadHome");
      return;
    }

    // A freshly-opened spark with nothing in it should not linger in the pad —
    // discard the auto-created record rather than silently keeping it.
    if (!hasContent) {
      if (exerciseId) deleteWordLadder(exerciseId);
      navigation.navigate("NotepadHome");
      return;
    }

    AppAlert.custom("Save as unfinished?", "Keep this exercise to come back to, or discard it.", [
      {
        label: "Discard",
        style: "destructive",
        icon: actionIcons.discard,
        onPress: () => {
          if (exerciseId) deleteWordLadder(exerciseId);
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
  }, [exercise?.savedLyricId, hasContent, exerciseId, deleteWordLadder, navigation]);

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
    armedWord,
    setRoleSeed,
    setPlaceSeed,
    addColumnWord,
    editColumnWord,
    reorderColumnWords,
    removeColumnWord,
    handleWordTapForPairing,
    unpairWord,
    toggleLockPairing,
    shuffle,
    setDraft,
    toggleSparkUsed,
    setRevision,
    deleteExercise,
    saveAsLyrics,
    goBack,
  };
}
