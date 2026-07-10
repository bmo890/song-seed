import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { FormatOptionRow, LibraryActionCard, ToggleRow } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { haptic } from "../../../design/haptics";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

/**
 * Deliberately short: startup, feedback, and one doorway into the Library &
 * Backups page. Anything screen-specific (Bluetooth calibration, tag management)
 * lives on the screen it serves, not here.
 */
export function SettingsOverviewView({
  workspaceStartupPreference,
  setWorkspaceStartupPreference,
  hapticsEnabled,
  setHapticsEnabled,
  primaryWorkspaceTitle,
  backupFlow,
  onOpenLibrary,
  onOpenRecording,
  onOpenAbout,
}: {
  workspaceStartupPreference: "primary" | "last-used";
  setWorkspaceStartupPreference: (next: "primary" | "last-used") => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (next: boolean) => void;
  primaryWorkspaceTitle: string | null;
  backupFlow: LibraryBackupFlow;
  onOpenLibrary: () => void;
  onOpenRecording: () => void;
  onOpenAbout: () => void;
}) {
  const libraryMeta = backupFlow.isBackingUp
    ? backupFlow.backupProgressLabel ?? "Backing up…"
    : backupFlow.isRestoring
      ? backupFlow.restoreProgressLabel ?? "Restoring…"
      : backupFlow.lastSuccessfulBackupFileName
        ? `Last backup · ${backupFlow.lastSuccessfulBackupLabel}`
        : "No backup saved yet";

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title="Settings"
        subtitle="Where the app opens, feedback, recording defaults, and your library."
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Startup</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <FormatOptionRow
            title="Primary workspace"
            subtitle={
              primaryWorkspaceTitle
                ? `Opens ${primaryWorkspaceTitle} when the app starts.`
                : "Falls back to your last used workspace until a primary is set."
            }
            selected={workspaceStartupPreference === "primary"}
            onPress={() => setWorkspaceStartupPreference("primary")}
          />
          <FormatOptionRow
            title="Last used workspace"
            subtitle="Opens the workspace you most recently worked in."
            selected={workspaceStartupPreference === "last-used"}
            onPress={() => setWorkspaceStartupPreference("last-used")}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Feedback</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <ToggleRow
            title="Haptics"
            subtitle="Gentle taps confirm presses, saves, and state changes."
            value={hapticsEnabled}
            onPress={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              // Fires after enabling, so switching haptics on is itself felt.
              if (next) haptic.tap();
            }}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Recording</Text>
        </View>
        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="mic-outline"
            title="Recording defaults"
            meta="Metronome, count-in, and naming for new takes"
            onPress={onOpenRecording}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Library</Text>
        </View>
        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="archive-outline"
            title="Library & Backups"
            busy={backupFlow.isBackingUp || backupFlow.isRestoring}
            meta={libraryMeta}
            onPress={onOpenLibrary}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>App</Text>
        </View>
        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="information-circle-outline"
            title="About"
            meta="Version, feedback, and privacy"
            onPress={onOpenAbout}
          />
        </View>
      </View>
    </ScrollView>
  );
}
