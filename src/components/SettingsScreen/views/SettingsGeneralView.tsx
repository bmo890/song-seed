import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { AppAlert } from "../../common/AppAlert";
import { SettingsGroup, SegmentedField, ToggleRow } from "../components/SettingsShared";
import { settingsScreenStyles, styles } from "../styles";
import { useLocale } from "../../../i18n";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

export function SettingsGeneralView() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLocale();
  const workspaces = useStore((state) => state.workspaces);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const workspaceStartupPreference = useStore((state) => state.workspaceStartupPreference);
  const setWorkspaceStartupPreference = useStore((state) => state.setWorkspaceStartupPreference);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useStore((state) => state.setHapticsEnabled);
  const nameLanguage = useStore((state) => state.nameLanguage);
  const setNameLanguage = useStore((state) => state.setNameLanguage);
  const primaryWorkspaceTitle = useMemo(
    () => workspaces.find((workspace) => workspace.id === primaryWorkspaceId)?.title ?? null,
    [primaryWorkspaceId, workspaces]
  );
  const startupHint =
    workspaceStartupPreference === "primary" && primaryWorkspaceTitle
      ? t("settings.primaryWorkspaceHint", { name: primaryWorkspaceTitle })
      : t("settings.startupHint");

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.general")} subtitle={t("settingsGeneral.subtitle")} />

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.language")}</Text>
        <SettingsGroup>
          <SegmentedField
            flat
            title={t("settings.appLanguage")}
            subtitle={t("settings.languageHint")}
            value={language}
            options={[
              { value: "en", label: t("settings.english") },
              { value: "he", label: t("settings.hebrew") },
            ]}
            onChange={(next) => {
              void setLanguage(next).catch(() => {
                AppAlert.info(t("settings.restartFailedTitle"), t("settings.restartFailedBody"));
              });
            }}
          />
          <SegmentedField
            flat
            title={t("settings.nameLanguage")}
            subtitle={t("settings.nameLanguageHint")}
            value={nameLanguage}
            options={[
              { value: "auto", label: t("settings.automatic") },
              { value: "en", label: t("settings.english") },
              { value: "he", label: t("settings.hebrew") },
            ]}
            onChange={(next) => {
              haptic.tap();
              setNameLanguage(next);
            }}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.startup")}</Text>
        <SettingsGroup>
          <SegmentedField
            flat
            title={t("settings.openTo")}
            subtitle={startupHint}
            value={workspaceStartupPreference}
            options={[
              { value: "primary", label: t("settings.primaryShort") },
              { value: "last-used", label: t("settings.lastUsedShort") },
            ]}
            onChange={(next) => {
              haptic.tap();
              setWorkspaceStartupPreference(next);
            }}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.interaction")}</Text>
        <SettingsGroup>
          <ToggleRow
            flat
            title={t("settings.interfaceHaptics")}
            subtitle={t("settings.hapticsHint")}
            value={hapticsEnabled}
            onPress={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              if (next) haptic.tap();
            }}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
