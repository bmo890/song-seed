import { useEffect, useState, type ReactNode } from "react";
import { useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { SegmentedControl } from "../../common/SegmentedControl";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { colors, spacing } from "../../../design/tokens";
import { styles } from "../styles";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useLibraryScreenModel } from "../hooks/useLibraryScreenModel";
import { useSongbookModel } from "../hooks/useSongbookModel";
import { useSetlistModel } from "../hooks/useSetlistModel";
import { PlaylistListView } from "../views/PlaylistListView";
import { PlaylistDetailView } from "../views/PlaylistDetailView";
import { SongbookListView } from "../views/SongbookListView";
import { SongbookDetailView } from "../views/SongbookDetailView";
import { SetlistListView } from "../views/SetlistListView";
import { SetlistDetailView } from "../views/SetlistDetailView";
import { SetlistEntryBuilderView } from "../views/SetlistEntryBuilderView";

type Section = "playlists" | "songbook" | "setlists";

const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: "playlists", label: "Playlists" },
  { key: "songbook", label: "Songbook" },
  { key: "setlists", label: "Setlists" },
];

/** One-line job statement per tab — the tabs looked identical without them and
 *  users couldn't tell listen/read/share apart. */
const SECTION_HINTS: Record<Section, string> = {
  playlists: "Listen — ordered queues of clips and songs, played back to back.",
  songbook: "Read — collections of lyric and chord charts.",
  setlists: "Share — song sets (takes + charts) ready to send to the band.",
};

/**
 * Each tab is its own component so ONLY the active tab's model hook runs. Previously all
 * three models (playlists + songbook + setlists) subscribed to the whole library and
 * recomputed their derived state on every render/library change simultaneously — a 3×
 * mount cost on open and 3× re-derivation on every edit, for two invisible tabs.
 */
export function LibraryScreenContent() {
  useBrowseRootBackHandler();
  const [section, setSection] = useState<Section>("playlists");

  // Collector returns and import deep-links land with openCollectionKind — jump
  // to that tab; the mounted section's model then claims openCollectionId.
  const route = useRoute<any>();
  const openCollectionKind = route.params?.openCollectionKind as string | undefined;
  useEffect(() => {
    if (openCollectionKind === "songbook") setSection("songbook");
    else if (openCollectionKind === "setlist") setSection("setlists");
    else if (openCollectionKind === "playlist") setSection("playlists");
  }, [openCollectionKind, route.params?.openToken]);

  const tabs = (
    <View style={local.tabsWrap}>
      <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
      <Text style={local.desc}>{SECTION_HINTS[section]}</Text>
    </View>
  );

  if (section === "songbook") {
    return <SongbookSection tabs={tabs} />;
  }
  if (section === "setlists") {
    return <SetlistsSection tabs={tabs} />;
  }
  return <PlaylistsSection tabs={tabs} />;
}

function PlaylistsSection({ tabs }: { tabs: ReactNode }) {
  const model = useLibraryScreenModel();

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={model.pageTitle}
        leftIcon={model.showBack ? "back" : "hamburger"}
        onLeftPress={model.showBack ? model.handleBackPress : undefined}
      />

      {!model.showBack ? tabs : null}

      {!model.activePlaylist ? (
        <PlaylistListView
          playlists={model.sortedPlaylists}
          onCreatePlaylist={model.openCreatePlaylist}
          onOpenPlaylist={model.openPlaylist}
        />
      ) : (
        <PlaylistDetailView
          playlist={model.activePlaylist}
          tracks={model.playlistTracks}
          durationMs={model.playlistDurationMs}
          nowPlayingItemId={model.nowPlayingItemId}
          isPlaying={model.playerIsPlaying}
          editMode={model.editMode}
          onToggleEditMode={() => model.setEditMode((prev: boolean) => !prev)}
          onTogglePlayback={model.togglePlayback}
          onPlayFromTrack={model.playFromTrack}
          onAddItems={model.startCollecting}
          onRename={model.openRenamePlaylist}
          onDelete={model.confirmDeletePlaylist}
          onRemoveItem={(itemId) => model.removePlaylistItem(model.activePlaylist!.id, itemId)}
          onReorderItems={(orderedItemIds) =>
            model.reorderPlaylistItems(model.activePlaylist!.id, orderedItemIds)
          }
        />
      )}

      <QuickNameModal
        visible={model.playlistModalOpen}
        title="New Playlist"
        draftValue={model.playlistDraftTitle}
        placeholderValue={model.defaultPlaylistTitle}
        onChangeDraft={model.setPlaylistDraftTitle}
        onCancel={() => {
          model.setPlaylistModalOpen(false);
          model.setPlaylistDraftTitle("");
        }}
        onSave={model.createPlaylist}
        helperText="Playlists are global and can hold songs or clips from any workspace."
        saveLabel="Create"
      />

      <QuickNameModal
        visible={model.renameModalOpen}
        title="Rename Playlist"
        draftValue={model.renameDraftTitle}
        placeholderValue={model.activePlaylist?.title ?? ""}
        onChangeDraft={model.setRenameDraftTitle}
        onCancel={() => {
          model.setRenameModalOpen(false);
          model.setRenameDraftTitle("");
        }}
        onSave={model.renamePlaylist}
        saveLabel="Save"
      />
    </SafeAreaView>
  );
}

function SongbookSection({ tabs }: { tabs: ReactNode }) {
  const songbook = useSongbookModel();

  const headerTitle = songbook.activeSongbook?.title ?? "Library";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={headerTitle}
        leftIcon={songbook.showBack ? "back" : "hamburger"}
        onLeftPress={songbook.showBack ? songbook.handleBack : undefined}
      />

      {!songbook.showBack ? tabs : null}

      {songbook.activeSongbook ? (
        <SongbookDetailView
          songbook={songbook.activeSongbook}
          songs={songbook.songs}
          nowPlayingIdeaId={songbook.nowPlayingIdeaId}
          isPlaying={songbook.isPlayerPlaying}
          onOpenReader={songbook.openReader}
          onPlaySong={songbook.playSongAudio}
          onAddSongs={songbook.startCollecting}
          onReorderSongs={songbook.reorderSongs}
          onRemoveSong={songbook.removeSong}
          onRename={songbook.openRename}
          onShareText={songbook.shareSongbook}
          onDelete={songbook.deleteActiveSongbook}
        />
      ) : (
        <SongbookListView
          songbooks={songbook.sortedSongbooks}
          onCreate={songbook.openCreate}
          onOpen={songbook.openSongbook}
        />
      )}

      <QuickNameModal
        visible={songbook.createModalOpen}
        title="New Songbook"
        draftValue={songbook.draftTitle}
        placeholderValue={songbook.defaultTitle}
        onChangeDraft={songbook.setDraftTitle}
        onCancel={() => {
          songbook.setCreateModalOpen(false);
          songbook.setDraftTitle("");
        }}
        onSave={songbook.createSongbook}
        helperText="Songbooks collect lyric and chord charts from any workspace."
        saveLabel="Create"
      />

      <QuickNameModal
        visible={songbook.renameModalOpen}
        title="Rename Songbook"
        draftValue={songbook.draftTitle}
        placeholderValue={songbook.activeSongbook?.title ?? ""}
        onChangeDraft={songbook.setDraftTitle}
        onCancel={() => {
          songbook.setRenameModalOpen(false);
          songbook.setDraftTitle("");
        }}
        onSave={songbook.renameActiveSongbook}
        saveLabel="Save"
      />
    </SafeAreaView>
  );
}

function SetlistsSection({ tabs }: { tabs: ReactNode }) {
  const setlist = useSetlistModel();

  const headerTitle = setlist.builder
    ? setlist.builder.editingEntryId
      ? "Edit Song"
      : "Add Song"
    : setlist.activeSetlist?.title ?? "Library";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={headerTitle}
        leftIcon={setlist.showBack ? "back" : "hamburger"}
        onLeftPress={setlist.showBack ? setlist.handleBack : undefined}
      />

      {!setlist.showBack ? tabs : null}

      {setlist.builder ? (
        <SetlistEntryBuilderView
          ideaId={setlist.builder.ideaId}
          isEditing={!!setlist.builder.editingEntryId}
          song={setlist.builderSong}
          workspaces={setlist.pickerWorkspaces}
          clipIds={setlist.builder.clipIds}
          lyricVersionIds={setlist.builder.lyricVersionIds}
          includeChordSheet={setlist.builder.includeChordSheet}
          includeSongNotes={setlist.builder.includeSongNotes}
          onSelectSong={setlist.builderSelectSong}
          onBrowseCollections={setlist.startCollecting}
          onToggleClip={setlist.builderToggleClip}
          onToggleVersion={setlist.builderToggleVersion}
          onToggleChordSheet={setlist.builderToggleChordSheet}
          onToggleSongNotes={setlist.builderToggleSongNotes}
          onSelectEverything={setlist.builderSelectEverything}
          onConfirm={setlist.confirmBuilder}
        />
      ) : setlist.activeSetlist ? (
        <SetlistDetailView
          setlist={setlist.activeSetlist}
          entries={setlist.resolvedEntries}
          setDurationMs={setlist.setDurationMs}
          nowPlayingEntryId={setlist.nowPlayingEntryId}
          isPlaying={setlist.isPlayerPlaying}
          onPlayAll={setlist.playAll}
          onPlayEntry={setlist.playFromEntry}
          onOpenEntry={setlist.openEntryFolder}
          onEditEntry={setlist.editEntry}
          onAddSong={setlist.openBuilder}
          onReorder={setlist.reorderEntries}
          onRemoveEntry={setlist.removeEntry}
          onRename={setlist.openRename}
          onShare={setlist.shareActiveSetlist}
          onDelete={setlist.deleteActiveSetlist}
        />
      ) : (
        <SetlistListView
          setlists={setlist.sortedSetlists}
          onCreate={setlist.openCreate}
          onOpen={setlist.openSetlist}
        />
      )}

      <QuickNameModal
        visible={setlist.createModalOpen}
        title="New Setlist"
        draftValue={setlist.draftTitle}
        placeholderValue={setlist.defaultTitle}
        onChangeDraft={setlist.setDraftTitle}
        onCancel={() => {
          setlist.setCreateModalOpen(false);
          setlist.setDraftTitle("");
        }}
        onSave={setlist.createSetlist}
        helperText="Setlists hold an ordered set of songs (clips + charts) to share with your band."
        saveLabel="Create"
      />

      <QuickNameModal
        visible={setlist.renameModalOpen}
        title="Rename Setlist"
        draftValue={setlist.draftTitle}
        placeholderValue={setlist.activeSetlist?.title ?? ""}
        onChangeDraft={setlist.setDraftTitle}
        onCancel={() => {
          setlist.setRenameModalOpen(false);
          setlist.setDraftTitle("");
        }}
        onSave={setlist.renameActiveSetlist}
        saveLabel="Save"
      />
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  tabsWrap: {
    marginBottom: spacing.md,
  },
  desc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
