import { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
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
import { SettingsRecordingView } from "../views/SettingsRecordingView";
import { SettingsStorageView } from "../views/SettingsStorageView";

export function SettingsScreenContent() {
  useBrowseRootBackHandler();

  const workspaces = useStore((state) => state.workspaces);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const workspaceStartupPreference = useStore((state) => state.workspaceStartupPreference);
  const setWorkspaceStartupPreference = useStore((state) => state.setWorkspaceStartupPreference);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useStore((state) => state.setHapticsEnabled);

  const screen = useSettingsScreenModel();
  const backupFlow = useLibraryBackupFlow();
  const exportFlow = useLibraryExportFlow();
  const importFlow = useLibraryImportFlow();
  const diagnostics = useStorageDiagnostics({ active: screen.view === "storage" });

  const primaryWorkspaceTitle = useMemo(
    () => workspaces.find((workspace) => workspace.id === primaryWorkspaceId)?.title ?? null,
    [primaryWorkspaceId, workspaces]
  );

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
      {/* The serif title lives in each view's PageIntro; the header stays untitled. */}
      <ScreenHeader
        title=""
        leftIcon={screen.showSubscreen ? "back" : "hamburger"}
        onLeftPress={handleBackPress}
      />

      {screen.view === "library" ? (
        <SettingsLibraryView
          backupFlow={backupFlow}
          diagnostics={diagnostics}
          onBeginExportFlow={() => screen.setView("export")}
          onBeginImportFlow={() => screen.setView("import")}
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
      ) : screen.view === "recording" ? (
        <SettingsRecordingView />
      ) : screen.view === "about" ? (
        <SettingsAboutView />
      ) : (
        <SettingsOverviewView
          workspaceStartupPreference={workspaceStartupPreference}
          setWorkspaceStartupPreference={setWorkspaceStartupPreference}
          hapticsEnabled={hapticsEnabled}
          setHapticsEnabled={setHapticsEnabled}
          primaryWorkspaceTitle={primaryWorkspaceTitle}
          backupFlow={backupFlow}
          onOpenLibrary={() => screen.setView("library")}
          onOpenRecording={() => screen.setView("recording")}
          onOpenAbout={() => screen.setView("about")}
        />
      )}
    </SafeAreaView>
  );
}
