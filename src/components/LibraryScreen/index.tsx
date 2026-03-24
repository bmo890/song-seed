import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs, type AppBreadcrumbItem } from "../common/AppBreadcrumbs";
import { Button } from "../common/Button";
import { PageIntro } from "../common/PageIntro";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../common/SelectionDock";
import { QuickNameModal } from "../modals/QuickNameModal";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import type {
  Playlist,
  PlaylistItemKind,
  Workspace,
} from "../../types";
import {
  buildCollectionPathLabel,
  buildWorkspaceBrowseEntries,
  findPlaylist,
  getCollectionLastWorkedAt,
  getIdeaPrimaryClip,
  resolvePlaylistClip,
  resolvePlaylistIdea,
  sortWorkspacesWithPrimary,
} from "../../libraryNavigation";
import { compareIdeas } from "../../ideaSort";
import { getCollectionById } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";

type PlaylistPickerSelection = {
  kind: PlaylistItemKind;
  workspaceId: string;
  collectionId: string;
  ideaId: string;
  clipId?: string | null;
};

type PlaylistPickerState = {
  playlistId: string;
  workspaceId: string | null;
  collectionId: string | null;
  songIdeaId: string | null;
  selectedItems: PlaylistPickerSelection[];
};

type PlaylistDisplayItem = {
  id: string;
  kind: PlaylistItemKind;
  title: string;
  subtitle: string;
  metaLabel: string;
  available: boolean;
  workspaceId: string | null;
  ideaId: string | null;
};

function buildDefaultPlaylistTitle(count: number) {
  return `Playlist ${count + 1}`;
}

function buildPickerSelectionKey(selection: PlaylistPickerSelection) {
  return [
    selection.kind,
    selection.workspaceId,
    selection.collectionId,
    selection.ideaId,
    selection.clipId ?? "",
  ].join(":");
}

function formatPlaylistUpdatedAt(timestamp: number) {
  const now = Date.now();
  const ageHours = Math.max(0, Math.floor((now - timestamp) / 3600000));
  if (ageHours < 1) return "Updated just now";
  if (ageHours < 24) return `Updated ${ageHours}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 7) return `Updated ${ageDays}d ago`;
  return `Updated ${new Date(timestamp).toLocaleDateString("en-US")}`;
}

function getPlaylistItemTypeLabel(kind: PlaylistItemKind) {
  return kind === "song" ? "SONG" : "CLIP";
}

function getPlaylistItemTypeIcon(kind: PlaylistItemKind) {
  return kind === "song" ? getHierarchyIconName("song") : getHierarchyIconName("clip");
}

export function LibraryScreen() {
  useBrowseRootBackHandler();
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.();
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
            metaLabel: getPlaylistItemTypeLabel(item.kind),
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
          metaLabel: getPlaylistItemTypeLabel(item.kind),
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
          metaLabel: getPlaylistItemTypeLabel(item.kind),
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
          metaLabel: getPlaylistItemTypeLabel(item.kind),
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
        metaLabel: getPlaylistItemTypeLabel(item.kind),
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

  const breadcrumbItems: AppBreadcrumbItem[] = [
    {
      key: "library",
      label: "Library",
      level: "library" as const,
      active: !activePlaylist && !pickerState,
      onPress: activePlaylist || pickerState ? () => {
        setPickerState(null);
        setSelectedPlaylistId(null);
      } : undefined,
    },
  ];

  if (activePlaylist) {
    breadcrumbItems.push({
      key: "playlist",
      label: activePlaylist.title,
      level: "library" as const,
      active: !pickerState,
      onPress: pickerState ? () => setPickerState(null) : undefined,
    });
  }

  if (pickerState) {
    breadcrumbItems.push({
      key: "picker",
      label: "Add Items",
      level: "library" as const,
      active: true,
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={pageTitle}
        leftIcon={activePlaylist || pickerState ? "back" : "hamburger"}
        onLeftPress={
          activePlaylist || pickerState
            ? () => {
                if (pickerState?.songIdeaId) {
                  setPickerState((current) =>
                    current ? { ...current, songIdeaId: null } : current
                  );
                  return;
                }
                if (pickerState?.collectionId) {
                  setPickerState((current) =>
                    current ? { ...current, collectionId: null } : current
                  );
                  return;
                }
                if (pickerState?.workspaceId) {
                  setPickerState((current) =>
                    current ? { ...current, workspaceId: null } : current
                  );
                  return;
                }
                if (pickerState) {
                  setPickerState(null);
                  return;
                }
                setSelectedPlaylistId(null);
              }
            : undefined
        }
      />
      {activePlaylist || pickerState ? <AppBreadcrumbs items={breadcrumbItems} /> : null}

      <PageIntro title={pageTitle} subtitle={pageSubtitle} />

      {!activePlaylist && !pickerState ? (
        <PlaylistListView
          playlists={sortedPlaylists}
          onCreatePlaylist={() => {
            setPlaylistDraftTitle("");
            setPlaylistModalOpen(true);
          }}
          onOpenPlaylist={(playlistId) => setSelectedPlaylistId(playlistId)}
        />
      ) : null}

      {activePlaylist && !pickerState ? (
        <PlaylistDetailView
          playlist={activePlaylist}
          displayItems={playlistDisplayItems}
          onAddItems={() =>
            setPickerState({
              playlistId: activePlaylist.id,
              workspaceId: activeWorkspaceId ?? null,
              collectionId: null,
              songIdeaId: null,
              selectedItems: [],
            })
          }
          onOpenItem={(item) => {
            if (!item.available || !item.workspaceId || !item.ideaId) return;
            if (activeWorkspaceId !== item.workspaceId) {
              setActiveWorkspaceId(item.workspaceId);
            }
            setSelectedIdeaId(item.ideaId);
            navigateRoot("IdeaDetail", { ideaId: item.ideaId });
          }}
          onRemoveItem={(itemId) => removePlaylistItem(activePlaylist.id, itemId)}
          onReorderItems={(orderedItemIds) => reorderPlaylistItems(activePlaylist.id, orderedItemIds)}
        />
      ) : null}

      {pickerState && activePlaylist ? (
        <PlaylistPickerView
          workspaces={pickerWorkspaceChoices}
          pickerState={pickerState}
          onChangePickerState={setPickerState}
          onCancel={() => setPickerState(null)}
          onConfirm={() => {
            addItemsToPlaylist(activePlaylist.id, pickerState.selectedItems);
            setPickerState(null);
          }}
        />
      ) : null}

      <QuickNameModal
        visible={playlistModalOpen}
        title="New Playlist"
        draftValue={playlistDraftTitle}
        placeholderValue={buildDefaultPlaylistTitle(playlists.length)}
        onChangeDraft={setPlaylistDraftTitle}
        onCancel={() => {
          setPlaylistModalOpen(false);
          setPlaylistDraftTitle("");
        }}
        onSave={() => {
          const playlistId = addPlaylist(
            playlistDraftTitle.trim() || buildDefaultPlaylistTitle(playlists.length)
          );
          setPlaylistModalOpen(false);
          setPlaylistDraftTitle("");
          setSelectedPlaylistId(playlistId);
        }}
        helperText="Playlists are global and can hold songs or clips from any workspace."
        saveLabel="Create"
      />
    </SafeAreaView>
  );
}

function PlaylistListView({
  playlists,
  onCreatePlaylist,
  onOpenPlaylist,
}: {
  playlists: Playlist[];
  onCreatePlaylist: () => void;
  onOpenPlaylist: (playlistId: string) => void;
}) {
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inputRow}>
        <Button label="Create Playlist" onPress={onCreatePlaylist} />
      </View>

      <View style={styles.listContent}>
        {playlists.map((playlist) => (
          <Pressable
            key={playlist.id}
            style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
            onPress={() => onOpenPlaylist(playlist.id)}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="list-outline" size={18} color="#0f172a" />
                <Text style={styles.cardTitle}>{playlist.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </View>
            <View style={styles.workspaceBrowseCollectionMetaRow}>
              <Text style={styles.cardMeta}>
                {playlist.items.length} {playlist.items.length === 1 ? "item" : "items"}
              </Text>
              <Text style={styles.cardMeta}>•</Text>
              <Text style={styles.cardMeta}>{formatPlaylistUpdatedAt(playlist.updatedAt)}</Text>
            </View>
          </Pressable>
        ))}

        {playlists.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No playlists yet</Text>
            <Text style={styles.cardMeta}>
              Create a playlist to collect songs and clips without changing the queue.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function PlaylistDetailView({
  playlist,
  displayItems,
  onAddItems,
  onOpenItem,
  onRemoveItem,
  onReorderItems,
}: {
  playlist: Playlist;
  displayItems: PlaylistDisplayItem[];
  onAddItems: () => void;
  onOpenItem: (item: PlaylistDisplayItem) => void;
  onRemoveItem: (itemId: string) => void;
  onReorderItems: (orderedItemIds: string[]) => void;
}) {
  return (
    <DraggableFlatList
      data={displayItems}
      keyExtractor={(item) => item.id}
      onDragEnd={({ data }) => onReorderItems(data.map((item) => item.id))}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.libraryDetailHeader}>
          <View style={styles.settingsSummaryPanel}>
            <Text style={styles.settingsSummaryTitle}>{playlist.title}</Text>
            <Text style={styles.settingsSummaryMeta}>
              {playlist.items.length} saved {playlist.items.length === 1 ? "item" : "items"}.
              Long press and drag the handle to reorder them. This playlist stays separate from the queue.
            </Text>
            <View style={styles.settingsActionRow}>
              <Button label="Add Items" onPress={onAddItems} />
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Playlist is empty</Text>
          <Text style={styles.cardMeta}>
            Add songs or clips to start organizing listening groups here.
          </Text>
        </View>
      }
      renderItem={({ item, drag, isActive }) => (
        <View
          style={[
            styles.libraryPlaylistItemRow,
            isActive ? styles.libraryPlaylistItemRowActive : null,
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.libraryPlaylistItemMain,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => onOpenItem(item)}
            disabled={!item.available}
          >
            <View style={styles.libraryPlaylistItemTitleRow}>
              <View style={styles.libraryPlaylistItemTypePill}>
                <Ionicons
                  name={getPlaylistItemTypeIcon(item.kind)}
                  size={11}
                  color={getHierarchyIconColor(item.kind === "song" ? "song" : "clip")}
                />
                <Text style={styles.libraryPlaylistItemTypeText}>{item.metaLabel}</Text>
              </View>
              {!item.available ? (
                <View style={styles.libraryPlaylistItemUnavailablePill}>
                  <Text style={styles.libraryPlaylistItemUnavailableText}>Missing</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>{item.subtitle}</Text>
          </Pressable>

          <View style={styles.libraryPlaylistItemActions}>
            <Pressable
              style={({ pressed }) => [
                styles.collectionInlineActionBtn,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onRemoveItem(item.id)}
            >
              <Ionicons name="close" size={14} color="#64748b" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.collectionInlineActionBtn,
                pressed ? styles.pressDown : null,
              ]}
              onLongPress={drag}
              delayLongPress={120}
            >
              <Ionicons name="reorder-three" size={15} color="#64748b" />
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

function PlaylistPickerView({
  workspaces,
  pickerState,
  onChangePickerState,
  onCancel,
  onConfirm,
}: {
  workspaces: Workspace[];
  pickerState: PlaylistPickerState;
  onChangePickerState: (next: PlaylistPickerState | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const workspace =
    pickerState.workspaceId
      ? workspaces.find((candidate) => candidate.id === pickerState.workspaceId) ?? null
      : null;
  const collection =
    workspace && pickerState.collectionId
      ? getCollectionById(workspace, pickerState.collectionId)
      : null;
  const collectionEntries = useMemo(
    () => (workspace ? buildWorkspaceBrowseEntries(workspace, "") : []),
    [workspace]
  );
  const childCollections = useMemo(() => {
    if (!workspace || !collection) return [];
    return workspace.collections
      .filter((candidate) => candidate.parentCollectionId === collection.id)
      .slice()
      .sort(
        (a, b) =>
          getCollectionLastWorkedAt(workspace, b.id) - getCollectionLastWorkedAt(workspace, a.id) ||
          a.title.localeCompare(b.title)
      );
  }, [collection, workspace]);
  const collectionIdeas = useMemo(() => {
    if (!workspace || !collection) return [];
    return workspace.ideas
      .filter((idea) => idea.collectionId === collection.id)
      .slice()
      .sort((a, b) => compareIdeas(a, b, "updated-newest"));
  }, [collection, workspace]);
  const selectedSongIdea =
    workspace && pickerState.songIdeaId
      ? workspace.ideas.find((idea) => idea.id === pickerState.songIdeaId) ?? null
      : null;
  const [selectionMoreVisible, setSelectionMoreVisible] = useState(false);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);

  const isSelected = (selection: PlaylistPickerSelection) =>
    pickerState.selectedItems.some(
      (item) => buildPickerSelectionKey(item) === buildPickerSelectionKey(selection)
    );

  const toggleSelection = (selection: PlaylistPickerSelection) => {
    const key = buildPickerSelectionKey(selection);
    const hasSelection = pickerState.selectedItems.some(
      (item) => buildPickerSelectionKey(item) === key
    );

    onChangePickerState({
      ...pickerState,
      selectedItems: hasSelection
        ? pickerState.selectedItems.filter((item) => buildPickerSelectionKey(item) !== key)
        : [...pickerState.selectedItems, selection],
    });
  };

  const visibleSelections = useMemo<PlaylistPickerSelection[]>(() => {
    if (workspace && collection && selectedSongIdea) {
      return selectedSongIdea.clips.map((clip) => ({
        kind: "clip",
        workspaceId: workspace.id,
        collectionId: selectedSongIdea.collectionId,
        ideaId: selectedSongIdea.id,
        clipId: clip.id,
      }));
    }

    if (workspace && collection && !selectedSongIdea) {
      return collectionIdeas.map((idea) => {
        const primaryClip = getIdeaPrimaryClip(idea);
        return idea.kind === "project"
          ? {
              kind: "song" as const,
              workspaceId: workspace.id,
              collectionId: idea.collectionId,
              ideaId: idea.id,
            }
          : {
              kind: "clip" as const,
              workspaceId: workspace.id,
              collectionId: idea.collectionId,
              ideaId: idea.id,
              clipId: primaryClip?.id ?? null,
            };
      });
    }

    return [];
  }, [collection, collectionIdeas, selectedSongIdea, workspace]);
  const selectedKeySet = useMemo(
    () => new Set(pickerState.selectedItems.map((item) => buildPickerSelectionKey(item))),
    [pickerState.selectedItems]
  );
  const allVisibleSelected =
    visibleSelections.length > 0 &&
    visibleSelections.every((selection) => selectedKeySet.has(buildPickerSelectionKey(selection)));
  const selectionDockActions: SelectionAction[] = [
    {
      key: "add",
      label:
        pickerState.selectedItems.length === 1
          ? "Add item"
          : `Add ${pickerState.selectedItems.length}`,
      icon: "add-outline",
      onPress: onConfirm,
      disabled: pickerState.selectedItems.length === 0,
    },
    {
      key: "more",
      label: "More",
      icon: "ellipsis-horizontal",
      onPress: () => setSelectionMoreVisible(true),
    },
  ];
  const selectionSheetActions: SelectionAction[] = [
    {
      key: "toggle-visible",
      label: allVisibleSelected ? "Deselect view" : "Select all in view",
      icon: allVisibleSelected ? "remove-circle-outline" : "checkmark-circle-outline",
      onPress: () => {
        const visibleKeySet = new Set(visibleSelections.map((item) => buildPickerSelectionKey(item)));
        if (allVisibleSelected) {
          onChangePickerState({
            ...pickerState,
            selectedItems: pickerState.selectedItems.filter(
              (item) => !visibleKeySet.has(buildPickerSelectionKey(item))
            ),
          });
          return;
        }

        const nextItems = [...pickerState.selectedItems];
        visibleSelections.forEach((selection) => {
          const key = buildPickerSelectionKey(selection);
          if (!selectedKeySet.has(key)) {
            nextItems.push(selection);
          }
        });
        onChangePickerState({
          ...pickerState,
          selectedItems: nextItems,
        });
      },
      disabled: visibleSelections.length === 0,
    },
    {
      key: "clear",
      label: "Clear selection",
      icon: "close-circle-outline",
      onPress: () =>
        onChangePickerState({
          ...pickerState,
          selectedItems: [],
        }),
      disabled: pickerState.selectedItems.length === 0,
    },
  ];

  return (
    <View style={styles.flexFill}>
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={[
          styles.libraryScrollContent,
          {
            paddingBottom: pickerState.selectedItems.length > 0 ? selectionDockHeight + 24 + 24 : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!workspace ? (
          <View style={styles.listContent}>
            {workspaces.map((candidate) => (
              <Pressable
                key={candidate.id}
                style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                onPress={() =>
                  onChangePickerState({
                    ...pickerState,
                    workspaceId: candidate.id,
                    collectionId: null,
                    songIdeaId: null,
                  })
                }
              >
                <View style={styles.cardTitleRow}>
                  <Ionicons
                    name={getHierarchyIconName("workspace")}
                    size={18}
                    color={getHierarchyIconColor("workspace")}
                  />
                  <Text style={styles.cardTitle}>{candidate.title}</Text>
                </View>
                <Text style={styles.cardMeta}>
                  {candidate.collections.length} {candidate.collections.length === 1 ? "collection" : "collections"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {workspace && !collection ? (
          <View style={styles.listContent}>
            <Pressable
              style={({ pressed }) => [styles.libraryPickerBackRow, pressed ? styles.pressDown : null]}
              onPress={() =>
                onChangePickerState({
                  ...pickerState,
                  workspaceId: null,
                  collectionId: null,
                  songIdeaId: null,
                })
              }
            >
              <Ionicons name="arrow-back" size={14} color="#64748b" />
              <Text style={styles.libraryPickerBackText}>Choose another workspace</Text>
            </Pressable>

            {collectionEntries.map((entry) => (
              <Pressable
                key={entry.collection.id}
                style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                onPress={() =>
                  onChangePickerState({
                    ...pickerState,
                    collectionId: entry.collection.id,
                    songIdeaId: null,
                  })
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons
                      name={getHierarchyIconName("collection")}
                      size={18}
                      color={getHierarchyIconColor("collection")}
                    />
                    <Text style={styles.cardTitle}>{entry.collection.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </View>
                <Text style={styles.cardMeta}>
                  {entry.itemCount} {entry.itemCount === 1 ? "item" : "items"}
                </Text>
              </Pressable>
            ))}

            {collectionEntries.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No collections yet</Text>
                <Text style={styles.cardMeta}>
                  Create a collection in this workspace before adding items to playlists.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {workspace && collection && !selectedSongIdea ? (
          <View style={styles.listContent}>
            <Pressable
              style={({ pressed }) => [styles.libraryPickerBackRow, pressed ? styles.pressDown : null]}
              onPress={() =>
                onChangePickerState({
                  ...pickerState,
                  collectionId: null,
                  songIdeaId: null,
                })
              }
            >
              <Ionicons name="arrow-back" size={14} color="#64748b" />
              <Text style={styles.libraryPickerBackText}>{workspace.title}</Text>
            </Pressable>

            {childCollections.length > 0 ? (
              <View style={styles.libraryPickerSection}>
                <Text style={styles.workspaceBrowseSectionTitle}>Subcollections</Text>
                {childCollections.map((child) => (
                  <Pressable
                    key={child.id}
                    style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                    onPress={() =>
                      onChangePickerState({
                        ...pickerState,
                        collectionId: child.id,
                        songIdeaId: null,
                      })
                    }
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.cardTitleRow}>
                        <Ionicons
                          name={getHierarchyIconName("subcollection")}
                          size={18}
                          color={getHierarchyIconColor("subcollection")}
                        />
                        <Text style={styles.cardTitle}>{child.title}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </View>
                    <Text style={styles.cardMeta}>{buildCollectionPathLabel(workspace, child.id)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.libraryPickerSection}>
              <Text style={styles.workspaceBrowseSectionTitle}>Items</Text>
              {collectionIdeas.map((idea) => {
                const primaryClip = getIdeaPrimaryClip(idea);
                const selection: PlaylistPickerSelection =
                  idea.kind === "project"
                    ? {
                        kind: "song",
                        workspaceId: workspace.id,
                        collectionId: idea.collectionId,
                        ideaId: idea.id,
                      }
                    : {
                        kind: "clip",
                        workspaceId: workspace.id,
                        collectionId: idea.collectionId,
                        ideaId: idea.id,
                        clipId: primaryClip?.id ?? null,
                      };
                const selected = isSelected(selection);

                return (
                  <View key={idea.id} style={styles.libraryPickerItemRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.libraryPickerItemMain,
                        pressed ? styles.pressDown : null,
                      ]}
                      onPress={() => toggleSelection(selection)}
                    >
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={selected ? "#0f172a" : "#94a3b8"}
                      />
                      <View style={styles.libraryPickerItemCopy}>
                        <Text style={styles.cardTitle}>{idea.title}</Text>
                        <Text style={styles.cardMeta}>
                          {idea.kind === "project" ? "Song" : "Clip"}
                        </Text>
                      </View>
                    </Pressable>
                    {idea.kind === "project" && idea.clips.length > 0 ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.collectionInlineActionBtn,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() =>
                          onChangePickerState({
                            ...pickerState,
                            songIdeaId: idea.id,
                          })
                        }
                      >
                        <Ionicons name="chevron-forward" size={15} color="#64748b" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}

              {collectionIdeas.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>No items in this collection</Text>
                  <Text style={styles.cardMeta}>
                    Try a subcollection or pick a different collection.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {workspace && collection && selectedSongIdea ? (
          <View style={styles.listContent}>
            <Pressable
              style={({ pressed }) => [styles.libraryPickerBackRow, pressed ? styles.pressDown : null]}
              onPress={() =>
                onChangePickerState({
                  ...pickerState,
                  songIdeaId: null,
                })
              }
            >
              <Ionicons name="arrow-back" size={14} color="#64748b" />
              <Text style={styles.libraryPickerBackText}>{selectedSongIdea.title}</Text>
            </Pressable>

            {selectedSongIdea.clips.map((clip) => {
              const selection: PlaylistPickerSelection = {
                kind: "clip",
                workspaceId: workspace.id,
                collectionId: selectedSongIdea.collectionId,
                ideaId: selectedSongIdea.id,
                clipId: clip.id,
              };
              const selected = isSelected(selection);

              return (
                <Pressable
                  key={clip.id}
                  style={({ pressed }) => [
                    styles.libraryPickerItemRow,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => toggleSelection(selection)}
                >
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={selected ? "#0f172a" : "#94a3b8"}
                  />
                  <View style={styles.libraryPickerItemCopy}>
                    <Text style={styles.cardTitle}>{clip.title}</Text>
                    <Text style={styles.cardMeta}>
                      {clip.isPrimary ? "Primary take" : "Clip version"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {pickerState.selectedItems.length > 0 ? (
        <>
          <SelectionDock
            count={pickerState.selectedItems.length}
            actions={selectionDockActions}
            onDone={onCancel}
            onLayout={(height) => {
              setSelectionDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
            }}
          />
          <SelectionActionSheet
            visible={selectionMoreVisible}
            title="Playlist picker actions"
            actions={selectionSheetActions}
            onClose={() => setSelectionMoreVisible(false)}
          />
        </>
      ) : null}
    </View>
  );
}
