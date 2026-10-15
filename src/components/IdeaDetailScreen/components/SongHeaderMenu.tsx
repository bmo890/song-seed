import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { styles } from "../styles";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { durations } from "../../../design/motion";
import { useOriginRoute } from "../../../hooks/useOriginLabel";
import { openIdeaInCollection } from "../../../navigation";
import { useSongScreen } from "../provider/SongScreenProvider";
import { DockAddBadgeIcon } from "../../common/dockIcons";
import { PopoverMenuRow, PopoverMenuRule } from "../../common/PopoverMenu";
import { getHierarchyIconName } from "../../../domain/hierarchy";

// Nav-row height below the safe-area inset — drops the menu just under the ⋯
// (the header's 2 pt top margin + its nav row), same anchor as the collection.
const HEADER_ROW_HEIGHT = 56;

/**
 * The sketch/clip page's ⋯ menu, mounted at SCREEN level (last child of the
 * page) so its backdrop covers the whole page. It used to live inside the
 * header View, whose box is one nav row tall: a tap on the takes list fell
 * through to the list and left the menu open, and on Android the rows hanging
 * below the header's bounds could not be tapped at all (2026-10-03). Same
 * construction as the collection's CollectionHeaderMenu.
 */
export function SongHeaderMenu() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { screen, actions, importFlow, share } = useSongScreen();
  // While clips are selected, the bottom bar already offers a clip "Delete". Disable
  // the song-level delete here so it can't be tapped by mistake mid-selection.
  const isSelectingClips = useStore((s) => s.selectedClipIds.length > 0);
  // "View in collection" earns a row only when back does NOT already land on this
  // idea's collection — i.e. the sketch was opened from Activity, Search, the
  // Shelf, a playlist… From its own collection the chevron is that action.
  const originRoute = useOriginRoute();

  const selectedIdea = screen.selectedIdea;
  if (!screen.headerMenuOpen || !selectedIdea) return null;

  const close = () => screen.setHeaderMenuOpen(false);
  const isProject = selectedIdea.kind === "project";
  const isNewProjectDraft = selectedIdea.isDraft;
  const playAllDisabled = !screen.isProject || actions.buildProjectQueue().length === 0;
  const canViewInCollection =
    !!selectedIdea.collectionId &&
    !selectedIdea.isDraft &&
    originRoute?.params?.collectionId !== selectedIdea.collectionId;

  return (
    <View style={styles.ideasHeaderMenuLayer} pointerEvents="box-none">
      <Pressable style={styles.ideasHeaderMenuBackdrop} onPress={close} />
      <Animated.View
        style={[
          styles.ideasSortMenu,
          styles.ideasHeaderOverflowMenu,
          // The layer is a full-screen absolute fill, so anchor below the
          // safe-area inset + nav row rather than the raw screen top.
          { top: insets.top + HEADER_ROW_HEIGHT },
        ]}
        entering={FadeIn.duration(durations.fast)}
      >
        {/* Order rule (SelectionActionSheet): act on it, organise, go
            somewhere, send it out, then destruction behind a hairline. */}
        {isProject ? (
          <PopoverMenuRow
            icon="play-outline"
            label={t("songDetail.playAll")}
            disabled={playAllDisabled}
            onPress={() => {
              close();
              actions.playProjectQueue();
            }}
          />
        ) : null}
        <PopoverMenuRow
          icon="create-outline"
          label={isProject ? t("songDetail.editSong") : t("songDetail.editClip")}
          onPress={() => {
            close();
            screen.setIsEditMode(true);
          }}
        />
        {!isProject ? (
          <PopoverMenuRow
            // The sketch disc with the "+" badge — the one glyph for "make a
            // sketch", shared with the collection's selection dock.
            renderIcon={(color) => (
              <DockAddBadgeIcon base={getHierarchyIconName("song")} color={color} size={18} />
            )}
            label={t("songDetail.makeSong")}
            onPress={() => {
              close();
              appActions.convertSelectedClipIdeaToProject();
              // Same step the other two sketch entry points take: name and
              // stage it now, while the intent is fresh (2026-09-10).
              screen.setIsEditMode(true);
            }}
          />
        ) : null}
        {isProject ? (
          // Import moved here from the "+" FAB — record stands alone.
          <PopoverMenuRow
            icon="download-outline"
            label={t("songDetail.import")}
            onPress={() => {
              close();
              void importFlow.openImportAudioFlow();
            }}
          />
        ) : null}
        {canViewInCollection ? (
          // Same glyph, same meaning as the cards' button: open this idea's
          // collection as a visit. Navigation is silent.
          <PopoverMenuRow
            testID="song-menu-view-in-collection"
            icon="open-outline"
            label={t("songDetail.viewInCollection")}
            haptic="navigate"
            onPress={() => {
              close();
              openIdeaInCollection(screen.navigation, selectedIdea.id);
            }}
          />
        ) : null}
        {isProject ? (
          // The whole sketch — takes, lyrics, chords, notes — as a file or a
          // SongNook Send link. One row; the sheet holds the two exits.
          <PopoverMenuRow
            testID="song-menu-share"
            icon="share-outline"
            label={t("songDetail.share")}
            disabled={share.busy}
            onPress={() => {
              close();
              share.setSheetOpen(true);
            }}
          />
        ) : null}
        {!isNewProjectDraft ? (
          <>
            <PopoverMenuRule />
            <PopoverMenuRow
              icon="trash-outline"
              tone="danger"
              label={isProject ? t("songDetail.deleteSong") : t("songDetail.deleteClip")}
              disabled={isSelectingClips}
              onPress={() => {
                close();
                if (isProject && selectedIdea.clips.length > 0) {
                  // A sketch with takes: the frame can come off without the
                  // takes going with it (founder, 2026-10-12).
                  AppAlert.custom(t("songDetail.deleteSongTitle"), t("songDetail.deleteSongChoiceBody"), [
                    { label: t("common.cancel"), style: "cancel" },
                    {
                      label: t("songDetail.deleteSongKeepTakes"),
                      style: "default",
                      icon: getHierarchyIconName("clip"),
                      onPress: () => {
                        appActions.dissolveSketch(selectedIdea.id);
                        screen.navigation.goBack();
                      },
                    },
                    {
                      label: t("songDetail.deleteSongDeleteAll"),
                      style: "destructive",
                      icon: "trash-outline",
                      onPress: () => {
                        appActions.deleteSelectedIdea();
                        screen.navigation.goBack();
                      },
                    },
                  ]);
                  return;
                }
                AppAlert.destructive(
                  isProject ? t("songDetail.deleteSongTitle") : t("songDetail.deleteClipTitle"),
                  isProject
                    ? t("songDetail.deleteSongBody", { title: selectedIdea.title })
                    : t("songDetail.deleteClipBody", { title: selectedIdea.title }),
                  () => {
                    appActions.deleteSelectedIdea();
                    screen.navigation.goBack();
                  },
                  { confirmLabel: t("common.delete") }
                );
              }}
            />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}
