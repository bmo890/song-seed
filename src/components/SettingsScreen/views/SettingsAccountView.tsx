import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { PageIntro } from "../../common/PageIntro";
import { toast } from "../../common/toastStore";
import { LibraryActionCard, SettingsGroup } from "../components/SettingsShared";
import { settingsScreenStyles, styles } from "../styles";
import { colors } from "../../../design/tokens";
import { useIsPro } from "../../../domain/entitlements";

export function SettingsAccountView() {
  const { t } = useTranslation();
  const isPro = useIsPro();
  const planned = () => toast(t("settingsAccount.comingSoon"), "time-outline");

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
        <Text style={styles.settingsSectionLabel}>{t("settingsAccount.account")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="log-in-outline"
            title={t("settingsAccount.signIn")}
            meta={t("settingsAccount.signInHint")}
            onPress={planned}
          />
          <LibraryActionCard
            flat
            icon="person-add-outline"
            title={t("settingsAccount.createAccount")}
            meta={t("settingsAccount.createAccountHint")}
            onPress={planned}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>SongNook Pro</Text>
        <View style={settingsScreenStyles.planSummary}>
          <View style={settingsScreenStyles.planSummaryCopy}>
            <Text style={settingsScreenStyles.planTitle}>
              {isPro ? t("settingsAccount.proActive") : t("settingsAccount.freePlan")}
            </Text>
            <Text style={settingsScreenStyles.planMeta}>
              {isPro ? t("settingsAccount.proActiveHint") : t("settingsAccount.freePlanHint")}
            </Text>
          </View>
          <View style={settingsScreenStyles.planBadge}>
            <Text style={settingsScreenStyles.planBadgeText}>
              {isPro ? t("settingsAccount.active") : t("settingsAccount.free")}
            </Text>
          </View>
        </View>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="sparkles-outline"
            title={isPro ? t("settingsAccount.managePlan") : t("settingsAccount.explorePro")}
            meta={isPro ? t("settingsAccount.managePlanHint") : t("settingsAccount.exploreProHint")}
            onPress={planned}
          />
          <LibraryActionCard
            flat
            icon="refresh-outline"
            title={t("settings.restorePurchases")}
            meta={t("settings.restorePurchasesHint")}
            onPress={planned}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsAccount.sync")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="cloud-outline"
            title={t("settingsAccount.deviceSync")}
            meta={t("settingsAccount.deviceSyncHint")}
            onPress={planned}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
