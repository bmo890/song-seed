import { useEffect, useMemo, useState } from "react";
import { Share } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { serializeChordChartText } from "../../../domain/chords";
import { serializeChordSheetText } from "../../../domain/chordSheet";
import type { SongbookItemKind, SongIdea, Workspace } from "../../../types";

export type SongbookChartChoice = { kind: SongbookItemKind; versionId?: string };

type PickerState = {
  songbookId: string;
  workspaceId: string | null;
  ideaId: string | null;
  selected: SongbookChartChoice[];
};

export type SongbookDisplayItem = {
  id: string;
  title: string;
  subtitle: string;
  metaLabel: string;
  available: boolean;
  onOpen: (() => void) | null;
};

function choiceKey(choice: SongbookChartChoice) {
  return `${choice.kind}:${choice.versionId ?? ""}`;
}

function findIdea(workspaces: Workspace[], ideaId: string): { workspace: Workspace; idea: SongIdea } | null {
  for (const workspace of workspaces) {
    const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
    if (idea) return { workspace, idea };
  }
  return null;
}

export function useSongbookModel() {
  const navigation = useNavigation<any>();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);

  const workspaces = useStore((s) => s.workspaces);
  const songbooks = useStore((s) => s.songbooks);
  const addSongbook = useStore((s) => s.addSongbook);
  const addItemsToSongbook = useStore((s) => s.addItemsToSongbook);
  const removeSongbookItem = useStore((s) => s.removeSongbookItem);
  const reorderSongbookItems = useStore((s) => s.reorderSongbookItems);
  const deleteSongbook = useStore((s) => s.deleteSongbook);

  const [selectedSongbookId, setSelectedSongbookId] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<PickerState | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const sortedSongbooks = useMemo(
    () => songbooks.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title)),
    [songbooks]
  );

  const activeSongbookId = pickerState?.songbookId ?? selectedSongbookId;
  const activeSongbook = songbooks.find((sb) => sb.id === activeSongbookId) ?? null;

  useEffect(() => {
    if (selectedSongbookId && !songbooks.some((sb) => sb.id === selectedSongbookId)) {
      setSelectedSongbookId(null);
    }
    if (pickerState && !songbooks.some((sb) => sb.id === pickerState.songbookId)) {
      setPickerState(null);
    }
  }, [pickerState, selectedSongbookId, songbooks]);

  const displayItems = useMemo<SongbookDisplayItem[]>(() => {
    if (!activeSongbook) return [];
    return activeSongbook.items.map((item) => {
      const resolved = findIdea(workspaces, item.ideaId);
      if (!resolved) {
        return {
          id: item.id,
          title: "Unavailable chart",
          subtitle: "Its song no longer exists in the library.",
          metaLabel: item.kind === "lyricChart" ? "LYRICS" : "CHORDS",
          available: false,
          onOpen: null,
        };
      }
      const { workspace, idea } = resolved;
      if (item.kind === "lyricChart") {
        const versionIndex = idea.lyrics?.versions.findIndex((v) => v.id === item.versionId) ?? -1;
        return {
          id: item.id,
          title: idea.title,
          subtitle: `${workspace.title} • ${versionIndex >= 0 ? `Version ${versionIndex + 1}` : "Lyrics"}`,
          metaLabel: "LYRICS",
          available: versionIndex >= 0,
          onOpen:
            versionIndex >= 0
              ? () => navigateRoot("LyricsVersion", { ideaId: idea.id, versionId: item.versionId })
              : null,
        };
      }
      return {
        id: item.id,
        title: idea.title,
        subtitle: `${workspace.title} • Chord chart`,
        metaLabel: "CHORDS",
        available: true,
        onOpen: () => navigateRoot("ChordSheet", { ideaId: idea.id }),
      };
    });
  }, [activeSongbook, workspaces]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Picker data ──────────────────────────────────────────────────────────
  const pickerWorkspaces = useMemo(
    () =>
      workspaces
        .filter((w) => !w.isArchived)
        .map((w) => ({
          id: w.id,
          title: w.title,
          songs: w.ideas.filter((idea) => idea.kind === "project"),
        }))
        .filter((w) => w.songs.length > 0),
    [workspaces]
  );

  const pickerCharts = useMemo(() => {
    if (!pickerState?.ideaId) return [];
    const resolved = findIdea(workspaces, pickerState.ideaId);
    if (!resolved) return [];
    const { idea } = resolved;
    const versions = idea.lyrics?.versions ?? [];
    const charts: Array<{ key: string; label: string; choice: SongbookChartChoice }> = versions.map(
      (version, index) => ({
        key: `lyricChart:${version.id}`,
        label: `Version ${index + 1} — lyrics`,
        choice: { kind: "lyricChart", versionId: version.id },
      })
    );
    charts.push({ key: "chordChart:", label: "Chord chart", choice: { kind: "chordChart" } });
    return charts;
  }, [pickerState?.ideaId, workspaces]);

  const pickerSongTitle = pickerState?.ideaId
    ? findIdea(workspaces, pickerState.ideaId)?.idea.title ?? null
    : null;

  const selectedKeys = useMemo(
    () => new Set((pickerState?.selected ?? []).map(choiceKey)),
    [pickerState?.selected]
  );

  const handleBack = () => {
    if (pickerState?.ideaId) {
      setPickerState((cur) => (cur ? { ...cur, ideaId: null, workspaceId: null, selected: [] } : cur));
      return;
    }
    if (pickerState) {
      setPickerState(null);
      return;
    }
    setSelectedSongbookId(null);
  };

  return {
    sortedSongbooks,
    activeSongbook,
    displayItems,
    pickerState,
    pickerWorkspaces,
    pickerCharts,
    pickerSongTitle,
    selectedKeys,
    showBack: !!activeSongbook || !!pickerState,
    createModalOpen,
    setCreateModalOpen,
    draftTitle,
    setDraftTitle,
    defaultTitle: `Songbook ${songbooks.length + 1}`,
    handleBack,
    openSongbook: (id: string) => setSelectedSongbookId(id),
    openCreate: () => {
      setDraftTitle("");
      setCreateModalOpen(true);
    },
    createSongbook: () => {
      const id = addSongbook(draftTitle.trim() || `Songbook ${songbooks.length + 1}`);
      setCreateModalOpen(false);
      setDraftTitle("");
      setSelectedSongbookId(id);
    },
    openPicker: () => {
      if (!activeSongbook) return;
      setPickerState({ songbookId: activeSongbook.id, workspaceId: null, ideaId: null, selected: [] });
    },
    pickerSelectSong: (workspaceId: string, ideaId: string) =>
      setPickerState((cur) => (cur ? { ...cur, workspaceId, ideaId, selected: [] } : cur)),
    pickerToggle: (choice: SongbookChartChoice) =>
      setPickerState((cur) => {
        if (!cur) return cur;
        const key = choiceKey(choice);
        const exists = cur.selected.some((c) => choiceKey(c) === key);
        return {
          ...cur,
          selected: exists ? cur.selected.filter((c) => choiceKey(c) !== key) : [...cur.selected, choice],
        };
      }),
    confirmPicker: () => {
      if (!pickerState || !pickerState.ideaId || !pickerState.workspaceId) return;
      const { songbookId, ideaId, workspaceId, selected } = pickerState;
      if (selected.length === 0) {
        setPickerState(null);
        return;
      }
      addItemsToSongbook(
        songbookId,
        selected.map((choice) => ({
          kind: choice.kind,
          workspaceId,
          ideaId,
          versionId: choice.versionId,
        }))
      );
      setPickerState(null);
    },
    shareSongbook: () => {
      if (!activeSongbook) return;
      const blocks: string[] = [];
      for (const item of activeSongbook.items) {
        const resolved = findIdea(workspaces, item.ideaId);
        if (!resolved) continue;
        const { idea } = resolved;
        if (item.kind === "lyricChart") {
          const version = idea.lyrics?.versions.find((v) => v.id === item.versionId);
          if (!version) continue;
          blocks.push(`# ${idea.title}\n${serializeChordChartText(version.document.lines)}`);
        } else if (idea.chordSheet) {
          blocks.push(`# ${idea.title} — chords\n${serializeChordSheetText(idea.chordSheet)}`);
        }
      }
      const text = blocks.join("\n\n\n").trim();
      if (!text) {
        AppAlert.info("Nothing to share", "Add some charts with content first.");
        return;
      }
      void Share.share({ title: activeSongbook.title, message: text });
    },
    removeItem: (itemId: string) => activeSongbook && removeSongbookItem(activeSongbook.id, itemId),
    reorderItems: (orderedIds: string[]) =>
      activeSongbook && reorderSongbookItems(activeSongbook.id, orderedIds),
    deleteActiveSongbook: () => {
      if (!activeSongbook) return;
      deleteSongbook(activeSongbook.id);
      setSelectedSongbookId(null);
    },
  };
}
