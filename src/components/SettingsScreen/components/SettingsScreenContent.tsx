import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useSettingsScreenModel } from "../hooks/useSettingsScreenModel";
import { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { useLibraryExportFlow } from "../hooks/useLibraryExportFlow";
import { useLibraryImportFlow } from "../hooks/useLibraryImportFlow";
import { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { SettingsAboutView } from "../views/SettingsAboutView";
import { SettingsExportView } from "../views/SettingsExportView";
import { SettingsImportView } from "../views/SettingsImportView";
import { SettingsLibraryView } from "../views/SettingsLibraryView";
import { SettingsOverviewView } from "../views/SettingsOverviewView";
import { SettingsGeneralView } from "../views/SettingsGeneralView";
import { SettingsSharingView } from "../views/SettingsSharingView";
import { SettingsStorageView } from "../views/SettingsStorageView";

export function SettingsScreenContent() {
  useBrowseRootBackHandler();
  const { t } = useTranslation();

  const screen = useSettingsScreenModel();
  const backupFlow = useLibraryBackupFlow();
  const exportFlow = useLibraryExportFlow();
  const importFlow = useLibraryImportFlow();
  const diagnostics = useStorageDiagnostics({ active: screen.view === "storage" });

  // Back is held while a subscreen owns an operation that shouldn't be abandoned
  // mid-gesture (import runs inline; storage while scanning). Backup/export/restore run
  // in the global process host and don't block navigation. The blocked case must be an
  // explicit no-op — an undefined handler would fall through to navigation.goBack().
  const backBlocked =
    (screen.view === "import" && importFlow.isImporting) ||
    (screen.view === "storage" && diagnostics.isStorageLoading);
  const handleBackPress = screen.showSubscreen
    ? backBlocked
      ? () => {}
      : () => screen.setView(screen.backView)
    : undefined;

  return (
    <SafeAreaView style={styles.screen}>
      {/* The serif section title lives in each view's PageIntro. On the overview the
          header stays untitled (the PageIntro already says Settings); on subscreens
          the header says Settings so the top of the page never changes rooms. */}
      <ScreenHeader
        title={screen.showSubscreen ? t("settings.title") : ""}
        leftIcon={screen.showSubscreen ? "back" : "hamburger"}
        onLeftPress={handleBackPress}
      />

      {screen.view === "general" ? (
        <SettingsGeneralView />
      ) : screen.view === "library" ? (
        <SettingsLibraryView
          backupFlow={backupFlow}
          onBeginExportFlow={() => screen.setView("export")}
          onBeginImportFlow={() => screen.setView("import")}
          onOpenSentLinks={() => screen.setView("sharing")}
          onOpenStorageDetails={() => {
            diagnostics.setShowAdvancedStorageDetails(false);
            screen.setView("storage");
          }}
        />
      ) : screen.view === "export" ? (
        <SettingsExportView
          flow={exportFlow}
          onCancel={() => {
            if (!exportFlow.isExporting) {
              screen.setView("library");
            }
          }}
        />
      ) : screen.view === "import" ? (
        <SettingsImportView
          flow={importFlow}
          onCancel={() => {
            if (!importFlow.isImporting) {
              screen.setView("library");
            }
          }}
        />
      ) : screen.view === "storage" ? (
        <SettingsStorageView diagnostics={diagnostics} />
      ) : screen.view === "sharing" ? (
        <SettingsSharingView />
      ) : screen.view === "about" ? (
        <SettingsAboutView />
      ) : (
        <SettingsOverviewView
          backupFlow={backupFlow}
          onOpenPreferences={() => screen.setView("general")}
          onOpenLibrary={() => screen.setView("library")}
          onOpenAbout={() => screen.setView("about")}
        />
      )}
    </SafeAreaView>
  );
}
