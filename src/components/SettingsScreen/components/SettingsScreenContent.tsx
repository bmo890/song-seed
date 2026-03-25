import { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useSettingsScreenModel } from "../hooks/useSettingsScreenModel";
import { useLibraryExportFlow } from "../hooks/useLibraryExportFlow";
import { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { useGlobalTagSettings } from "../hooks/useGlobalTagSettings";
import { SettingsExportView } from "../views/SettingsExportView";
import { SettingsOverviewView } from "../views/SettingsOverviewView";
import { SettingsStorageView } from "../views/SettingsStorageView";

export function SettingsScreenContent() {
  useBrowseRootBackHandler();

  const workspaces = useStore((state) => state.workspaces);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const workspaceStartupPreference = useStore((state) => state.workspaceStartupPreference);
  const setWorkspaceStartupPreference = useStore((state) => state.setWorkspaceStartupPreference);

  const screen = useSettingsScreenModel();
  const exportFlow = useLibraryExportFlow();
  const diagnostics = useStorageDiagnostics({ active: screen.view === "storage" });
  const globalTags = useGlobalTagSettings();

  const primaryWorkspaceTitle = useMemo(
    () => workspaces.find((workspace) => workspace.id === primaryWorkspaceId)?.title ?? null,
    [primaryWorkspaceId, workspaces]
  );

  const handleBackPress =
    screen.view === "export"
      ? exportFlow.isExporting
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
      ) : screen.view === "storage" ? (
        <SettingsStorageView diagnostics={diagnostics} />
      ) : (
        <SettingsOverviewView
          workspaceStartupPreference={workspaceStartupPreference}
          setWorkspaceStartupPreference={setWorkspaceStartupPreference}
          primaryWorkspaceTitle={primaryWorkspaceTitle}
          globalTags={globalTags}
          diagnostics={diagnostics}
          onOpenStorageDetails={() => {
            diagnostics.setShowAdvancedStorageDetails(false);
            screen.setView("storage");
          }}
          onBeginExportFlow={() => screen.setView("export")}
        />
      )}
    </SafeAreaView>
  );
}
