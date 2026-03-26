import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { FormatOptionRow } from "../components/SettingsShared";
import type { useGlobalTagSettings } from "../hooks/useGlobalTagSettings";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import type { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { getTagColor } from "../../IdeaDetailScreen/songClipControls";

type GlobalTagSettings = ReturnType<typeof useGlobalTagSettings>;
type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;
type StorageDiagnostics = ReturnType<typeof useStorageDiagnostics>;

export function SettingsOverviewView({
  workspaceStartupPreference,
  setWorkspaceStartupPreference,
  primaryWorkspaceTitle,
  backupFlow,
  globalTags,
  diagnostics,
  onOpenStorageDetails,
  onBeginExportFlow,
}: {
  workspaceStartupPreference: "primary" | "last-used";
  setWorkspaceStartupPreference: (next: "primary" | "last-used") => void;
  primaryWorkspaceTitle: string | null;
  backupFlow: LibraryBackupFlow;
  globalTags: GlobalTagSettings;
  diagnostics: StorageDiagnostics;
  onOpenStorageDetails: () => void;
  onBeginExportFlow: () => void;
}) {
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
    >
      <PageIntro
        title="Settings"
        subtitle="Set where the app returns on launch, check how Song Seed stores your library on this device, or export a portable package when you need one."
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Startup</Text>
          <Text style={styles.settingsSectionMeta}>
            {workspaceStartupPreference === "primary" ? "Primary workspace" : "Last used workspace"}
          </Text>
        </View>

        <View style={styles.settingsOptionStack}>
          <FormatOptionRow
            title="Return to primary workspace"
            subtitle={
              primaryWorkspaceTitle
                ? `Returns to ${primaryWorkspaceTitle} when the app opens.`
                : "Falls back to your last used workspace until a primary workspace is set."
            }
            selected={workspaceStartupPreference === "primary"}
            onPress={() => setWorkspaceStartupPreference("primary")}
          />
          <FormatOptionRow
            title="Return to last used workspace"
            subtitle="Returns to the workspace you most recently opened or worked in."
            selected={workspaceStartupPreference === "last-used"}
            onPress={() => setWorkspaceStartupPreference("last-used")}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Backups</Text>
          <Text style={styles.settingsSectionMeta}>{backupFlow.lastSuccessfulBackupLabel}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          Backups package your full Song Seed library as a Song Seed Archive so you can save it to Files, iCloud Drive, Google Drive, or another location you choose.
        </Text>

        <View style={settingsScreenStyles.backupSummaryBlock}>
          <View style={settingsScreenStyles.backupSummaryRow}>
            <Text style={styles.settingsSectionLabel}>Last backup</Text>
            <Text style={styles.settingsSectionMeta}>{backupFlow.lastSuccessfulBackupLabel}</Text>
          </View>
          <View style={settingsScreenStyles.backupFileNameRow}>
            <Text
              style={settingsScreenStyles.backupFileName}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {backupFlow.lastSuccessfulBackupFileName ?? "No backup saved yet"}
            </Text>
            {backupFlow.lastSuccessfulBackupFileName ? (
              <Pressable onPress={() => void backupFlow.copyLastBackupFileName()} hitSlop={8}>
                <Ionicons name="copy-outline" size={16} color="#64748b" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.settingsActionCard,
            pressed ? styles.pressDown : null,
            backupFlow.isBackingUp ? settingsScreenStyles.actionCardDisabled : null,
          ]}
          onPress={backupFlow.handleBackupNow}
          disabled={backupFlow.isBackingUp}
        >
          <View style={styles.settingsActionCardCopy}>
            <Text style={styles.settingsActionCardTitle}>Back Up Now</Text>
            <Text style={styles.settingsActionCardMeta}>
              Build a full-library backup and choose where to save it.
            </Text>
          </View>
          {backupFlow.isBackingUp ? (
            <ActivityIndicator size="small" color="#64748b" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={18} color="#64748b" />
          )}
        </Pressable>

        <View style={styles.settingsOptionStack}>
          {backupFlow.reminderOptions.map((option) => (
            <FormatOptionRow
              key={option.value}
              title={option.title}
              subtitle={option.subtitle}
              selected={backupFlow.backupReminderFrequency === option.value}
              onPress={() => backupFlow.setBackupReminderFrequency(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Custom clip tags</Text>
          <Text style={styles.settingsSectionMeta}>{globalTags.globalCustomClipTags.length}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          Global tags appear in the tag picker across all projects.
        </Text>

        {globalTags.globalCustomClipTags.length > 0 ? (
          <View style={styles.tagPickerChipsWrap}>
            {globalTags.globalCustomClipTags.map((tag) => {
              const color = getTagColor(tag.key, [], globalTags.globalCustomClipTags);
              return (
                <View key={tag.key} style={settingsScreenStyles.tagRow}>
                  <View
                    style={[
                      styles.clipCardTagBadge,
                      settingsScreenStyles.tagBadge,
                      { backgroundColor: color.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.clipCardTagBadgeText,
                        settingsScreenStyles.tagBadgeText,
                        { color: color.text },
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </View>
                  <Pressable onPress={() => globalTags.removeTag(tag.key, tag.label)} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.tagPickerAddRow}>
          <TextInput
            style={styles.tagPickerAddInput}
            placeholder="New tag name"
            placeholderTextColor="#94a3b8"
            value={globalTags.newGlobalTagLabel}
            onChangeText={globalTags.setNewGlobalTagLabel}
            onSubmitEditing={globalTags.addTag}
            returnKeyType="done"
          />
          <Pressable
            style={({ pressed }) => [
              styles.tagPickerAddBtn,
              !globalTags.canAddTag ? styles.tagPickerAddBtnDisabled : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={globalTags.addTag}
            disabled={!globalTags.canAddTag}
          >
            <Ionicons
              name="add"
              size={16}
              color={globalTags.canAddTag ? "#0f172a" : "#94a3b8"}
            />
          </Pressable>
        </View>
        <View style={styles.tagPickerColorRow}>
          {globalTags.colorOptions.map((option) => (
            <Pressable
              key={option.bg}
              style={[
                styles.tagPickerColorSwatch,
                { backgroundColor: option.bg },
                globalTags.newGlobalTagColor === option.bg ? styles.tagPickerColorSwatchActive : null,
              ]}
              onPress={() => globalTags.setNewGlobalTagColor(option.bg)}
            />
          ))}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.settingsActionCard, pressed ? styles.pressDown : null]}
        onPress={onOpenStorageDetails}
      >
        <View style={styles.settingsActionCardCopy}>
          <Text style={styles.settingsActionCardTitle}>Storage details</Text>
          <Text style={styles.settingsActionCardMeta}>
            See how much Song Seed storage your library, archives, and temporary exports use on this device.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.settingsActionCard, pressed ? styles.pressDown : null]}
        onPress={onBeginExportFlow}
      >
        <View style={styles.settingsActionCardCopy}>
          <Text style={styles.settingsActionCardTitle}>Export Library</Text>
          <Text style={styles.settingsActionCardMeta}>
            Package workspaces or collections as a Song Seed Archive or a Standard ZIP.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.settingsActionCard,
          pressed ? styles.pressDown : null,
          diagnostics.isRecovering ? settingsScreenStyles.actionCardDisabled : null,
        ]}
        onPress={diagnostics.runRecovery}
        disabled={diagnostics.isRecovering}
      >
        <View style={styles.settingsActionCardCopy}>
          <Text style={styles.settingsActionCardTitle}>Recover audio files</Text>
          <Text style={styles.settingsActionCardMeta}>
            {diagnostics.isRecovering
              ? diagnostics.recoveryProgress
              : "Scan for orphaned audio files on disk that are no longer linked to any clip, and restore them into a Recovered collection."}
          </Text>
        </View>
        {diagnostics.isRecovering ? (
          <ActivityIndicator size="small" color="#64748b" />
        ) : (
          <Ionicons name="refresh" size={18} color="#64748b" />
        )}
      </Pressable>
    </ScrollView>
  );
}
