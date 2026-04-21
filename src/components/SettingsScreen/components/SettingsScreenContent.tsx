import { useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useSettingsScreenModel } from "../hooks/useSettingsScreenModel";
import { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { useLibraryExportFlow } from "../hooks/useLibraryExportFlow";
import { useLibraryImportFlow } from "../hooks/useLibraryImportFlow";
import { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { useGlobalTagSettings } from "../hooks/useGlobalTagSettings";
import { SettingsExportView } from "../views/SettingsExportView";
import { SettingsImportView } from "../views/SettingsImportView";
import { SettingsOverviewView } from "../views/SettingsOverviewView";
import { SettingsStorageView } from "../views/SettingsStorageView";

export function SettingsScreenContent() {
  useBrowseRootBackHandler();
  const navigation = useNavigation();

  const workspaces = useStore((state) => state.workspaces);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const bluetoothMonitoringCalibrations = useStore((state) => state.bluetoothMonitoringCalibrations);
  const workspaceStartupPreference = useStore((state) => state.workspaceStartupPreference);
  const setWorkspaceStartupPreference = useStore((state) => state.setWorkspaceStartupPreference);

  const screen = useSettingsScreenModel();
  const backupFlow = useLibraryBackupFlow();
  const exportFlow = useLibraryExportFlow();
  const importFlow = useLibraryImportFlow();
  const diagnostics = useStorageDiagnostics({ active: screen.view === "storage" });
  const globalTags = useGlobalTagSettings();

  const primaryWorkspaceTitle = useMemo(
    () => workspaces.find((workspace) => workspace.id === primaryWorkspaceId)?.title ?? null,
    [primaryWorkspaceId, workspaces]
  );

  const handleBackPress =
    screen.view === "export" || screen.view === "import"
      ? screen.view === "export"
        ? exportFlow.isExporting
          ? undefined
          : () => screen.setView("overview")
        : importFlow.isImporting
          ? undefined
          : () => screen.setView("overview")
      : screen.view === "storage"
        ? diagnostics.isStorageLoading
          ? undefined
          : () => screen.setView("overview")
        : undefined;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={screen.title}
        leftIcon={screen.showSubscreen ? "back" : "hamburger"}
        onLeftPress={handleBackPress}
      />
      {screen.showSubscreen ? <AppBreadcrumbs items={screen.breadcrumbItems} /> : null}

      {screen.view === "export" ? (
        <SettingsExportView
          flow={exportFlow}
          onCancel={() => {
            if (!exportFlow.isExporting) {
              screen.setView("overview");
            }
          }}
        />
      ) : screen.view === "import" ? (
        <SettingsImportView
          flow={importFlow}
          onCancel={() => {
            if (!importFlow.isImporting) {
              screen.setView("overview");
            }
          }}
        />
      ) : screen.view === "storage" ? (
        <SettingsStorageView diagnostics={diagnostics} />
      ) : (
        <SettingsOverviewView
          workspaceStartupPreference={workspaceStartupPreference}
          setWorkspaceStartupPreference={setWorkspaceStartupPreference}
          primaryWorkspaceTitle={primaryWorkspaceTitle}
          backupFlow={backupFlow}
          globalTags={globalTags}
          diagnostics={diagnostics}
          bluetoothCalibrationCount={bluetoothMonitoringCalibrations.length}
          onOpenStorageDetails={() => {
            diagnostics.setShowAdvancedStorageDetails(false);
            screen.setView("storage");
          }}
          onOpenBluetoothCalibration={() => navigation.navigate("BluetoothCalibration" as never)}
          onBeginExportFlow={() => screen.setView("export")}
          onBeginImportFlow={() => screen.setView("import")}
        />
      )}
    </SafeAreaView>
  );
}
