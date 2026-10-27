import { ScrollView, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SettingsGroup } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { useTranslation } from "react-i18next";
import { isPaywallLive, usePlanState, type PlanState } from "../../../domain/entitlements";
import { openProUpsell } from "../../common/proUpsell";
import type { TFunction } from "i18next";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

/**
 * Four doors (founder, 2026-10-21: fewer pages, less text). Once Pro can be
 * bought, the plan is a fifth: one row saying where you stand, opening the Pro
 * sheet (2026-10-27).
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
