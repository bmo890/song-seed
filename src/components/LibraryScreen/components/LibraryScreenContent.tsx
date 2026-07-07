import { useState, type ReactNode } from "react";
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
import { PlaylistPickerView } from "../views/PlaylistPickerView";
import { SongbookListView } from "../views/SongbookListView";
import { SongbookDetailView } from "../views/SongbookDetailView";
import { SongbookPickerView } from "../views/SongbookPickerView";
import { SetlistListView } from "../views/SetlistListView";
import { SetlistDetailView } from "../views/SetlistDetailView";
import { SetlistEntryBuilderView } from "../views/SetlistEntryBuilderView";

type Section = "playlists" | "songbook" | "setlists";

const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: "playlists", label: "Playlists" },
  { key: "songbook", label: "Songbook" },
  { key: "setlists", label: "Setlists" },
];

/**
 * Each tab is its own component so ONLY the active tab's model hook runs. Previously all
 * three models (playlists + songbook + setlists) subscribed to the whole library and
 * recomputed their derived state on every render/library change simultaneously — a 3×
 * mount cost on open and 3× re-derivation on every edit, for two invisible tabs.
 */
export function LibraryScreenContent() {
  useBrowseRootBackHandler();
  const [section, setSection] = useState<Section>("playlists");

  const tabs = (
    <View style={local.tabsWrap}>
      <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
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
      {!model.showBack ? <Text style={local.desc}>{model.pageSubtitle}</Text> : null}

      {!model.activePlaylist && !model.pickerState ? (
        <PlaylistListView
          playlists={model.sortedPlaylists}
          onCreatePlaylist={model.openCreatePlaylist}
          onOpenPlaylist={model.openPlaylist}
        />
      ) : null}

      {model.activePlaylist && !model.pickerState ? (
        <PlaylistDetailView
          playlist={model.activePlaylist}
          displayItems={model.playlistDisplayItems}
          onAddItems={model.openPicker}
          onOpenItem={model.openPlaylistItem}
          onRemoveItem={(itemId) => model.removePlaylistItem(model.activePlaylist!.id, itemId)}
          onReorderItems={(orderedItemIds) =>
            model.reorderPlaylistItems(model.activePlaylist!.id, orderedItemIds)
          }
        />
      ) : null}

      {model.pickerState && model.activePlaylist ? (
        <PlaylistPickerView
          workspaces={model.pickerWorkspaceChoices}
          pickerState={model.pickerState}
          onChangePickerState={model.setPickerState}
          onCancel={() => model.setPickerState(null)}
          onConfirm={model.confirmPicker}
        />
      ) : null}

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
    </SafeAreaView>
  );
}

function SongbookSection({ tabs }: { tabs: ReactNode }) {
  const songbook = useSongbookModel();

  const headerTitle = songbook.pickerState
    ? "Add Charts"
    : songbook.activeSongbook?.title ?? "Library";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={headerTitle}
        leftIcon={songbook.showBack ? "back" : "hamburger"}
        onLeftPress={songbook.showBack ? songbook.handleBack : undefined}
      />

      {!songbook.showBack ? tabs : null}

      {songbook.pickerState ? (
        <SongbookPickerView
          ideaId={songbook.pickerState.ideaId}
          songTitle={songbook.pickerSongTitle}
          workspaces={songbook.pickerWorkspaces}
          charts={songbook.pickerCharts}
          selectedKeys={songbook.selectedKeys}
          onSelectSong={songbook.pickerSelectSong}
          onToggle={songbook.pickerToggle}
          onConfirm={songbook.confirmPicker}
        />
      ) : songbook.activeSongbook ? (
        <SongbookDetailView
          items={songbook.displayItems}
          onAddCharts={songbook.openPicker}
          onShare={songbook.shareSongbook}
          onOpenItem={(item) => item.onOpen?.()}
          onRemoveItem={songbook.removeItem}
          onDeleteSongbook={songbook.deleteActiveSongbook}
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
          onSelectSong={setlist.builderSelectSong}
          onToggleClip={setlist.builderToggleClip}
          onToggleVersion={setlist.builderToggleVersion}
          onToggleChordSheet={setlist.builderToggleChordSheet}
          onConfirm={setlist.confirmBuilder}
        />
      ) : setlist.activeSetlist ? (
        <SetlistDetailView
          entries={setlist.displayEntries}
          onAddSong={setlist.openBuilder}
          onShare={setlist.shareActiveSetlist}
          onEditEntry={setlist.editEntry}
          onReorder={setlist.reorderEntries}
          onRemoveEntry={setlist.removeEntry}
          onDeleteSetlist={setlist.deleteActiveSetlist}
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
