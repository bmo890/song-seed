import { useEffect, useMemo, useRef, useState } from "react";
import { Share } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { AppAlert } from "../common/AppAlert";
import { formatDate } from "../../utils";
import { buildChordDisplay, parseChordDisplay, sortedPalette, type ChordParts } from "../../domain/chords";
import {
  buildChordSheetFromLyrics,
  createChordSheet,
  createMeasure,
  createSection,
  createTextBlock,
  isChordSheetEmpty,
  serializeChordSheetText,
  splitMeasureChords,
  MAX_CHORDS_PER_BAR,
  SECTION_PRESETS,
} from "../../domain/chordSheet";
import { getLatestLyricsVersion } from "../../domain/lyrics";
import { shareChordSheetPdf } from "../../services/chordChartPdf";
import { ensurePro } from "../common/proUpsell";
import type { ChordSheet, SongIdea } from "../../types";

// index === null adds a chord to the bar; a number edits the chord at that index.
type PickerTarget = { sectionId: string; measureId: string; index: number | null };
type BarEditorTarget = { sectionId: string; measureId: string };

export function useChordSheetModel(ideaIdOverride?: string) {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const ideaId = ideaIdOverride ?? (route.params?.ideaId as string | undefined);

  const workspaces = useStore((s) => s.workspaces);

  const projectIdea = useMemo<SongIdea | null>(() => {
    for (const workspace of workspaces) {
      const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
      if (idea) return idea.kind === "project" ? idea : null;
    }
    return null;
  }, [workspaces, ideaId]);

  const sheet = projectIdea?.chordSheet ?? createChordSheet();
  const palette = useMemo(() => sortedPalette(projectIdea?.chordPalette), [projectIdea?.chordPalette]);

  // Autocomplete corpus for renaming sections: the presets plus every section
  // label the writer has actually used across their charts (custom names too).
  const labelSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (label: string) => {
      const trimmed = label.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) return;
      seen.add(key);
      out.push(trimmed);
    };
    SECTION_PRESETS.forEach(add);
    for (const workspace of workspaces) {
      for (const idea of workspace.ideas) {
        if (idea.kind !== "project") continue;
        for (const section of idea.chordSheet?.sections ?? []) {
          if (section.kind !== "text") add(section.label);
        }
      }
    }
    return out;
  }, [workspaces]);

  const [isEditing, setIsEditing] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [barEditor, setBarEditor] = useState<BarEditorTarget | null>(null);

  // Undo/redo history for the editing session (snapshots of the whole chart).
  const pastRef = useRef<ChordSheet[]>([]);
  const futureRef = useRef<ChordSheet[]>([]);
  const [, bumpHistory] = useState(0);

  const applySheet = (next: ChordSheet) => {
    if (!projectIdea) return;
    appActions.setSongChordSheet(projectIdea.id, next);
  };

  const commit = (next: ChordSheet) => {
    if (!projectIdea) return;
    pastRef.current = [...pastRef.current.slice(-49), sheet];
    futureRef.current = [];
    bumpHistory((v) => v + 1);
    applySheet(next);
  };

  const undo = () => {
    const past = pastRef.current;
    if (!past.length || !projectIdea) return;
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, sheet];
    bumpHistory((v) => v + 1);
    applySheet(past[past.length - 1]);
  };

  const redo = () => {
    const future = futureRef.current;
    if (!future.length || !projectIdea) return;
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, sheet];
    bumpHistory((v) => v + 1);
    applySheet(future[future.length - 1]);
  };

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const mutateSection = (sectionId: string, updater: (section: ChordSheet["sections"][number]) => ChordSheet["sections"][number]) => {
    commit({
      ...sheet,
      sections: sheet.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    });
  };

  const addSection = (label: string) => commit({ ...sheet, sections: [...sheet.sections, createSection(label)] });

  const addTextBlock = () => commit({ ...sheet, sections: [...sheet.sections, createTextBlock()] });

  const setBlockText = (sectionId: string, text: string) =>
    mutateSection(sectionId, (s) => ({ ...s, text }));

  const removeSection = (sectionId: string) =>
    commit({ ...sheet, sections: sheet.sections.filter((section) => section.id !== sectionId) });

  const renameSection = (sectionId: string, label: string) => mutateSection(sectionId, (s) => ({ ...s, label }));

  const setSectionNotes = (sectionId: string, notes: string) =>
    mutateSection(sectionId, (s) => ({ ...s, notes }));

  const moveSection = (sectionId: string, dir: -1 | 1) => {
    const index = sheet.sections.findIndex((s) => s.id === sectionId);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= sheet.sections.length) return;
    const next = [...sheet.sections];
    [next[index], next[target]] = [next[target], next[index]];
    commit({ ...sheet, sections: next });
  };

  const addMeasure = (sectionId: string) =>
    mutateSection(sectionId, (s) => ({ ...s, measures: [...s.measures, createMeasure()] }));

  const insertMeasure = (sectionId: string, atIndex: number) =>
    mutateSection(sectionId, (s) => {
      const measures = [...s.measures];
      measures.splice(Math.max(0, Math.min(measures.length, atIndex)), 0, createMeasure());
      return { ...s, measures };
    });

  const splitMeasure = (sectionId: string, measureId: string) =>
    mutateSection(sectionId, (s) => {
      const index = s.measures.findIndex((m) => m.id === measureId);
      if (index < 0) return s;
      const split = splitMeasureChords(s.measures[index]);
      if (split.length <= 1) return s;
      return { ...s, measures: [...s.measures.slice(0, index), ...split, ...s.measures.slice(index + 1)] };
    });

  const removeMeasure = (sectionId: string, measureId: string) =>
    mutateSection(sectionId, (s) => ({ ...s, measures: s.measures.filter((m) => m.id !== measureId) }));

  const removeMeasures = (sectionId: string, measureIds: string[]) => {
    const ids = new Set(measureIds);
    mutateSection(sectionId, (s) => ({ ...s, measures: s.measures.filter((m) => !ids.has(m.id)) }));
  };

  /** Insert bars (built fresh from `chordsList`) at `atIndex` — used for paste. */
  const insertMeasuresAt = (sectionId: string, atIndex: number, chordsList: string[][]) =>
    mutateSection(sectionId, (s) => {
      const measures = [...s.measures];
      const clampedIndex = Math.max(0, Math.min(measures.length, atIndex));
      measures.splice(clampedIndex, 0, ...chordsList.map((chords) => createMeasure([...chords])));
      return { ...s, measures };
    });

  /** Build the whole chart from the song's latest lyrics version (chords packed
   *  into bars, sections split on blank lines). Confirms before replacing a
   *  non-empty chart. */
  const buildFromLyrics = () => {
    if (!projectIdea) return;
    const built = buildChordSheetFromLyrics(getLatestLyricsVersion(projectIdea));
    if (built.sections.length === 0) {
      AppAlert.info(
        "No chords in lyrics",
        "Add chords to a lyrics version first, then build the chart from it."
      );
      return;
    }
    const apply = () => {
      commit(built);
      if (!isEditing) setIsEditing(true);
    };
    if (!isChordSheetEmpty(sheet)) {
      AppAlert.destructive(
        "Replace chart?",
        "Build a fresh chart from the latest lyrics? This replaces the current chart.",
        apply,
        { confirmLabel: "Replace" }
      );
      return;
    }
    apply();
  };

  const clearMeasure = (sectionId: string, measureId: string) =>
    mutateSection(sectionId, (s) => ({
      ...s,
      measures: s.measures.map((m) => (m.id === measureId ? { ...m, chords: [] } : m)),
    }));

  const clearMeasures = (sectionId: string, measureIds: string[]) => {
    const ids = new Set(measureIds);
    mutateSection(sectionId, (s) => ({
      ...s,
      measures: s.measures.map((m) => (ids.has(m.id) ? { ...m, chords: [] } : m)),
    }));
  };

  const removeChordAt = (sectionId: string, measureId: string, index: number) =>
    mutateSection(sectionId, (s) => ({
      ...s,
      measures: s.measures.map((m) =>
        m.id === measureId ? { ...m, chords: m.chords.filter((_, i) => i !== index) } : m
      ),
    }));

  // Tapping a bar opens a focused editor for just that bar; the chord picker is
  // launched from there to add (index null) or change/delete one chord (index n).
  const openBarEditor = (sectionId: string, measureId: string) => setBarEditor({ sectionId, measureId });
  const closeBarEditor = () => setBarEditor(null);

  const barEditorMeasure = barEditor
    ? sheet.sections.find((s) => s.id === barEditor.sectionId)?.measures.find((m) => m.id === barEditor.measureId) ??
      null
    : null;

  const openChordPicker = (sectionId: string, measureId: string, index: number | null) =>
    setPickerTarget({ sectionId, measureId, index });
  const closePicker = () => setPickerTarget(null);

  const pickerMode: "add" | "edit" = pickerTarget?.index != null ? "edit" : "add";
  const pickerInitial: ChordParts | null =
    pickerTarget && pickerTarget.index != null
      ? parseChordDisplay(
          sheet.sections
            .find((s) => s.id === pickerTarget.sectionId)
            ?.measures.find((m) => m.id === pickerTarget.measureId)?.chords[pickerTarget.index] ?? ""
        )
      : null;

  // ── Bar selection (shared by the staff and the screen-level selection dock) ──
  // Scoped to one section so insert/paste/delete targets stay unambiguous.
  const [barSelection, setBarSelection] = useState<{ sectionId: string; measureIds: string[] } | null>(null);
  const [barClipboard, setBarClipboard] = useState<string[][] | null>(null);

  // Leaving edit mode (Done, tab change, blur) drops any selection and the undo
  // history, so each edit session starts clean.
  useEffect(() => {
    if (!isEditing) {
      setBarSelection(null);
      pastRef.current = [];
      futureRef.current = [];
    }
  }, [isEditing]);

  const toggleBarSelection = (sectionId: string, measureId: string) =>
    setBarSelection((prev) => {
      if (!prev || prev.sectionId !== sectionId) return { sectionId, measureIds: [measureId] };
      const measureIds = prev.measureIds.includes(measureId)
        ? prev.measureIds.filter((id) => id !== measureId)
        : [...prev.measureIds, measureId];
      return measureIds.length ? { sectionId, measureIds } : null;
    });

  const clearBarSelection = () => setBarSelection(null);

  const barSelectionSection = barSelection
    ? sheet.sections.find((s) => s.id === barSelection.sectionId) ?? null
    : null;

  const selectedBarIndices = () => {
    if (!barSelection || !barSelectionSection) return [] as number[];
    return barSelection.measureIds
      .map((id) => barSelectionSection.measures.findIndex((m) => m.id === id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
  };

  const addBarBeforeSelection = () => {
    if (!barSelection) return;
    const idx = selectedBarIndices();
    insertMeasure(barSelection.sectionId, idx[0] ?? 0);
  };

  const addBarAfterSelection = () => {
    if (!barSelection) return;
    const idx = selectedBarIndices();
    insertMeasure(barSelection.sectionId, (idx[idx.length - 1] ?? -1) + 1);
  };

  const clearSelectedBars = () => {
    if (!barSelection) return;
    clearMeasures(barSelection.sectionId, barSelection.measureIds);
  };

  const deleteSelectedBars = () => {
    if (!barSelection) return;
    removeMeasures(barSelection.sectionId, barSelection.measureIds);
    setBarSelection(null);
  };

  const copySelectedBars = () => {
    if (!barSelection || !barSelectionSection) return;
    const ids = barSelection.measureIds;
    setBarClipboard(
      barSelectionSection.measures.filter((m) => ids.includes(m.id)).map((m) => [...m.chords])
    );
  };

  const cutSelectedBars = () => {
    copySelectedBars();
    deleteSelectedBars();
  };

  const pasteBars = () => {
    if (!barSelection || !barClipboard?.length) return;
    const idx = selectedBarIndices();
    insertMeasuresAt(barSelection.sectionId, (idx[idx.length - 1] ?? -1) + 1, barClipboard);
    setBarSelection(null);
  };

  const splitSelectedBar = () => {
    if (!barSelection || barSelection.measureIds.length !== 1) return;
    splitMeasure(barSelection.sectionId, barSelection.measureIds[0]);
    setBarSelection(null);
  };

  const selectedBarCount = barSelection?.measureIds.length ?? 0;
  const canSplitSelection =
    selectedBarCount === 1 &&
    (barSelectionSection?.measures.find((m) => m.id === barSelection?.measureIds[0])?.chords.length ?? 0) > 1;
  const canPaste = !!barClipboard?.length;

  const saveChord = (parts: ChordParts) => {
    if (!projectIdea || !pickerTarget) return;
    const display = buildChordDisplay(parts);
    if (!display) return;
    const { measureId, index } = pickerTarget;
    mutateSection(pickerTarget.sectionId, (s) => ({
      ...s,
      measures: s.measures.map((m) => {
        if (m.id !== measureId) return m;
        if (index == null) {
          // A bar holds up to MAX_CHORDS_PER_BAR chords.
          return m.chords.length < MAX_CHORDS_PER_BAR ? { ...m, chords: [...m.chords, display] } : m;
        }
        return { ...m, chords: m.chords.map((c, i) => (i === index ? display : c)) };
      }),
    }));
    appActions.recordSongChord(projectIdea.id, parts);
    closePicker();
  };

  // Delete the chord currently being edited in the picker (its onDelete).
  const removeEditingChord = () => {
    if (!pickerTarget || pickerTarget.index == null) {
      closePicker();
      return;
    }
    removeChordAt(pickerTarget.sectionId, pickerTarget.measureId, pickerTarget.index);
    closePicker();
  };

  const subtitle = projectIdea ? `${projectIdea.title} · ${formatDate(sheet.updatedAt)}` : "";

  const exportPdf = async () => {
    if (!projectIdea) return;
    if (!ensurePro("pdf-export")) return;
    try {
      const ok = await shareChordSheetPdf({ title: projectIdea.title, subtitle, sheet });
      if (!ok) AppAlert.info("Nothing to export", "Add a section with some chords first.");
    } catch {
      AppAlert.info("Export failed", "Couldn't create the PDF. Please try again.");
    }
  };

  const exportText = () => {
    if (!projectIdea) return;
    const text = serializeChordSheetText(sheet);
    if (!text.trim()) {
      AppAlert.info("Nothing to share", "Add a section with some chords first.");
      return;
    }
    void Share.share({ title: `${projectIdea.title} — chord chart`, message: text });
  };

  return {
    projectIdea,
    sheet,
    palette,
    labelSuggestions,
    isEditing,
    setIsEditing,
    pickerTarget,
    pickerMode,
    pickerInitial,
    barEditor,
    barEditorMeasure,
    addSection,
    addTextBlock,
    setBlockText,
    removeSection,
    renameSection,
    setSectionNotes,
    moveSection,
    addMeasure,
    insertMeasure,
    insertMeasuresAt,
    splitMeasure,
    removeMeasure,
    removeMeasures,
    clearMeasure,
    clearMeasures,
    removeChordAt,
    buildFromLyrics,
    undo,
    redo,
    canUndo,
    canRedo,
    openBarEditor,
    closeBarEditor,
    openChordPicker,
    closePicker,
    saveChord,
    removeEditingChord,
    barSelection,
    selectedBarCount,
    canSplitSelection,
    canPaste,
    toggleBarSelection,
    clearBarSelection,
    addBarBeforeSelection,
    addBarAfterSelection,
    clearSelectedBars,
    deleteSelectedBars,
    copySelectedBars,
    cutSelectedBars,
    pasteBars,
    splitSelectedBar,
    exportPdf,
    exportText,
    goBack: () => navigation.goBack(),
  };
}
