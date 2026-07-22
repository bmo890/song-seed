import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SegmentedField, SettingsGroup, ToggleRow } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { colors, radii } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { useIsPro } from "../../../domain/entitlements";
import { openProUpsell } from "../../common/proUpsell";
import { restorePurchases } from "../../../services/billing";
import { AppAlert } from "../../common/AppAlert";
import { useTranslation } from "react-i18next";
import { useLocale } from "../../../i18n";
import { useStore } from "../../../state/useStore";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

/**
 * Deliberately short: startup, feedback, language, and one doorway into each
 * deeper area. Anything screen-specific (Bluetooth calibration, tag management)
 * lives on the screen it serves, not here. Sections are grouped onto soft tonal
 * cards so the page reads as a settled list rather than a stack of boxes.
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
  onOpenSharing,
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
  onOpenSharing: () => void;
  onOpenAbout: () => void;
}) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLocale();
  const nameLanguage = useStore((s) => s.nameLanguage);
  const setNameLanguage = useStore((s) => s.setNameLanguage);
  const isPro = useIsPro();

  const libraryMeta = backupFlow.isBackingUp
    ? backupFlow.backupProgressLabel ?? t("settings.backingUp")
    : backupFlow.isRestoring
      ? backupFlow.restoreProgressLabel ?? t("settings.restoring")
      : backupFlow.lastSuccessfulBackupFileName
        ? t("settings.lastBackup", { date: backupFlow.lastSuccessfulBackupLabel })
        : t("settings.noBackup");

  // Startup hint carries the primary workspace's name when that mode is chosen —
  // the one piece of context worth keeping now that the choice is a segment.
  const startupHint =
    workspaceStartupPreference === "primary" && primaryWorkspaceTitle
      ? t("settings.primaryWorkspaceHint", { name: primaryWorkspaceTitle })
      : t("settings.startupHint");

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={ov.scroll}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.title")} />

      {/* Pro — the one card that gets a filled, terracotta treatment. */}
      <View style={ov.section}>
        {isPro ? (
          <Pressable
            style={({ pressed }) => [ov.pro, pressed ? styles.pressDown : null]}
            onPress={() => {
              haptic.tap();
              const url =
                Platform.OS === "ios"
                  ? "https://apps.apple.com/account/subscriptions"
                  : "https://play.google.com/store/account/subscriptions";
              void Linking.openURL(url).catch(() => {});
            }}
          >
            <View style={ov.proBadge}>
              <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
            </View>
            <View style={ov.proCopy}>
              <Text style={ov.proTitle}>{t("settings.proActive")}</Text>
              <Text style={ov.proSub}>{t("settings.proActiveHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [ov.pro, pressed ? styles.pressDown : null]}
            onPress={() => {
              haptic.tap();
              openProUpsell();
            }}
          >
            <View style={ov.proBadge}>
              <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
            </View>
            <View style={ov.proCopy}>
              <Text style={ov.proTitle}>{t("settings.upgradePro")}</Text>
              <Text style={ov.proSub}>{t("settings.upgradeProHint")}</Text>
            </View>
            <View style={ov.proCta}>
              <Text style={ov.proCtaText}>{t("settings.upgradeCta")}</Text>
            </View>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [ov.restore, pressed ? { opacity: 0.6 } : null]}
          onPress={() => {
            haptic.tap();
            void restorePurchases().then((result) => {
              if (!result.ok) {
                AppAlert.info(t("settings.restorePurchases"), t("settings.nothingToRestore"));
              }
            });
          }}
        >
          <Text style={ov.restoreText}>
            {t("settings.restorePrompt")} <Text style={ov.restoreLink}>{t("settings.restorePurchases")}</Text>
          </Text>
        </Pressable>
      </View>

      {/* Startup */}
      <View style={ov.section}>
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

      {/* Feedback */}
      <View style={ov.section}>
        <Text style={styles.settingsSectionLabel}>{t("settings.feedback")}</Text>
        <SettingsGroup>
          <ToggleRow
            flat
            title={t("settings.haptics")}
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

      {/* Language */}
      <View style={ov.section}>
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
            // "auto" mirrors the current UI language until the user pins a choice.
            value={nameLanguage === "auto" ? (language === "he" ? "he" : "en") : nameLanguage}
            options={[
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

      {/* More — the doorways into deeper areas, one grouped list. */}
      <View style={ov.section}>
        <Text style={styles.settingsSectionLabel}>{t("settings.more")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="mic-outline"
            title={t("settings.recordingDefaults")}
            meta={t("settings.recordingDefaultsMeta")}
            onPress={onOpenRecording}
          />
          <LibraryActionCard
            flat
            icon="archive-outline"
            title={t("settings.libraryBackups")}
            busy={backupFlow.isBackingUp || backupFlow.isRestoring}
            meta={libraryMeta}
            onPress={onOpenLibrary}
          />
          <LibraryActionCard
            flat
            icon="link-outline"
            title={t("settings.sentLinks")}
            meta={t("settings.sentLinksMeta")}
            onPress={onOpenSharing}
          />
          <LibraryActionCard
            flat
            icon="information-circle-outline"
            title={t("settings.about")}
            meta={t("settings.aboutMeta")}
            onPress={onOpenAbout}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}

const ov = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
    gap: 22,
  },
  section: {
    gap: 10,
  },
  pro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.xl,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  proBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  proCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  proTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: colors.onPrimary,
  },
  proSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.82)",
  },
  proCta: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radii.round,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  proCtaText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12.5,
    color: colors.onPrimary,
  },
  restore: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  restoreText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
  restoreLink: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
});
