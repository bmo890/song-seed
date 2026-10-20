import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { FloatingActionDock } from "../../common/FloatingActionDock";
import { SongHeaderSection } from "../sections/SongHeaderSection";
import { SongLyricsSection } from "../sections/SongLyricsSection";
import { SongChartSection } from "../sections/SongChartSection";
import { SongNotesSection } from "../sections/SongNotesSection";
import { SongTakesSection } from "../sections/SongTakesSection";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { SelectionBars } from "./SelectionBars";
import { SongClipboardBanner } from "./SongClipboardBanner";
import { SongImportModal } from "./SongImportModal";
import { SongUndoBanner } from "./SongUndoBanner";
import { SongEditSheet } from "./SongEditSheet";
import { SongHeaderMenu } from "./SongHeaderMenu";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { isSendServiceConfigured } from "../../../config/sendService";

// "SongNook Send" needs a real transfer endpoint — same gate as the Library views.
const SHOW_SEND = __DEV__ || isSendServiceConfigured();
import { useTranslation } from "react-i18next";

export function SongScreenContent() {
  const { t } = useTranslation();
  const { screen, parentPicking, store, actions, editFlow, share } = useSongScreen();

  if (!screen.selectedIdea) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader
          title={t("songDetail.song")}
          leftIcon="back"
          onLeftPress={() => {
            if ((screen.navigation as any).canGoBack?.()) {
              (screen.navigation as any).goBack();
              return;
            }
            screen.navigateRoot("Home", {
              screen: "WorkspaceStack",
              params: { screen: "Browse" },
            });
          }}
        />
        <Text style={styles.emptyText}>{t("songDetail.notFound")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      // The bottom-anchored overlays (selection dock, FAB) and the scroll content
      // already account for the safe-area inset themselves, so don't pad it twice.
      edges={["top", "left", "right"]}
      style={[
        styles.screen,
        screen.selectedIdea.kind === "project" ? styles.screenProjectDetail : styles.screenClipDetail,
      ]}
    >
      <SongHeaderSection />
      <SongClipboardBanner />
      {/* Choosing a parent speaks from the toolbar line; no dock meanwhile. */}
      {parentPicking.parentPickState ? null : <SelectionBars />}
      <SongLyricsSection />
      <SongChartSection />
      <SongNotesSection />
      <SongTakesSection />
      {screen.isProject &&
      !screen.isEditMode &&
      !store.clipSelectionMode &&
      !parentPicking.parentPickState &&
      screen.songTab === "takes" ? (
        // One primary action: the record FAB stands alone. Import lives in the
        // header overflow (same consolidation as the collection screen).
        <FloatingActionDock
          onRecord={() => actions.startRecording(null)}
        />
      ) : null}
      <SongUndoBanner />
      <SongImportModal />
      {screen.isProject ? (
        <SongEditSheet
          visible={screen.isEditMode}
          isDraft={!!screen.selectedIdea.isDraft}
          title={screen.draftTitle}
          onChangeTitle={screen.setDraftTitle}
          status={screen.draftStatus}
          onChangeStatus={screen.setDraftStatus}
          completion={screen.draftCompletion}
          onChangeCompletion={screen.setDraftCompletion}
          onSave={editFlow.handleSave}
          onCancel={() => editFlow.handleCancel()}
        />
      ) : null}
      {/* Share… from the ⋯: Export (a file) · SongNook Send (a link). */}
      <SelectionActionSheet
        visible={share.sheetOpen}
        title={t("songDetail.shareSketchTitle")}
        onClose={() => share.setSheetOpen(false)}
        actions={[
          { key: "export", label: t("songDetail.exportSketch"), icon: "folder-open-outline", onPress: () => void share.exportSketch() },
          ...(SHOW_SEND
            ? [{ key: "songnook-send", label: t("songDetail.getLink"), icon: "paper-plane-outline" as const, onPress: share.sendSketch }]
            : []),
        ]}
      />
      {/* Last child: its backdrop must sit over everything above. */}
      <SongHeaderMenu />
    </SafeAreaView>
  );
}
