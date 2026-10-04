import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { styles } from "../styles";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { haptic } from "../../../design/haptics";
import { durations } from "../../../design/motion";
import { colors } from "../../../design/tokens";
import { useOriginRoute } from "../../../hooks/useOriginLabel";
import { openIdeaInCollection } from "../../../navigation";
import { useSongScreen } from "../provider/SongScreenProvider";

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
  const { screen, actions, importFlow } = useSongScreen();
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
        <Pressable
          style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
          onPress={() => {
            close();
            haptic.tap();
            screen.setIsEditMode(true);
          }}
        >
          <Text style={styles.ideasSortMenuItemText}>
            {isProject ? t("songDetail.editSong") : t("songDetail.editClip")}
          </Text>
          <Ionicons name="create-outline" size={15} color={colors.textStrong} />
        </Pressable>
        {isProject ? (
          <>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              style={({ pressed }) => [
                styles.ideasToggleRow,
                playAllDisabled ? styles.btnDisabled : null,
                pressed ? styles.pressDown : null,
              ]}
              disabled={playAllDisabled}
              onPress={() => {
                close();
                haptic.tap();
                actions.playProjectQueue();
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>{t("songDetail.playAll")}</Text>
              <Ionicons name="play-outline" size={15} color={colors.textStrong} />
            </Pressable>
            <View style={styles.ideasDropdownDivider} />
            {/* Import moved here from the "+" FAB — record stands alone. */}
            <Pressable
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                close();
                haptic.tap();
                void importFlow.openImportAudioFlow();
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>{t("songDetail.import")}</Text>
              <Ionicons name="download-outline" size={15} color={colors.textStrong} />
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                close();
                haptic.tap();
                appActions.convertSelectedClipIdeaToProject();
                // Same step the other two sketch entry points take: name and
                // stage it now, while the intent is fresh (2026-09-10).
                screen.setIsEditMode(true);
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>{t("songDetail.makeSong")}</Text>
              <Ionicons name="albums-outline" size={15} color={colors.textStrong} />
            </Pressable>
          </>
        )}
        {canViewInCollection ? (
          <>
            <View style={styles.ideasDropdownDivider} />
            {/* Same glyph, same meaning as the cards' button: open this idea's
                collection as a visit, scrolled to and highlighting its card.
                Navigation is silent — no haptic. */}
            <Pressable
              testID="song-menu-view-in-collection"
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                close();
                openIdeaInCollection(screen.navigation, selectedIdea.id);
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>{t("songDetail.viewInCollection")}</Text>
              <Ionicons name="open-outline" size={15} color={colors.textStrong} />
            </Pressable>
          </>
        ) : null}
        {!isNewProjectDraft ? (
          <>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              style={({ pressed }) => [
                styles.ideasToggleRow,
                isSelectingClips ? styles.btnDisabled : null,
                pressed && !isSelectingClips ? styles.pressDown : null,
              ]}
              disabled={isSelectingClips}
              onPress={() => {
                close();
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
            >
              <Text style={isSelectingClips ? styles.ideasSortMenuItemText : styles.songDetailDangerMenuText}>
                {isProject ? t("songDetail.deleteSong") : t("songDetail.deleteClip")}
              </Text>
              <Ionicons
                name="trash-outline"
                size={15}
                color={isSelectingClips ? colors.textMuted : colors.danger}
              />
            </Pressable>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}
