import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { PageIntro } from "../../common/PageIntro";
import { LibraryActionCard, SettingsGroup } from "../components/SettingsShared";
import { settingsScreenStyles, styles } from "../styles";
import { colors } from "../../../design/tokens";

/**
 * Honest beta surface (2026-08-26): no dead "coming soon" taps. One truthful
 * status card — everything is unlocked during the beta — and a static
 * "Coming later" section for accounts + sync. Rows become interactive again
 * only when the features behind them exist.
 */
export function SettingsAccountView() {
  const { t } = useTranslation();

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.account")} subtitle={t("settingsAccount.subtitle")} />

      <View style={settingsScreenStyles.accountIdentity}>
        <View style={settingsScreenStyles.accountMark}>
          <Ionicons name="person-outline" size={22} color={colors.primaryDeep} />
        </View>
        <View style={settingsScreenStyles.accountIdentityCopy}>
          <Text style={settingsScreenStyles.accountIdentityTitle}>{t("settingsAccount.localProfile")}</Text>
          <Text style={settingsScreenStyles.accountIdentityMeta}>{t("settingsAccount.localProfileHint")}</Text>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={settingsScreenStyles.planSummary}>
          <View style={settingsScreenStyles.planSummaryCopy}>
            <Text style={settingsScreenStyles.planTitle}>{t("settingsAccount.betaPlan")}</Text>
            <Text style={settingsScreenStyles.planMeta}>{t("settingsAccount.betaPlanHint")}</Text>
          </View>
          <View style={settingsScreenStyles.planBadge}>
            <Text style={settingsScreenStyles.planBadgeText}>{t("settingsAccount.betaBadge")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsAccount.comingLater")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="person-add-outline"
            title={t("settingsAccount.accountsLater")}
            meta={t("settingsAccount.accountsLaterHint")}
          />
          <LibraryActionCard
            flat
            icon="cloud-outline"
            title={t("settingsAccount.deviceSync")}
            meta={t("settingsAccount.deviceSyncHint")}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
