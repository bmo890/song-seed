import { useEffect, useMemo, useState } from "react";
import { Share } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { serializeChordChartText } from "../../../domain/chords";
import { serializeChordSheetText } from "../../../domain/chordSheet";
import {
  flattenGroupedOrder,
  groupSongbookItems,
  type SongbookSong,
} from "../../../domain/songbookGrouping";
import { useMiniPlayerContext } from "../../../hooks/FullPlayerProvider";
import type { SongbookItemKind, SongIdea, Workspace } from "../../../types";

export type SongbookChartChoice = { kind: SongbookItemKind; versionId?: string };

type PickerState = {
  songbookId: string;
  workspaceId: string | null;
  ideaId: string | null;
  selected: SongbookChartChoice[];
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
  const renameSongbook = useStore((s) => s.renameSongbook);
  const deleteSongbook = useStore((s) => s.deleteSongbook);

  const [selectedSongbookId, setSelectedSongbookId] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<PickerState | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
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

  // One row per song — the "book of my songs" — grouped from the flat items.
  const songs = useMemo<SongbookSong[]>(
    () => (activeSongbook ? groupSongbookItems(activeSongbook, workspaces) : []),
    [activeSongbook, workspaces]
  );

  const inlinePlayer = useMiniPlayerContext();
  const playerTarget = useStore((s) => s.playerTarget);
  const isPlayerPlaying = useStore((s) => s.playerIsPlaying);

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

  // The song whose reference audio is loaded in the dock (row highlight).
  const nowPlayingIdeaId = playerTarget?.ideaId ?? null;

  return {
    sortedSongbooks,
    activeSongbook,
    songs,
    nowPlayingIdeaId,
    isPlayerPlaying,

    /** Open the full-screen reader, optionally at a specific song. */
    openReader: (startIdeaId?: string) => {
      if (!activeSongbook) return;
      navigateRoot("SongbookReader", { songbookId: activeSongbook.id, startIdeaId });
    },

    /** Play a song's reference audio in the dock without leaving the page. */
    playSongAudio: (song: SongbookSong) => {
      if (!song.playableClip) return;
      void inlinePlayer.resetInlinePlayer();
      const store = useStore.getState();
      if (nowPlayingIdeaId === song.ideaId) {
        store.requestPlayerToggle();
        return;
      }
      store.setPlayerQueue([{ ideaId: song.ideaId, clipId: song.playableClip.id }], 0, true);
    },

    /** Remove a whole song (all its charts) from the book, after confirming. */
    removeSong: (song: SongbookSong) => {
      if (!activeSongbook) return;
      AppAlert.destructive(
        "Remove from this book?",
        `"${song.title}" and its ${song.charts.length === 1 ? "chart" : "charts"} leave the book. The song itself stays in your library.`,
        () => {
          for (const chart of song.charts) removeSongbookItem(activeSongbook.id, chart.itemId);
        },
        { confirmLabel: "Remove" }
      );
    },

    /** Persist a drag-reorder of song rows back onto the flat item list. */
    reorderSongs: (orderedIdeaIds: string[]) => {
      if (!activeSongbook) return;
      const byIdeaId = new Map(songs.map((song) => [song.ideaId, song]));
      const ordered = orderedIdeaIds
        .map((ideaId) => byIdeaId.get(ideaId))
        .filter((song): song is SongbookSong => !!song);
      reorderSongbookItems(activeSongbook.id, flattenGroupedOrder(ordered));
    },
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
    renameModalOpen,
    setRenameModalOpen,
    openRename: () => {
      if (!activeSongbook) return;
      setDraftTitle(activeSongbook.title);
      setRenameModalOpen(true);
    },
    renameActiveSongbook: () => {
      if (!activeSongbook) return;
      const title = draftTitle.trim();
      if (title) renameSongbook(activeSongbook.id, title);
      setRenameModalOpen(false);
      setDraftTitle("");
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
    deleteActiveSongbook: () => {
      if (!activeSongbook) return;
      deleteSongbook(activeSongbook.id);
      setSelectedSongbookId(null);
    },
  };
}
