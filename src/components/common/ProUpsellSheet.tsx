import { useState } from "react";
import { Dimensions, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Press } from "./Press";
import { closeProUpsell, useProUpsellState } from "./proUpsell";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { getFreeMonthEndsAt, isFoundingMember, isPaywallLive, proEntitlement } from "../../domain/entitlements";
import { freeMonthStatus, FREE_MONTH_DAYS } from "../../domain/freeMonth";
import { isDevFreeMonthPreview } from "../../services/freeMonthClock";
import { purchasePro, restorePurchases, type ProPlan } from "../../services/billing";
// Apple requires working Terms and Privacy links on a paywall; the one source of
// those URLs is config/legalLinks, shared with Settings → About.
import { PRIVACY_POLICY_URL as PRIVACY_URL, TERMS_OF_USE_URL as TERMS_URL } from "../../config/legalLinks";

/** What Pro adds, in the confirmed split (founder, 2026-10-19). Bare ink glyphs, no tiles. */
const FEATURE_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "musical-notes-outline",
  "layers-outline",
  "repeat-outline",
  "cut-outline",
  "sparkles-outline",
  "paper-plane-outline",
];
const PLAN_IDS: ProPlan[] = ["annual", "monthly", "lifetime"];
const DAY_MS = 24 * 60 * 60 * 1000;

/** The free month's state as the sheet tells it, or null when it doesn't apply. */
function freeMonthLine(): { daysLeft: number } | "ended" | null {
  if (!isPaywallLive() && !isDevFreeMonthPreview()) return null;
  if (proEntitlement.get() || isFoundingMember()) return null;
  const endsAt = getFreeMonthEndsAt();
  if (endsAt == null) return null;
  const status = freeMonthStatus(endsAt - FREE_MONTH_DAYS * DAY_MS, Date.now());
  return status.active ? { daysLeft: status.daysLeft } : "ended";
}

/**
 * The one Pro sheet (rebuilt 2026-10-19): what Pro adds, the privacy promise, the
 * founding prices as rows on paper with an ink tick, one primary key, and the quiet
 * Restore / Terms / Privacy line Apple requires. Prices are the founding ones; once
 * billing lands the store's localized prices replace them.
 */
function ProUpsellSheetBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ProPlan>("annual");
  // Inline, not a dialog: this sheet is a Modal and iOS won't stack a dialog over it.
  const [notice, setNotice] = useState<string | null>(null);
  const maxScroll = Math.round(Dimensions.get("window").height * 0.55);
  const freeMonth = freeMonthLine();

  async function handlePurchase() {
    const result = await purchasePro(selected);
    if (!result.ok) setNotice(result.reason === "cancelled" ? null : t("pro.purchaseUnavailable"));
    else onClose();
  }

  async function handleRestore() {
    const result = await restorePurchases();
    if (!result.ok) setNotice(t("pro.noRestores"));
    else onClose();
  }

  return (
    <View>
      <ScrollView style={{ maxHeight: maxScroll }} showsVerticalScrollIndicator={false}>
        <Text style={s.eyebrow}>{t("pro.eyebrow")}</Text>
        <Text style={s.headline}>{t("pro.headline")}</Text>
        {freeMonth ? (
          <Text style={s.freeMonth}>
            {freeMonth === "ended" ? t("pro.freeMonthEnded") : t("pro.freeMonthLeft", { count: freeMonth.daysLeft })}
          </Text>
        ) : null}
        <Text style={s.subhead}>{t("pro.subhead")}</Text>

        <View style={s.features}>
          {FEATURE_ICONS.map((icon, index) => (
            <View key={icon} style={s.featureRow}>
              <Ionicons name={icon} size={18} color={colors.textStrong} style={s.featureGlyph} />
              <View style={s.featureText}>
                <Text style={s.featureTitle}>{t(`pro.features.${index}.title`)}</Text>
                <Text style={s.featureBlurb}>{t(`pro.features.${index}.blurb`)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.plans}>
          {PLAN_IDS.map((plan) => {
            const isSelected = plan === selected;
            return (
              <Press
                key={plan}
                // haptics.ts: light → a small state flip (a choice in a set).
                haptic="light"
                style={s.planRow}
                onPress={() => setSelected(plan)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${t(`pro.plans.${plan}.label`)}, ${t(`pro.plans.${plan}.price`)}`}
              >
                <View style={[s.dot, isSelected ? s.dotOn : null]} />
                <View style={s.planText}>
                  <View style={s.planHeader}>
                    <Text style={[s.planLabel, isSelected ? s.planLabelOn : null]}>{t(`pro.plans.${plan}.label`)}</Text>
                    {plan === "annual" ? <Text style={s.planTag}>{t("pro.plans.annual.tag")}</Text> : null}
                  </View>
                  <Text style={s.planSub}>{t(`pro.plans.${plan}.sub`)}</Text>
                </View>
                <Text style={s.planPrice}>{t(`pro.plans.${plan}.price`)}</Text>
              </Press>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        {notice ? <Text style={s.notice}>{notice}</Text> : null}
        <Button label={t("pro.getPro")} onPress={() => void handlePurchase()} style={s.cta} />
        <View style={s.footerLinks}>
          <Press feel="glyph" onPress={() => void handleRestore()} hitSlop={8} accessibilityRole="button">
            <Text style={s.link}>{t("pro.restore")}</Text>
          </Press>
          <Text style={s.linkDot}>·</Text>
          <Press
            feel="glyph"
            haptic="navigate"
            onPress={() => void Linking.openURL(TERMS_URL).catch(() => {})}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={s.link}>{t("pro.terms")}</Text>
          </Press>
          <Text style={s.linkDot}>·</Text>
          <Press
            feel="glyph"
            haptic="navigate"
            onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={s.link}>{t("pro.privacy")}</Text>
          </Press>
          <Text style={s.linkDot}>·</Text>
          <Press feel="glyph" haptic="navigate" onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={s.link}>{t("pro.notNow")}</Text>
          </Press>
        </View>
      </View>
    </View>
  );
}

/** The single app-wide Pro sheet. Mount <ProUpsellHost/> once at the app root; any gated call
 *  site opens it via openProUpsell(feature). */
export function ProUpsellHost() {
  const { visible } = useProUpsellState();
  return (
    <BottomSheet visible={visible} onClose={closeProUpsell}>
      {visible ? <ProUpsellSheetBody onClose={closeProUpsell} /> : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  eyebrow: {
    ...textTokens.annotation,
    color: colors.textSecondary,
  },
  headline: {
    ...textTokens.headerTitle,
    fontSize: 28,
    lineHeight: 34,
    marginTop: 4,
  },
  freeMonth: {
    ...textTokens.supporting,
    color: colors.primaryDeep,
    marginTop: spacing.xs,
  },
  subhead: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  features: {
    marginTop: spacing.lg,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureGlyph: {
    marginTop: 1,
    width: 22,
    textAlign: "center",
  },
  featureText: {
    flex: 1,
    gap: 1,
  },
  featureTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  featureBlurb: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
  // Prices are rows on paper with an ink tick, not boxed cards.
  plans: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  dotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textStrong,
  },
  planLabelOn: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textPrimary,
  },
  planTag: {
    ...textTokens.annotation,
    color: colors.textSecondary,
  },
  planSub: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
  planPrice: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  footer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  notice: {
    ...textTokens.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  cta: {
    alignSelf: "stretch",
  },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  link: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  linkDot: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
});
