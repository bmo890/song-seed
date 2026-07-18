import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { findPlaylist } from "../../../domain/libraryNavigation";
import {
  buildPlaylistQueue,
  getPlaylistDurationMs,
  resolvePlaylistTracks,
  type PlaylistTrack,
} from "../../../domain/playlistPlayback";

function buildDefaultPlaylistTitle(count: number) {
  return `Playlist ${count + 1}`;
}

export function useLibraryScreenModel() {
  // NOTE: the browse-root back handler is registered by LibraryScreenContent (it must
  // stay active on every tab, not just while the playlists model is mounted).
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);

  const workspaces = useStore((state) => state.workspaces);
  const playlists = useStore((state) => state.playlists);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const playerTarget = useStore((state) => state.playerTarget);
  const playerIsPlaying = useStore((state) => state.playerIsPlaying);
  const addPlaylist = useStore((state) => state.addPlaylist);
  const reorderPlaylistItems = useStore((state) => state.reorderPlaylistItems);
  const removePlaylistItem = useStore((state) => state.removePlaylistItem);
  const renamePlaylistAction = useStore((state) => state.renamePlaylist);
  const deletePlaylistAction = useStore((state) => state.deletePlaylist);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);
  const startLibraryCollecting = useStore((state) => state.startLibraryCollecting);

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlistDraftTitle, setPlaylistDraftTitle] = useState("");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameDraftTitle, setRenameDraftTitle] = useState("");
  const [editMode, setEditMode] = useState(false);

  const activePlaylist = findPlaylist(playlists, selectedPlaylistId);
  const sortedPlaylists = useMemo(
    () => playlists.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title)),
    [playlists]
  );

  // Returning from a collecting session ("Done" on the collector banner) re-opens
  // the playlist that started it. openToken forces the effect on repeat visits.
  // (Songbook/setlist returns are handled by LibraryScreenContent's section
  // routing; this effect only claims playlist returns.)
  const openCollectionKind = route.params?.openCollectionKind as string | undefined;
  const openCollectionId = route.params?.openCollectionId as string | undefined;
  const openToken = route.params?.openToken as number | undefined;
  useEffect(() => {
    if (openCollectionKind !== "playlist" || !openCollectionId || !openToken) return;
    setSelectedPlaylistId(openCollectionId);
    (navigation as any).setParams({
      openCollectionKind: undefined,
      openCollectionId: undefined,
      openToken: undefined,
    });
  }, [navigation, openCollectionKind, openCollectionId, openToken]);

  useEffect(() => {
    if (selectedPlaylistId && !activePlaylist) {
      setSelectedPlaylistId(null);
    }
  }, [activePlaylist, selectedPlaylistId]);

  // Leaving the detail page (or switching playlists) always exits edit mode.
  useEffect(() => {
    setEditMode(false);
  }, [selectedPlaylistId]);

  const playlistTracks = useMemo<PlaylistTrack[]>(
    () => (activePlaylist ? resolvePlaylistTracks(workspaces, activePlaylist) : []),
    [activePlaylist, workspaces]
  );
  const playlistDurationMs = useMemo(() => getPlaylistDurationMs(playlistTracks), [playlistTracks]);

  // The track currently loaded in the player queue, for the now-playing row state.
  const nowPlayingItemId = useMemo(() => {
    if (!playerTarget) return null;
    return (
      playlistTracks.find(
        (track) =>
          track.queueItem?.ideaId === playerTarget.ideaId &&
          track.queueItem?.clipId === playerTarget.clipId
      )?.itemId ?? null
    );
  }, [playerTarget, playlistTracks]);

  const playFromTrack = (startItemId?: string) => {
    const { queue, startIndex } = buildPlaylistQueue(playlistTracks, startItemId);
    if (queue.length === 0) {
      AppAlert.info(
        "Nothing to play",
        "This playlist has no playable tracks yet. Add clips or songs first."
      );
      return;
    }
    const store = useStore.getState();
    store.requestInlineStop();
    store.setPlayerQueue(queue, startIndex, true);
  };

  const startCollecting = () => {
    if (!activePlaylist) return;
    startLibraryCollecting("playlist", activePlaylist.id, activePlaylist.title);
    navigation.navigate("WorkspaceStack", {
      screen: "Browse",
      params: activeWorkspaceId ? { workspaceId: activeWorkspaceId } : undefined,
    });
  };

  const openTrackLocation = (track: PlaylistTrack) => {
    if (!track.ideaId || !track.workspaceId) return;
    if (activeWorkspaceId !== track.workspaceId) {
      setActiveWorkspaceId(track.workspaceId);
    }
    setSelectedIdeaId(track.ideaId);
    navigateRoot("IdeaDetail", { ideaId: track.ideaId });
  };

  const confirmDeletePlaylist = () => {
    if (!activePlaylist) return;
    AppAlert.confirm(
      "Delete playlist?",
      `"${activePlaylist.title}" will be removed. The clips and songs inside it stay in your library.`,
      () => {
        deletePlaylistAction(activePlaylist.id);
        setSelectedPlaylistId(null);
      },
      { confirmLabel: "Delete" }
    );
  };

  return {
    activeWorkspaceId,
    pageTitle: activePlaylist ? "" : "Library",
    showBack: !!activePlaylist,
    sortedPlaylists,
    activePlaylist,
    playlistTracks,
    playlistDurationMs,
    nowPlayingItemId,
    playerIsPlaying,
    editMode,
    setEditMode,
    playlistModalOpen,
    setPlaylistModalOpen,
    playlistDraftTitle,
    setPlaylistDraftTitle,
    renameModalOpen,
    setRenameModalOpen,
    renameDraftTitle,
    setRenameDraftTitle,
    defaultPlaylistTitle: buildDefaultPlaylistTitle(playlists.length),
    handleBackPress: () => setSelectedPlaylistId(null),
    openPlaylist: (playlistId: string) => setSelectedPlaylistId(playlistId),
    openCreatePlaylist: () => {
      setPlaylistDraftTitle("");
      setPlaylistModalOpen(true);
    },
    createPlaylist: () => {
      const playlistId = addPlaylist(
        playlistDraftTitle.trim() || buildDefaultPlaylistTitle(playlists.length)
      );
      setPlaylistModalOpen(false);
      setPlaylistDraftTitle("");
      setSelectedPlaylistId(playlistId);
    },
    openRenamePlaylist: () => {
      if (!activePlaylist) return;
      setRenameDraftTitle(activePlaylist.title);
      setRenameModalOpen(true);
    },
    renamePlaylist: () => {
      if (!activePlaylist) return;
      renamePlaylistAction(activePlaylist.id, renameDraftTitle);
      setRenameModalOpen(false);
      setRenameDraftTitle("");
    },
    confirmDeletePlaylist,
    playFromTrack,
    togglePlayback: () => useStore.getState().requestPlayerToggle(),
    startCollecting,
    openTrackLocation,
    removePlaylistItem: (playlistId: string, itemId: string) => removePlaylistItem(playlistId, itemId),
    reorderPlaylistItems: (playlistId: string, orderedItemIds: string[]) =>
      reorderPlaylistItems(playlistId, orderedItemIds),
  };
}
