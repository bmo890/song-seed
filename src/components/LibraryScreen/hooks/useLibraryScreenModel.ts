import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { AppBreadcrumbItem } from "../../common/AppBreadcrumbs";
import { useStore } from "../../../state/useStore";
import type { Playlist } from "../../../types";
import {
  buildCollectionPathLabel,
  findPlaylist,
  resolvePlaylistClip,
  resolvePlaylistIdea,
  sortWorkspacesWithPrimary,
} from "../../../libraryNavigation";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import type { PlaylistDisplayItem, PlaylistPickerState } from "../types";

function buildDefaultPlaylistTitle(count: number) {
  return `Playlist ${count + 1}`;
}

export function useLibraryScreenModel() {
  useBrowseRootBackHandler();
  const navigation = useNavigation<any>();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);

  const workspaces = useStore((state) => state.workspaces);
  const playlists = useStore((state) => state.playlists);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const workspaceListOrder = useStore((state) => state.workspaceListOrder);
  const workspaceLastOpenedAt = useStore((state) => state.workspaceLastOpenedAt);
  const addPlaylist = useStore((state) => state.addPlaylist);
  const addItemsToPlaylist = useStore((state) => state.addItemsToPlaylist);
  const reorderPlaylistItems = useStore((state) => state.reorderPlaylistItems);
  const removePlaylistItem = useStore((state) => state.removePlaylistItem);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<PlaylistPickerState | null>(null);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlistDraftTitle, setPlaylistDraftTitle] = useState("");

  const activePlaylistId = pickerState?.playlistId ?? selectedPlaylistId;
  const activePlaylist = findPlaylist(playlists, activePlaylistId);
  const sortedPlaylists = useMemo(
    () => playlists.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title)),
    [playlists]
  );
  const pickerWorkspaceChoices = useMemo(
    () =>
      sortWorkspacesWithPrimary(
        workspaces.filter((workspace) => !workspace.isArchived),
        primaryWorkspaceId,
        workspaceListOrder,
        workspaceLastOpenedAt
      ),
    [primaryWorkspaceId, workspaceLastOpenedAt, workspaceListOrder, workspaces]
  );

  useEffect(() => {
    if (selectedPlaylistId && !activePlaylist && !pickerState) {
      setSelectedPlaylistId(null);
    }
    if (pickerState && !findPlaylist(playlists, pickerState.playlistId)) {
      setPickerState(null);
    }
  }, [activePlaylist, pickerState, playlists, selectedPlaylistId]);

  const playlistDisplayItems = useMemo<PlaylistDisplayItem[]>(() => {
    if (!activePlaylist) return [];

    return activePlaylist.items.map((item) => {
      if (item.kind === "song") {
        const resolvedIdea = resolvePlaylistIdea(workspaces, item);
        if (!resolvedIdea) {
          return {
            id: item.id,
            kind: item.kind,
            title: "Unavailable song",
            subtitle: "This song no longer exists in the library.",
            metaLabel: "SONG",
            available: false,
            workspaceId: null,
            ideaId: null,
          };
        }

        return {
          id: item.id,
          kind: item.kind,
          title: resolvedIdea.idea.title,
          subtitle: `${resolvedIdea.workspace.title} • ${buildCollectionPathLabel(
            resolvedIdea.workspace,
            item.collectionId
          )}`,
          metaLabel: "SONG",
          available: true,
          workspaceId: resolvedIdea.workspace.id,
          ideaId: resolvedIdea.idea.id,
        };
      }

      const resolvedClip = resolvePlaylistClip(workspaces, item);
      if (resolvedClip) {
        return {
          id: item.id,
          kind: item.kind,
          title: resolvedClip.clip.title,
          subtitle: `${resolvedClip.workspace.title} • ${buildCollectionPathLabel(
            resolvedClip.workspace,
            item.collectionId
          )}`,
          metaLabel: "CLIP",
          available: true,
          workspaceId: resolvedClip.workspace.id,
          ideaId: resolvedClip.idea.id,
        };
      }

      const resolvedIdea = resolvePlaylistIdea(workspaces, item);
      if (resolvedIdea && resolvedIdea.idea.kind === "clip") {
        return {
          id: item.id,
          kind: item.kind,
          title: resolvedIdea.idea.title,
          subtitle: `${resolvedIdea.workspace.title} • ${buildCollectionPathLabel(
            resolvedIdea.workspace,
            item.collectionId
          )}`,
          metaLabel: "CLIP",
          available: true,
          workspaceId: resolvedIdea.workspace.id,
          ideaId: resolvedIdea.idea.id,
        };
      }

      return {
        id: item.id,
        kind: item.kind,
        title: "Unavailable clip",
        subtitle: "This clip no longer exists in the library.",
        metaLabel: "CLIP",
        available: false,
        workspaceId: null,
        ideaId: null,
      };
    });
  }, [activePlaylist, workspaces]);

  const pageTitle = pickerState
    ? "Add to Playlist"
    : activePlaylist
      ? activePlaylist.title
      : "Library";
  const pageSubtitle = pickerState
    ? "Choose songs or clips, then return them to the playlist."
    : activePlaylist
      ? "Playlists are saved groups of songs and clips. They stay separate from the current queue."
      : "Playlists are saved groups of songs and clips. They do not replace the queue used inside ideas and songs.";

  const breadcrumbItems = useMemo<AppBreadcrumbItem[]>(() => {
    const items: AppBreadcrumbItem[] = [
      {
        key: "library",
        label: "Library",
        level: "library",
        active: !activePlaylist && !pickerState,
        onPress:
          activePlaylist || pickerState
            ? () => {
                setPickerState(null);
                setSelectedPlaylistId(null);
              }
            : undefined,
      },
    ];

    if (activePlaylist) {
      items.push({
        key: "playlist",
        label: activePlaylist.title,
        level: "library",
        active: !pickerState,
        onPress: pickerState ? () => setPickerState(null) : undefined,
      });
    }

    if (pickerState) {
      items.push({
        key: "picker",
        label: "Add Items",
        level: "library",
        active: true,
      });
    }

    return items;
  }, [activePlaylist, pickerState]);

  const handleBackPress = () => {
    if (pickerState?.songIdeaId) {
      setPickerState((current) => (current ? { ...current, songIdeaId: null } : current));
      return;
    }
    if (pickerState?.collectionId) {
      setPickerState((current) => (current ? { ...current, collectionId: null } : current));
      return;
    }
    if (pickerState?.workspaceId) {
      setPickerState((current) => (current ? { ...current, workspaceId: null } : current));
      return;
    }
    if (pickerState) {
      setPickerState(null);
      return;
    }
    setSelectedPlaylistId(null);
  };

  return {
    activeWorkspaceId,
    pageTitle,
    pageSubtitle,
    breadcrumbItems,
    showBack: !!activePlaylist || !!pickerState,
    sortedPlaylists,
    pickerWorkspaceChoices,
    activePlaylist,
    playlistDisplayItems,
    pickerState,
    setPickerState,
    playlistModalOpen,
    setPlaylistModalOpen,
    playlistDraftTitle,
    setPlaylistDraftTitle,
    defaultPlaylistTitle: buildDefaultPlaylistTitle(playlists.length),
    handleBackPress,
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
    openPicker: () =>
      setPickerState({
        playlistId: activePlaylist!.id,
        workspaceId: activeWorkspaceId ?? null,
        collectionId: null,
        songIdeaId: null,
        selectedItems: [],
      }),
    openPlaylistItem: (item: PlaylistDisplayItem) => {
      if (!item.available || !item.workspaceId || !item.ideaId) return;
      if (activeWorkspaceId !== item.workspaceId) {
        setActiveWorkspaceId(item.workspaceId);
      }
      setSelectedIdeaId(item.ideaId);
      navigateRoot("IdeaDetail", { ideaId: item.ideaId });
    },
    removePlaylistItem: (playlistId: string, itemId: string) => removePlaylistItem(playlistId, itemId),
    reorderPlaylistItems: (playlistId: string, orderedItemIds: string[]) =>
      reorderPlaylistItems(playlistId, orderedItemIds),
    confirmPicker: () => {
      if (!activePlaylist || !pickerState) return;
      addItemsToPlaylist(activePlaylist.id, pickerState.selectedItems);
      setPickerState(null);
    },
  };
}
