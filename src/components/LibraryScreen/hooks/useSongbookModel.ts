import { useEffect, useMemo, useState } from "react";
import { Share } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
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
import { createSongbookShareLink, shareSongbookFile } from "../../../services/songbookShare";
import { presentShareLink } from "../../../services/shareLinkFlow";
import type { SongIdea, Workspace } from "../../../types";

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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const sortedSongbooks = useMemo(
    () => songbooks.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title)),
    [songbooks]
  );

  const activeSongbook = songbooks.find((sb) => sb.id === selectedSongbookId) ?? null;

  useEffect(() => {
    if (selectedSongbookId && !songbooks.some((sb) => sb.id === selectedSongbookId)) {
      setSelectedSongbookId(null);
    }
  }, [selectedSongbookId, songbooks]);

  // Collector-return / import deep-link: open the named songbook.
  const route = useRoute<any>();
  const openCollectionKind = route.params?.openCollectionKind as string | undefined;
  const openCollectionId = route.params?.openCollectionId as string | undefined;
  const openToken = route.params?.openToken as number | undefined;
  useEffect(() => {
    if (openCollectionKind !== "songbook" || !openCollectionId || !openToken) return;
    setSelectedSongbookId(openCollectionId);
    (navigation as any).setParams({
      openCollectionKind: undefined,
      openCollectionId: undefined,
      openToken: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCollectionKind, openCollectionId, openToken]);

  // One row per song — the "book of my songs" — grouped from the flat items.
  const songs = useMemo<SongbookSong[]>(
    () => (activeSongbook ? groupSongbookItems(activeSongbook, workspaces) : []),
    [activeSongbook, workspaces]
  );

  const inlinePlayer = useMiniPlayerContext();
  const playerTarget = useStore((s) => s.playerTarget);
  const isPlayerPlaying = useStore((s) => s.playerIsPlaying);

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
    showBack: !!activeSongbook,
    handleBack: () => setSelectedSongbookId(null),
    createModalOpen,
    setCreateModalOpen,
    draftTitle,
    setDraftTitle,
    defaultTitle: `Songbook ${songbooks.length + 1}`,
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
    /** "Add songs" — a collecting session out in the real collections: browse,
     *  preview, multi-select; the dock's action adds each song's default charts. */
    startCollecting: () => {
      if (!activeSongbook) return;
      useStore.getState().startLibraryCollecting("songbook", activeSongbook.id, activeSongbook.title);
      navigation.navigate("WorkspaceStack", {
        screen: "Browse",
        params: undefined,
      });
    },
    /** Share as an importable .zip archive — the receiver gets a real songbook. */
    shareSongbookFile: async () => {
      if (!activeSongbook) return;
      try {
        const ok = await shareSongbookFile(activeSongbook, workspaces);
        if (!ok) AppAlert.info("Nothing to share", "Add some charts with content first.");
      } catch {
        AppAlert.info("Share failed", "Couldn't build the songbook file. Please try again.");
      }
    },
    /** Upload the songbook to Songstead Send and copy a shareable link. */
    getLinkForActiveSongbook: async () => {
      if (!activeSongbook) return;
      await presentShareLink(() => createSongbookShareLink(activeSongbook, workspaces), {
        emptyMessage: "Add some charts with content first.",
      });
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
