import { useMemo, useState } from "react";
import { Share } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { AppAlert } from "../common/AppAlert";
import { formatDate } from "../../utils";
import { buildChordDisplay, sortedPalette, type ChordParts } from "../../chords";
import {
  createChordSheet,
  createMeasure,
  createSection,
  serializeChordSheetText,
} from "../../chordSheet";
import { shareChordSheetPdf } from "../../services/chordChartPdf";
import type { ChordSheet, SongIdea } from "../../types";

type PickerTarget = { sectionId: string; measureId: string };

export function useChordSheetModel() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const ideaId = route.params?.ideaId as string | undefined;

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

  const removeMeasure = (sectionId: string, measureId: string) =>
    mutateSection(sectionId, (s) => ({ ...s, measures: s.measures.filter((m) => m.id !== measureId) }));

  const clearMeasure = (sectionId: string, measureId: string) =>
    mutateSection(sectionId, (s) => ({
      ...s,
      measures: s.measures.map((m) => (m.id === measureId ? { ...m, chords: [] } : m)),
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
        m.id === pickerTarget.measureId ? { ...m, chords: [...m.chords, display] } : m
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
    removeSection,
    renameSection,
    setSectionNotes,
    moveSection,
    addMeasure,
    removeMeasure,
    clearMeasure,
    openPicker,
    closePicker,
    addChord,
    exportPdf,
    exportText,
    goBack: () => navigation.goBack(),
  };
}
