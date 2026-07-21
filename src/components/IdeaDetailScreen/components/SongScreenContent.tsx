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
import { SongParentPickBanner } from "./SongParentPickBanner";
import { SongUndoBanner } from "./SongUndoBanner";
import { SongEditSheet } from "./SongEditSheet";
import { useTranslation } from "react-i18next";

export function SongScreenContent() {
  const { t } = useTranslation();
  const { screen, parentPicking, store, actions, importFlow, editFlow } = useSongScreen();

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
      {parentPicking.parentPickState ? <SongParentPickBanner /> : <SelectionBars />}
      <SongLyricsSection />
      <SongChartSection />
      <SongNotesSection />
      <SongTakesSection />
      {screen.isProject &&
      !screen.isEditMode &&
      !store.clipSelectionMode &&
      !parentPicking.parentPickState &&
      screen.songTab === "takes" ? (
        <FloatingActionDock
          onRecord={() => actions.startRecording(null)}
          menuItems={[
            {
              key: "import",
              label: t("songDetail.import"),
              icon: "download-outline",
              onPress: () => {
                void importFlow.openImportAudioFlow();
              },
            },
          ]}
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
    </SafeAreaView>
  );
}
