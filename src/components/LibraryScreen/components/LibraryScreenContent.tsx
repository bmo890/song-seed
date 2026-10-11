import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRoute } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { SegmentedControl, useSegmentedThumb } from "../../common/SegmentedControl";
import { IconButton } from "../../common/IconButton";
import { HelpSheet } from "../../common/HelpSheet";
import { CompilationListControls } from "./CompilationListControls";
import { CreateFab } from "./CreateFab";
import type { ScrollOffset } from "../../../hooks/usePersistedScrollView";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { spacing } from "../../../design/tokens";
import { styles } from "../styles";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { isSendServiceConfigured } from "../../../config/sendService";

// "Get a link" needs a real transfer endpoint. Show it in dev (so it's testable
// against a local `wrangler dev`) or once a non-localhost service is configured —
// never in a shipped build that would point at localhost and fail.
const SHOW_GET_LINK = __DEV__ || isSendServiceConfigured();
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
import { useTranslation } from "react-i18next";
import { useReceivedPrefsStore } from "../../../state/useReceivedPrefsStore";
import { listCompilations } from "../../../domain/compilationListing";

type Section = "playlists" | "songbook" | "setlists";

/**
 * Each tab is its own component so ONLY the active tab's model hook runs. Previously all
 * three models (playlists + songbook + setlists) subscribed to the whole library and
 * recomputed their derived state on every render/library change simultaneously — a 3×
 * mount cost on open and 3× re-derivation on every edit, for two invisible tabs.
 */
export function LibraryScreenContent() {
  const { t } = useTranslation();
  useBrowseRootBackHandler();
  const [section, setSection] = useState<Section>("playlists");
  // Switching tabs swaps the whole section subtree, so the SegmentedControl
  // remounts. Own its thumb state here (this screen doesn't remount) so the
  // pill slides from the previous tab instead of jumping in from the left.
  const segThumb = useSegmentedThumb();
  // Remember each tab's list scroll position. Lives here (this screen doesn't
  // remount) so a section that remounts on tab switch can restore where the
  // user left off; it resets naturally when they leave the Library.
  const listScroll = useRef({
    playlists: { current: 0 },
    songbook: { current: 0 },
    setlists: { current: 0 },
  }).current;

  // Collector returns and import deep-links land with openCollectionKind — jump
  // to that tab; the mounted section's model then claims openCollectionId.
  const route = useRoute<any>();
  const openCollectionKind = route.params?.openCollectionKind as string | undefined;
  useEffect(() => {
    if (openCollectionKind === "songbook") setSection("songbook");
    else if (openCollectionKind === "setlist") setSection("setlists");
    else if (openCollectionKind === "playlist") setSection("playlists");
  }, [openCollectionKind, route.params?.openToken]);

  // What each tab is for lives behind the header's "?" (help law: the sheet,
  // not a caption under every tab); the row under the tabs carries the same
  // filter + sort pair a collection has (founder, 2026-10-11).
  const [helpOpen, setHelpOpen] = useState(false);
  const tabs = (
    <View style={local.tabsWrap}>
      <SegmentedControl options={[
        { key: "playlists", label: t("library.playlists") },
        { key: "songbook", label: t("library.songbook") },
        { key: "setlists", label: t("library.setlists") },
      ]} value={section} onChange={setSection} persist={segThumb} />
      {/* Playlists are never received, so the filter has nothing to say there. */}
      <CompilationListControls showFilter={section !== "playlists"} />
    </View>
  );
  // IconButton ticks on press — haptics vocabulary: `tap`.
  const headerRight = (
    <IconButton
      testID="library-help"
      icon="help-circle-outline"
      tone="muted"
      onPress={() => setHelpOpen(true)}
      accessibilityLabel={t("library.helpA11y")}
    />
  );
  const helpSheet = (
    <HelpSheet
      visible={helpOpen}
      onClose={() => setHelpOpen(false)}
      thesis={t("library.helpThesis")}
      items={[
        { icon: "musical-notes-outline", label: t("library.playlists"), description: t("library.helpPlaylists") },
        { icon: "book-outline", label: t("library.songbook"), description: t("library.helpCharts") },
        { icon: "albums-outline", label: t("library.setlists"), description: t("library.helpSetlists") },
        { icon: "mail-open-outline", label: t("library.show_received"), description: t("library.helpReceived") },
      ]}
    />
  );

  // One stable SafeAreaView wraps every section. Previously each section
  // rendered its own, so switching tabs remounted the SafeAreaView — and a
  // freshly-mounted one re-applies its safe-area insets a frame late, which is
  // what made the whole page (and the title) jump down and settle. Now only the
  // section body inside swaps; the safe-area frame stays put.
  return (
    <SafeAreaView style={styles.screen}>
      {section === "songbook" ? (
        <SongbookSection tabs={tabs} scroll={listScroll.songbook} headerRight={headerRight} />
      ) : section === "setlists" ? (
        <SetlistsSection tabs={tabs} scroll={listScroll.setlists} headerRight={headerRight} />
      ) : (
        <PlaylistsSection tabs={tabs} scroll={listScroll.playlists} headerRight={headerRight} />
      )}
      {helpSheet}
    </SafeAreaView>
  );
}

function PlaylistsSection({ tabs, scroll, headerRight }: { tabs: ReactNode; scroll: ScrollOffset; headerRight?: ReactNode }) {
  const { t } = useTranslation();
  const model = useLibraryScreenModel();
  // Playlists are never received, so only the sort applies here.
  const sort = useReceivedPrefsStore((s) => s.compilationSort);

  return (
    <>
      <ScreenHeader
        title={model.pageTitle}
        leftIcon={model.showBack ? "back" : "hamburger"}
        onLeftPress={model.showBack ? model.handleBackPress : undefined}
        rightElement={!model.showBack ? headerRight : undefined}
      />

      {!model.showBack ? tabs : null}

      {!model.activePlaylist ? (
        <PlaylistListView
          playlists={listCompilations(model.sortedPlaylists, "all", sort)}
          onCreatePlaylist={model.openCreatePlaylist}
          onOpenPlaylist={model.openPlaylist}
          scroll={scroll}
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
          onLocateTrack={model.openTrackLocation}
          onReorderItems={(orderedItemIds) =>
            model.reorderPlaylistItems(model.activePlaylist!.id, orderedItemIds)
          }
        />
      )}

      {!model.showBack ? (
        <CreateFab
          testID="library-new-playlist"
          onPress={model.openCreatePlaylist}
          accessibilityLabel={t("library.createPlaylistA11y")}
        />
      ) : null}

      <QuickNameModal
        visible={model.playlistModalOpen}
        title={t("library.newPlaylist")}
        draftValue={model.playlistDraftTitle}
        placeholderValue={model.defaultPlaylistTitle}
        onChangeDraft={model.setPlaylistDraftTitle}
        onCancel={() => {
          model.setPlaylistModalOpen(false);
          model.setPlaylistDraftTitle("");
        }}
        onSave={model.createPlaylist}
        helperText={t("library.playlistHint")}
        saveLabel={t("common.create")}
      />

      <QuickNameModal
        visible={model.renameModalOpen}
        title={t("library.renamePlaylist")}
        draftValue={model.renameDraftTitle}
        placeholderValue={model.activePlaylist?.title ?? ""}
        onChangeDraft={model.setRenameDraftTitle}
        onCancel={() => {
          model.setRenameModalOpen(false);
          model.setRenameDraftTitle("");
        }}
        onSave={model.renamePlaylist}
        saveLabel={t("common.save")}
      />
    </>
  );
}

function SongbookSection({ tabs, scroll, headerRight }: { tabs: ReactNode; scroll: ScrollOffset; headerRight?: ReactNode }) {
  const { t } = useTranslation();
  const songbook = useSongbookModel();
  const filter = useReceivedPrefsStore((s) => s.compilationFilter);
  const sort = useReceivedPrefsStore((s) => s.compilationSort);

  const headerTitle = songbook.activeSongbook?.title ?? t("library.title");

  return (
    <>
      <ScreenHeader
        title={headerTitle}
        leftIcon={songbook.showBack ? "back" : "hamburger"}
        onLeftPress={songbook.showBack ? songbook.handleBack : undefined}
        rightElement={!songbook.showBack ? headerRight : undefined}
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
          onShareFile={songbook.shareSongbookFile}
          onGetLink={SHOW_GET_LINK ? songbook.getLinkForActiveSongbook : undefined}
          onShareText={songbook.shareSongbook}
          onDelete={songbook.deleteActiveSongbook}
        />
      ) : (
        <SongbookListView
          songbooks={listCompilations(songbook.sortedSongbooks, filter, sort)}
          onCreate={songbook.openCreate}
          onOpen={songbook.openSongbook}
          scroll={scroll}
        />
      )}

      {!songbook.showBack ? (
        <CreateFab testID="library-new-songbook" onPress={songbook.openCreate} accessibilityLabel={t("library.createSongbook")} />
      ) : null}

      <QuickNameModal
        visible={songbook.createModalOpen}
        title={t("library.newSongbook")}
        draftValue={songbook.draftTitle}
        placeholderValue={songbook.defaultTitle}
        onChangeDraft={songbook.setDraftTitle}
        onCancel={() => {
          songbook.setCreateModalOpen(false);
          songbook.setDraftTitle("");
        }}
        onSave={songbook.createSongbook}
        helperText={t("library.songbookCreateHint")}
        saveLabel={t("common.create")}
      />

      <QuickNameModal
        visible={songbook.renameModalOpen}
        title={t("library.renameSongbook")}
        draftValue={songbook.draftTitle}
        placeholderValue={songbook.activeSongbook?.title ?? ""}
        onChangeDraft={songbook.setDraftTitle}
        onCancel={() => {
          songbook.setRenameModalOpen(false);
          songbook.setDraftTitle("");
        }}
        onSave={songbook.renameActiveSongbook}
        saveLabel={t("common.save")}
      />
    </>
  );
}

function SetlistsSection({ tabs, scroll, headerRight }: { tabs: ReactNode; scroll: ScrollOffset; headerRight?: ReactNode }) {
  const { t } = useTranslation();
  const setlist = useSetlistModel();
  const filter = useReceivedPrefsStore((s) => s.compilationFilter);
  const sort = useReceivedPrefsStore((s) => s.compilationSort);

  const headerTitle = setlist.builder
    ? t("library.editSong")
    : setlist.activeSetlist?.title ?? t("library.title");

  return (
    <>
      <ScreenHeader
        title={headerTitle}
        leftIcon={setlist.showBack ? "back" : "hamburger"}
        onLeftPress={setlist.showBack ? setlist.handleBack : undefined}
        rightElement={!setlist.showBack ? headerRight : undefined}
      />

      {!setlist.showBack ? tabs : null}

      {setlist.builder ? (
        <SetlistEntryBuilderView
          song={setlist.builderSong}
          clipIds={setlist.builder.clipIds}
          lyricVersionIds={setlist.builder.lyricVersionIds}
          includeChordSheet={setlist.builder.includeChordSheet}
          includeSongNotes={setlist.builder.includeSongNotes}
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
          onAddSong={setlist.startCollecting}
          onReorder={setlist.reorderEntries}
          onRemoveEntry={setlist.removeEntry}
          onRename={setlist.openRename}
          onShare={setlist.shareActiveSetlist}
          onGetLink={SHOW_GET_LINK ? setlist.getLinkForActiveSetlist : undefined}
          onDelete={setlist.deleteActiveSetlist}
        />
      ) : (
        <SetlistListView
          setlists={listCompilations(setlist.sortedSetlists, filter, sort)}
          onCreate={setlist.openCreate}
          onOpen={setlist.openSetlist}
          scroll={scroll}
        />
      )}

      {!setlist.showBack ? (
        <CreateFab testID="library-new-setlist" onPress={setlist.openCreate} accessibilityLabel={t("library.createSetlist")} />
      ) : null}

      <QuickNameModal
        visible={setlist.createModalOpen}
        title={t("library.newSetlist")}
        draftValue={setlist.draftTitle}
        placeholderValue={setlist.defaultTitle}
        onChangeDraft={setlist.setDraftTitle}
        onCancel={() => {
          setlist.setCreateModalOpen(false);
          setlist.setDraftTitle("");
        }}
        onSave={setlist.createSetlist}
        helperText={t("library.setlistHint")}
        saveLabel={t("common.create")}
      />

      <QuickNameModal
        visible={setlist.renameModalOpen}
        title={t("library.setDetails")}
        draftValue={setlist.draftTitle}
        placeholderValue={setlist.activeSetlist?.title ?? ""}
        onChangeDraft={setlist.setDraftTitle}
        descriptionValue={setlist.draftDescription}
        onChangeDescription={setlist.setDraftDescription}
        onCancel={() => {
          setlist.setRenameModalOpen(false);
          setlist.setDraftTitle("");
          setlist.setDraftDescription("");
        }}
        onSave={setlist.renameActiveSetlist}
        saveLabel={t("common.save")}
      />
    </>
  );
}

const local = StyleSheet.create({
  tabsWrap: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
});
