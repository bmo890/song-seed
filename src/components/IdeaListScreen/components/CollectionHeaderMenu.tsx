import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { buildPlayableQueueFromIdeas } from "../../../domain/clipPresentation";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { durations } from "../../../design/motion";
import { colors } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { AppAlert } from "../../common/AppAlert";
import { toast } from "../../common/toastStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

// Nav-row height below the safe-area inset — drops the menu just under the ⋯.
const HEADER_ROW_HEIGHT = 46;

export function CollectionHeaderMenu() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { screen, inlinePlayer, importFlow, management } = useCollectionScreen();

  if (!screen.headerMenuOpen) return null;

  // In rendered order (entries), resolved to ideas through the model's list.
  const ideaById = new Map(screen.listIdeas.map((idea) => [idea.id, idea]));
  const playableIdeas = screen.listEntries
    .filter((entry): entry is Extract<(typeof screen.listEntries)[number], { type: "idea" }> => entry.type === "idea")
    .map((entry) => ideaById.get(entry.ideaId))
    .filter((idea): idea is NonNullable<typeof idea> => idea != null);

  const playAllIdeas = async () => {
    const queue = buildPlayableQueueFromIdeas(playableIdeas);
    if (queue.length === 0) return;
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueueForScreen(queue, 0, true);
  };

  return (
    <View style={styles.ideasHeaderMenuLayer} pointerEvents="box-none">
      <Pressable
        style={styles.ideasHeaderMenuBackdrop}
        onPress={() => screen.setHeaderMenuOpen(false)}
      />
      <Animated.View
        style={[
          styles.ideasSortMenu,
          styles.ideasHeaderOverflowMenu,
          // The menu layer is a full-screen absolute fill, so anchor below the
          // safe-area inset + nav row rather than the raw screen top.
          { top: insets.top + HEADER_ROW_HEIGHT },
        ]}
        entering={FadeIn.duration(durations.fast)}
      >
        <Pressable
          style={({ pressed }) => [
            styles.ideasToggleRow,
            buildPlayableQueueFromIdeas(playableIdeas).length === 0 ? styles.btnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => {
            haptic.tap();
            screen.setHeaderMenuOpen(false);
            void playAllIdeas();
          }}
          disabled={buildPlayableQueueFromIdeas(playableIdeas).length === 0}
        >
          <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.playAll")}</Text>
          <Ionicons name="play" size={15} color={colors.textSecondary} />
        </Pressable>
        {/* Share this place — as a SongNook file or a Send link. One row; the
            sheet it opens holds the two exits (CollectionModals). A received
            package can be passed along the same way. */}
        <View style={styles.ideasDropdownDivider} />
        <Pressable
          testID="collection-menu-share"
          style={({ pressed }) => [
            styles.ideasToggleRow,
            management.isSharingCollection ? styles.btnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => {
            haptic.tap();
            screen.setHeaderMenuOpen(false);
            management.setShareSheetOpen(true);
          }}
          disabled={management.isSharingCollection}
        >
          <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.share")}</Text>
          <Ionicons name="share-outline" size={15} color={colors.textSecondary} />
        </Pressable>
        {screen.isReceivedWorkspace ? (
          // A received package: 'Keep this…' sits in the open on the page;
          // only the destructive exit lives here, and nothing is created inside it.
          <>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              testID="collection-menu-delete-package"
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                screen.setHeaderMenuOpen(false);
                const pkg = screen.activeWorkspace;
                if (!pkg) return;
                AppAlert.destructive(
                  t("received.deleteTitle"),
                  t("received.deleteBody", { title: pkg.title, items: t("received.items", { count: pkg.ideas.length }) }),
                  () => {
                    useStore.getState().deleteWorkspace(pkg.id);
                    haptic.success();
                    screen.onBack?.();
                  },
                  { confirmLabel: t("common.delete") }
                );
              }}
            >
              <Text style={[styles.ideasSortMenuItemText, { color: colors.danger }]} numberOfLines={1}>
                {t("received.deletePackage")}
              </Text>
              <Ionicons name="trash-outline" size={15} color={colors.danger} />
            </Pressable>
          </>
        ) : null}
        {!screen.isReceivedWorkspace ? (
        <>
        <View style={styles.ideasDropdownDivider} />
        {/* Creation rows — moved here from the "+" FAB (single-FAB rule): the
            record FAB stays THE action; new-song and import are overflow work.
            haptics vocabulary: `tap` — "Any acknowledged press: buttons, rows". */}
        <Pressable
          testID="collection-menu-new-song"
          style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            screen.setHeaderMenuOpen(false);
            const createdIdeaId = appActions.addIdea(screen.collectionId!);
            screen.navigateRoot("IdeaDetail", { ideaId: createdIdeaId });
          }}
        >
          <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.song")}</Text>
          <Ionicons name={getHierarchyIconName("song")} size={15} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.ideasDropdownDivider} />
        <Pressable
          testID="collection-menu-import"
          style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            screen.setHeaderMenuOpen(false);
            void importFlow.openImportAudioFlow();
          }}
        >
          <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.import")}</Text>
          <Ionicons name="download-outline" size={15} color={colors.textSecondary} />
        </Pressable>
        </>
        ) : null}
        {__DEV__ ? (
          <>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              testID="collection-menu-dev-samples"
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                screen.setHeaderMenuOpen(false);
                void importFlow.openDevSampleImport();
              }}
            >
              <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.importSamplesDev")}</Text>
              <Ionicons name="flask-outline" size={15} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              testID="collection-menu-dev-song"
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                screen.setHeaderMenuOpen(false);
                void importFlow.openDevSampleImportAsSong();
              }}
            >
              <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.importSongDev")}</Text>
              <Ionicons name="flask-outline" size={15} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              testID="collection-menu-dev-receive"
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                screen.setHeaderMenuOpen(false);
                void importFlow.openDevSampleReceive();
              }}
            >
              <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.receiveSamplesDev")}</Text>
              <Ionicons name="flask-outline" size={15} color={colors.textSecondary} />
            </Pressable>
          </>
        ) : null}
        <View style={styles.ideasDropdownDivider} />
        <Pressable
          style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
          onPress={() => {
            screen.setListDensity((prev) => (prev === "compact" ? "comfortable" : "compact"));
            screen.setHeaderMenuOpen(false);
          }}
        >
          <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.compactView")}</Text>
          <View
            style={[
              styles.ideasSwitch,
              screen.listDensity === "compact" ? styles.ideasSwitchActive : null,
            ]}
          >
            <View
              style={[
                styles.ideasSwitchThumb,
                screen.listDensity === "compact" ? styles.ideasSwitchThumbActive : null,
              ]}
            />
          </View>
        </Pressable>
        <View style={styles.ideasDropdownDivider} />
        <Pressable
          style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            screen.setHeaderMenuOpen(false);
            screen.navigateRoot("Activity", {
              workspaceId: screen.activeWorkspace?.id,
              collectionId: screen.currentCollection?.id,
            });
          }}
        >
          <Text style={styles.ideasSortMenuItemText} numberOfLines={1}>{t("collection.viewActivity")}</Text>
          <Ionicons name="grid-outline" size={15} color={colors.textSecondary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
