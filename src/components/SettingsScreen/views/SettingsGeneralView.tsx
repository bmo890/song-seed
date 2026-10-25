import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PageIntro } from "../../common/PageIntro";
import { AppAlert } from "../../common/AppAlert";
import { LibraryActionCard, SettingsGroup, ToggleRow, ValueRow } from "../components/SettingsShared";
import { settingsScreenStyles, styles } from "../styles";
import { APP_LANGUAGES, languageLabel, useLocale } from "../../../i18n";
import { useStore } from "../../../state/useStore";
import { NAME_IDEA_LANGUAGES } from "../../../utils";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

/**
 * Preferences (2026-10-21): General and Recording in one page, each choice a
 * value row instead of a tab list, no hints. A language is named in its own
 * script, so someone lost in the wrong one can still find theirs.
 */
export function SettingsGeneralView() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { language, setLanguage } = useLocale();
  const workspaceStartupPreference = useStore((state) => state.workspaceStartupPreference);
  const setWorkspaceStartupPreference = useStore((state) => state.setWorkspaceStartupPreference);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useStore((state) => state.setHapticsEnabled);
  const nameLanguage = useStore((state) => state.nameLanguage);
  const setNameLanguage = useStore((state) => state.setNameLanguage);
  const promptForClipName = useStore((s) => s.promptForClipName);
  const setPromptForClipName = useStore((s) => s.setPromptForClipName);
  const bluetoothCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.preferences")} />

      <View style={[styles.settingsSection, settingsScreenStyles.pickerSection]}>
        <SettingsGroup>
          <ValueRow
            title={t("settings.appLanguage")}
            value={language}
            options={APP_LANGUAGES.map((language) => ({ value: language.code, label: languageLabel(language.code) }))}
            onChange={(next) => {
              // The language takes hold on a restart; say so before it happens.
              AppAlert.confirm(
                t("settings.restartTitle"),
                t("settings.restartBody"),
                () => {
                  void setLanguage(next).catch(() => {
                    AppAlert.error(t("settings.restartFailedTitle"), t("settings.restartFailedBody"));
                  });
                },
                { confirmLabel: t("settings.restartConfirm") }
              );
            }}
          />
          <ValueRow
            title={t("settings.nameLanguage")}
            value={nameLanguage}
            options={[
              { value: "auto" as const, label: t("settings.automatic") },
              ...NAME_IDEA_LANGUAGES.map((code) => ({ value: code, label: languageLabel(code) })),
            ]}
            onChange={setNameLanguage}
          />
          <ValueRow
            title={t("settings.openTo")}
            value={workspaceStartupPreference}
            options={[
              { value: "primary", label: t("settings.primaryWorkspaceOption") },
              { value: "last-used", label: t("settings.lastUsedOption") },
            ]}
            onChange={setWorkspaceStartupPreference}
          />
          <ToggleRow
            flat
            title={t("settings.interfaceHaptics")}
            value={hapticsEnabled}
            onPress={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              if (next) haptic.tap();
            }}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.recording")}</Text>
        <SettingsGroup>
          <ToggleRow
            flat
            title={t("settingsRecording.nameEach")}
            value={promptForClipName}
            onPress={() => setPromptForClipName(!promptForClipName)}
          />
          <LibraryActionCard
            flat
            icon="bluetooth"
            title={t("settingsRecording.bluetooth")}
            meta={
              bluetoothCalibrations.length > 0
                ? t("settingsRecording.calibrations", { count: bluetoothCalibrations.length })
                : undefined
            }
            onPress={() => {
              haptic.tap();
              navigation.navigate("BluetoothCalibration" as never);
            }}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
