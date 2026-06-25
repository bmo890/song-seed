import { useCallback, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { AppAlert } from "../../common/AppAlert";
import {
  addWord,
  createLineFromPairing,
  createPairing,
  deriveExerciseTitle,
  dropPairingsForRemovedWords,
  getColumnALabel,
  removePairing,
  removeWord,
  shufflePairings,
  toggleLock,
  updateWordText,
} from "../../../wordLadder";
import type { WordLadderLine, WordLadderMode, WordLadderWord } from "../../../types";

export type WordLadderTab = "words" | "pairings" | "lines";

export function useWordLadderScreenModel() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const exerciseId = route.params?.exerciseId as string | undefined;

  const wordLadders = useStore((s) => s.wordLadders);
  const updateWordLadder = useStore((s) => s.updateWordLadder);
  const deleteWordLadder = useStore((s) => s.deleteWordLadder);
  const workspaces = useStore((s) => s.workspaces);

  const exercise = useMemo(
    () => wordLadders.find((item) => item.id === exerciseId) ?? null,
    [wordLadders, exerciseId]
  );

  const [activeTab, setActiveTab] = useState<WordLadderTab>("words");
  const [armedWord, setArmedWord] = useState<{ column: "a" | "b"; wordId: string } | null>(null);
  const [songExportVisible, setSongExportVisible] = useState(false);

  const apply = useCallback(
    (updates: Parameters<typeof updateWordLadder>[1]) => {
      if (!exerciseId) return;
      updateWordLadder(exerciseId, updates);
    },
    [exerciseId, updateWordLadder]
  );

  const setMode = useCallback(
    (mode: WordLadderMode) => {
      if (!exercise) return;
      apply({
        mode,
        columnALabel: getColumnALabel(mode),
        title: deriveExerciseTitle(mode, exercise.seedLabel),
      });
    },
    [apply, exercise]
  );

  const setSeedLabel = useCallback(
    (seedLabel: string) => {
      if (!exercise) return;
      apply({ seedLabel, title: deriveExerciseTitle(exercise.mode, seedLabel) });
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

  const makeLineFromPairing = useCallback(
    (pairingId: string) => {
      if (!exercise) return;
      const pairing = exercise.pairings.find((p) => p.id === pairingId);
      if (!pairing) return;
      const line = createLineFromPairing(exercise.mode, pairing, exercise.columnA, exercise.columnB);
      if (!line) return;
      apply({ lines: [...exercise.lines, line] });
      setActiveTab("lines");
    },
    [apply, exercise]
  );

  const updateLineText = useCallback(
    (lineId: string, text: string) => {
      if (!exercise) return;
      apply({ lines: exercise.lines.map((line) => (line.id === lineId ? { ...line, text } : line)) });
    },
    [apply, exercise]
  );

  const toggleStarLine = useCallback(
    (lineId: string) => {
      if (!exercise) return;
      apply({
        lines: exercise.lines.map((line) =>
          line.id === lineId ? { ...line, starred: !line.starred } : line
        ),
      });
    },
    [apply, exercise]
  );

  const reorderLines = useCallback(
    (lines: WordLadderLine[]) => {
      apply({ lines });
    },
    [apply]
  );

  const deleteLine = useCallback(
    (lineId: string) => {
      if (!exercise) return;
      apply({ lines: exercise.lines.filter((line) => line.id !== lineId) });
    },
    [apply, exercise]
  );

  const deleteExercise = useCallback(() => {
    if (!exerciseId) return;
    AppAlert.destructive(
      "Delete this Word Ladder?",
      "Its words, pairings, and lines will be gone for good.",
      () => {
        deleteWordLadder(exerciseId);
        navigation.navigate("NotepadHome");
      },
      { confirmLabel: "Delete" }
    );
  }, [deleteWordLadder, exerciseId, navigation]);

  const songOptions = useMemo(
    () =>
      workspaces.flatMap((workspace) =>
        workspace.ideas
          .filter((idea) => idea.kind === "project")
          .map((idea) => ({
            workspaceTitle: workspace.title,
            songId: idea.id,
            songTitle: idea.title,
          }))
      ),
    [workspaces]
  );

  const sendLinesToSong = useCallback(
    (songId: string) => {
      if (!exercise) return;
      const starred = exercise.lines.filter((line) => line.starred && line.text.trim());
      const source = starred.length > 0 ? starred : exercise.lines.filter((line) => line.text.trim());
      const text = source.map((line) => line.text.trim()).join("\n");
      if (!text) {
        AppAlert.info("Nothing to send", "Write or star at least one line first.");
        return;
      }
      appActions.saveProjectLyricsAsNewVersion(songId, text);
      setSongExportVisible(false);
      const songTitle = songOptions.find((opt) => opt.songId === songId)?.songTitle ?? "the song";
      AppAlert.info("Sent to song", `${source.length} line${source.length === 1 ? "" : "s"} added to "${songTitle}" as new lyrics.`);
    },
    [exercise, songOptions]
  );

  return {
    exercise,
    activeTab,
    setActiveTab,
    armedWord,
    songExportVisible,
    setSongExportVisible,
    songOptions,
    setMode,
    setSeedLabel,
    addColumnWord,
    editColumnWord,
    reorderColumnWords,
    removeColumnWord,
    handleWordTapForPairing,
    unpairWord,
    toggleLockPairing,
    shuffle,
    makeLineFromPairing,
    updateLineText,
    toggleStarLine,
    reorderLines,
    deleteLine,
    deleteExercise,
    sendLinesToSong,
    goBack: () => navigation.navigate("NotepadHome"),
  };
}
