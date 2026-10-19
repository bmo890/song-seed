import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { buildPlayableQueueFromIdeas } from "../../../domain/clipPresentation";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { durations } from "../../../design/motion";
import { haptic } from "../../../design/haptics";
import { AppAlert } from "../../common/AppAlert";
import { PopoverMenuRow, PopoverMenuRule } from "../../common/PopoverMenu";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { setDevFreeMonthStart, syncFreeMonth } from "../../../services/freeMonthClock";
import { openProUpsell } from "../../common/proUpsell";

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

  const canPlayAll = buildPlayableQueueFromIdeas(playableIdeas).length > 0;
  const compact = screen.listDensity === "compact";
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
        {/* Order rule (SelectionActionSheet): act (play, make, bring in),
            how the page looks, go somewhere, send it out, then destruction;
            the dev rows sit apart at the very end. */}
        <PopoverMenuRow
          icon="play-outline"
          label={t("collection.playAll")}
          disabled={!canPlayAll}
          onPress={() => {
            screen.setHeaderMenuOpen(false);
            void playAllIdeas();
          }}
        />
        {!screen.isReceivedWorkspace ? (
          <>
            {/* Creation rows — moved here from the "+" FAB (single-FAB rule):
                the record FAB stays THE action. */}
            <PopoverMenuRow
              testID="collection-menu-new-song"
              icon={getHierarchyIconName("song")}
              label={t("collection.song")}
              onPress={() => {
                screen.setHeaderMenuOpen(false);
                const createdIdeaId = appActions.addIdea(screen.collectionId!);
                screen.navigateRoot("IdeaDetail", { ideaId: createdIdeaId });
              }}
            />
            <PopoverMenuRow
              testID="collection-menu-import"
              icon="download-outline"
              label={t("collection.import")}
              onPress={() => {
                screen.setHeaderMenuOpen(false);
                void importFlow.openImportAudioFlow();
              }}
            />
          </>
        ) : null}
        <PopoverMenuRow
          icon="reorder-four-outline"
          label={t("collection.compactView")}
          haptic="light"
          onPress={() => {
            screen.setListDensity((prev) => (prev === "compact" ? "comfortable" : "compact"));
            screen.setHeaderMenuOpen(false);
          }}
          trailing={
            <View style={[styles.ideasSwitch, compact ? styles.ideasSwitchActive : null]}>
              <View style={[styles.ideasSwitchThumb, compact ? styles.ideasSwitchThumbActive : null]} />
            </View>
          }
        />
        <PopoverMenuRow
          icon="analytics-outline"
          label={t("collection.viewActivity")}
          haptic="navigate"
          onPress={() => {
            screen.setHeaderMenuOpen(false);
            screen.navigateRoot("Activity", {
              workspaceId: screen.activeWorkspace?.id,
              collectionId: screen.currentCollection?.id,
            });
          }}
        />
        {/* Share this place — as a SongNook file or a Send link. One row; the
            sheet it opens holds the two exits (CollectionModals). */}
        <PopoverMenuRow
          testID="collection-menu-share"
          icon="share-outline"
          label={t("collection.share")}
          disabled={management.isSharingCollection}
          onPress={() => {
            screen.setHeaderMenuOpen(false);
            management.setShareSheetOpen(true);
          }}
        />
        {screen.isReceivedWorkspace ? (
          <>
            <PopoverMenuRule />
            <PopoverMenuRow
              testID="collection-menu-delete-package"
              icon="trash-outline"
              tone="danger"
              label={t("received.deletePackage")}
              onPress={() => {
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
            />
          </>
        ) : null}
        {__DEV__ ? (
          <>
            <PopoverMenuRule />
            <PopoverMenuRow
              testID="collection-menu-dev-samples"
              icon="flask-outline"
              label={t("collection.importSamplesDev")}
              onPress={() => {
                screen.setHeaderMenuOpen(false);
                void importFlow.openDevSampleImport();
              }}
            />
            <PopoverMenuRow
              testID="collection-menu-dev-song"
              icon="flask-outline"
              label={t("collection.importSongDev")}
              onPress={() => {
                screen.setHeaderMenuOpen(false);
                void importFlow.openDevSampleImportAsSong();
              }}
            />
            <PopoverMenuRow
              testID="collection-menu-dev-receive"
              icon="flask-outline"
              label={t("collection.receiveSamplesDev")}
              onPress={() => {
                screen.setHeaderMenuOpen(false);
                void importFlow.openDevSampleReceive();
              }}
            />
            <PopoverMenuRow
              testID="collection-menu-dev-pro"
              icon="flask-outline"
              label={t("collection.proPreviewDev")}
              onPress={() => {
                screen.setHeaderMenuOpen(false);
                // Preview the Pro sheet as on day 26 of the free month (4 days left).
                setDevFreeMonthStart(Date.now() - 26 * 24 * 60 * 60 * 1000);
                void syncFreeMonth(useStore.getState().firstLaunchAt).then(() => openProUpsell());
              }}
            />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}
