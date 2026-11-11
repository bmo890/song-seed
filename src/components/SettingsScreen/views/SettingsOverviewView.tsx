import { Linking, Platform, ScrollView, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SettingsGroup } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { useTranslation } from "react-i18next";
import { isPaywallLive, usePlanState, type PlanState } from "../../../domain/entitlements";
import { openProUpsell } from "../../common/proUpsell";
import type { TFunction } from "i18next";
import { openFeedbackSheet } from "../../common/feedbackSheetStore";
import { toast } from "../../common/toastStore";
import { haptic } from "../../../design/haptics";
import { ANDROID_REVIEW_URL, ANDROID_REVIEW_WEB_URL, IOS_REVIEW_URL } from "../../../config/legalLinks";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

/**
 * Four doors (founder, 2026-10-21: fewer pages, less text). Once Pro can be
 * bought, the plan is a fifth: one row saying where you stand, opening the Pro
 * sheet (2026-10-27). Beneath them, two ways to talk back: a note to us and the
 * store's review page (founder, 2026-11-11).
 */
export function SettingsOverviewView({
  backupFlow,
  onOpenPreferences,
  onOpenLibrary,
  onOpenAbout,
}: {
  backupFlow: LibraryBackupFlow;
  onOpenPreferences: () => void;
  onOpenLibrary: () => void;
  onOpenAbout: () => void;
}) {
  const { t } = useTranslation();
  const libraryMeta = backupFlow.isBackingUp
    ? backupFlow.backupProgressLabel ?? t("settings.backingUp")
    : backupFlow.isRestoring
      ? backupFlow.restoreProgressLabel ?? t("settings.restoring")
      : backupFlow.lastSuccessfulBackupFileName
        ? t("settings.lastBackup", { date: backupFlow.lastSuccessfulBackupLabel })
        : t("settings.noBackup");

  // The store's own write-a-review page. The automatic prompt (services/reviewPrompt)
  // asks rarely and on the system's terms; this row is there whenever someone wants it.
  const rateApp = () => {
    const failed = () => {
      haptic.error();
      toast(t("settingsAbout.linkFailed"), "alert-circle-outline");
    };
    if (Platform.OS === "android") {
      void Linking.openURL(ANDROID_REVIEW_URL)
        .catch(() => Linking.openURL(ANDROID_REVIEW_WEB_URL))
        .catch(failed);
      return;
    }
    void Linking.openURL(IOS_REVIEW_URL).catch(failed);
  };

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.overviewContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.title")} />

      {/* The plan, once Pro can be bought: where you stand, and the door to the Pro
          sheet (prices, Restore). Nothing shows while everything is free. */}
      {isPaywallLive() ? <PlanRow /> : null}

      <View style={settingsScreenStyles.overviewSection}>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="options-outline"
            title={t("settings.preferences")}
            onPress={onOpenPreferences}
          />
          <LibraryActionCard
            flat
            icon="archive-outline"
            title={t("settings.dataStorage")}
            busy={backupFlow.isBackingUp || backupFlow.isRestoring}
            meta={libraryMeta}
            onPress={onOpenLibrary}
          />
          <LibraryActionCard
            flat
            icon="help-circle-outline"
            title={t("settings.helpAbout")}
            onPress={onOpenAbout}
          />
        </SettingsGroup>
      </View>

      <View style={settingsScreenStyles.overviewSection}>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="chatbubble-outline"
            title={t("settingsAbout.sendFeedback")}
            onPress={openFeedbackSheet}
          />
          <LibraryActionCard flat icon="star-outline" title={t("settings.rate")} onPress={rateApp} />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}

function planLabel(plan: PlanState, t: TFunction): string {
  switch (plan.kind) {
    case "pro":
      return t("settings.planActive");
    case "founding":
      return t("settings.planFounding");
    case "freeMonth":
      return t("freeMonth.daysLeft", { count: plan.daysLeft });
    default:
      return t("settings.planFree");
  }
}

function PlanRow() {
  const { t } = useTranslation();
  const plan = usePlanState();
  return (
    <View style={settingsScreenStyles.overviewSection}>
      <SettingsGroup>
        <LibraryActionCard
          flat
          icon="sparkles-outline"
          title={t("pro.eyebrow")}
          meta={planLabel(plan, t)}
          onPress={() => openProUpsell()}
        />
      </SettingsGroup>
    </View>
  );
}
