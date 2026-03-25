import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { PageIntro } from "../../common/PageIntro";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { styles } from "../styles";
import { useLibraryScreenModel } from "../hooks/useLibraryScreenModel";
import { PlaylistListView } from "../views/PlaylistListView";
import { PlaylistDetailView } from "../views/PlaylistDetailView";
import { PlaylistPickerView } from "../views/PlaylistPickerView";

export function LibraryScreenContent() {
  const model = useLibraryScreenModel();

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={model.pageTitle}
        leftIcon={model.showBack ? "back" : "hamburger"}
        onLeftPress={model.showBack ? model.handleBackPress : undefined}
      />
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
