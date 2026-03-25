import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ScreenHeader } from "../../common/ScreenHeader";
import { FloatingActionDock } from "../../common/FloatingActionDock";
import { SongHeaderSection } from "../sections/SongHeaderSection";
import { SongLyricsSection } from "../sections/SongLyricsSection";
import { SongNotesSection } from "../sections/SongNotesSection";
import { SongTakesSection } from "../sections/SongTakesSection";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { SelectionBars } from "./SelectionBars";
import { SongTabs } from "./SongTabs";
import { SongClipboardBanner } from "./SongClipboardBanner";
import { SongImportModal } from "./SongImportModal";
import { SongParentPickBanner } from "./SongParentPickBanner";
import { SongUndoBanner } from "./SongUndoBanner";

export function SongScreenContent() {
  const { screen, parentPicking, store, actions, importFlow } = useSongScreen();

  if (!screen.selectedIdea) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader
          title="Song"
          leftIcon="back"
          onLeftPress={() => {
            if ((screen.navigation as any).canGoBack?.()) {
              (screen.navigation as any).goBack();
              return;
            }
            screen.navigateRoot("Home", { screen: "Browse" });
          }}
        />
        <Text style={styles.emptyText}>This song could not be found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.screen,
        screen.selectedIdea.kind === "project" ? styles.screenProjectDetail : styles.screenClipDetail,
      ]}
    >
      <SongHeaderSection />
      <SongClipboardBanner />
      {parentPicking.parentPickState ? <SongParentPickBanner /> : <SelectionBars />}
      <SongTabs />
      <SongLyricsSection />
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
              label: "Import",
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
      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
