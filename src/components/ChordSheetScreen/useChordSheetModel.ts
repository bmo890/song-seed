import { useMemo, useState } from "react";
import { Share } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { AppAlert } from "../common/AppAlert";
import { formatDate } from "../../utils";
import { buildChordDisplay, sortedPalette, type ChordParts } from "../../chords";
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
} from "../../chordSheet";
import { getLatestLyricsVersion } from "../../lyrics";
import { shareChordSheetPdf } from "../../services/chordChartPdf";
import type { ChordSheet, SongIdea } from "../../types";

type PickerTarget = { sectionId: string; measureId: string };

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

  const [isEditing, setIsEditing] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const commit = (next: ChordSheet) => {
    if (!projectIdea) return;
    appActions.setSongChordSheet(projectIdea.id, next);
  };

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

  const openPicker = (sectionId: string, measureId: string) => setPickerTarget({ sectionId, measureId });
  const closePicker = () => setPickerTarget(null);

  const addChord = (parts: ChordParts) => {
    if (!projectIdea || !pickerTarget) return;
    const display = buildChordDisplay(parts);
    if (!display) return;
    mutateSection(pickerTarget.sectionId, (s) => ({
      ...s,
      measures: s.measures.map((m) =>
        // A bar holds up to MAX_CHORDS_PER_BAR chords.
        m.id === pickerTarget.measureId && m.chords.length < MAX_CHORDS_PER_BAR
          ? { ...m, chords: [...m.chords, display] }
          : m
      ),
    }));
    appActions.recordSongChord(projectIdea.id, parts);
    closePicker();
  };

  const subtitle = projectIdea ? `${projectIdea.title} · ${formatDate(sheet.updatedAt)}` : "";

  const exportPdf = async () => {
    if (!projectIdea) return;
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
    isEditing,
    setIsEditing,
    pickerTarget,
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
    openPicker,
    closePicker,
    addChord,
    exportPdf,
    exportText,
    goBack: () => navigation.goBack(),
  };
}
