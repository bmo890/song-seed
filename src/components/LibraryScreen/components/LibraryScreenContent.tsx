import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { PageIntro } from "../../common/PageIntro";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { colors, radii, spacing } from "../../../design/tokens";
import { styles } from "../styles";
import { useLibraryScreenModel } from "../hooks/useLibraryScreenModel";
import { useSongbookModel } from "../hooks/useSongbookModel";
import { PlaylistListView } from "../views/PlaylistListView";
import { PlaylistDetailView } from "../views/PlaylistDetailView";
import { PlaylistPickerView } from "../views/PlaylistPickerView";
import { SongbookListView } from "../views/SongbookListView";
import { SongbookDetailView } from "../views/SongbookDetailView";
import { SongbookPickerView } from "../views/SongbookPickerView";

type Section = "playlists" | "songbook" | "setlists";

const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: "playlists", label: "Playlists" },
  { key: "songbook", label: "Songbook" },
  { key: "setlists", label: "Setlists" },
];

export function LibraryScreenContent() {
  const model = useLibraryScreenModel();
  const songbook = useSongbookModel();
  const [section, setSection] = useState<Section>("playlists");

  const inSub =
    section === "playlists" ? model.showBack : section === "songbook" ? songbook.showBack : false;
  const onBack =
    section === "playlists" ? model.handleBackPress : section === "songbook" ? songbook.handleBack : undefined;

  const headerTitle =
    section === "playlists"
      ? model.pageTitle
      : section === "songbook"
        ? songbook.pickerState
          ? "Add Charts"
          : songbook.activeSongbook?.title ?? "Library"
        : "Library";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={headerTitle}
        leftIcon={inSub ? "back" : "hamburger"}
        onLeftPress={inSub ? onBack : undefined}
      />

      {!inSub ? (
        <View style={tabStyles.row}>
          {SECTIONS.map((tab) => {
            const active = tab.key === section;
            return (
              <Pressable
                key={tab.key}
                style={[tabStyles.tab, active ? tabStyles.tabActive : null]}
                onPress={() => setSection(tab.key)}
              >
                <Text style={[tabStyles.tabText, active ? tabStyles.tabTextActive : null]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {section === "playlists" ? (
        <>
          {model.showBack ? <AppBreadcrumbs items={model.breadcrumbItems} /> : null}
          <PageIntro title={model.pageTitle} subtitle={model.pageSubtitle} />

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
        </>
      ) : null}

      {section === "songbook" ? (
        songbook.pickerState ? (
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
        )
      ) : null}

      {section === "setlists" ? (
        <ScrollView style={styles.flexFill} contentContainerStyle={styles.libraryScrollContent}>
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="albums-outline" size={18} color="#0f172a" />
              <Text style={styles.cardTitle}>Setlists</Text>
            </View>
            <Text style={styles.cardMeta}>
              Coming soon — group clips and charts into an ordered set you can share with your band as a
              ready-to-play bundle.
            </Text>
          </View>
        </ScrollView>
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

const tabStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: radii.round,
    padding: 3,
    marginHorizontal: 16,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radii.round,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
});
