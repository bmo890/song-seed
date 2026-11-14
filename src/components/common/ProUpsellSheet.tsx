import { useRef, useState, useSyncExternalStore } from "react";
import { Linking, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ReAnimated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModalDialogLayer } from "./AppDialog";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { ModalGestureRoot } from "./ModalGestureRoot";
import { Press } from "./Press";
import { closeProUpsell, useProUpsellState } from "./proUpsell";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import {
  getFreeMonthClock,
  getFreeMonthEndsAt,
  isFoundingMember,
  isPaywallLive,
  proEntitlement,
  usePlanState,
} from "../../domain/entitlements";
import { freeMonthStatus, FREE_MONTH_DAYS, lifetimeLaunchEndsAt } from "../../domain/freeMonth";
import { currentFormatLocale } from "../../i18n/formatLocale";
import { PAYWALL_ROWS } from "../../domain/proCatalog";
import { isDevFreeMonthPreview } from "../../services/freeMonthClock";
import { proUse, proUseRanking } from "../../services/proUse";
import {
  manageSubscriptionUrl,
  purchasePro,
  restorePurchases,
  useOwnedPro,
  useProPrices,
  type ProPlan,
} from "../../services/billing";
import { haptic } from "../../design/haptics";
import { collapseIn, riseIn } from "../../design/motion";
// Apple requires working Terms and Privacy links on a paywall; the one source of
// those URLs is config/legalLinks, shared with Settings → About.
import { PRIVACY_POLICY_URL as PRIVACY_URL, TERMS_OF_USE_URL as TERMS_URL } from "../../config/legalLinks";

/** What Pro adds: the catalog's PAYWALL_ROWS (domain/proCatalog.ts), each row's result and
 *  tool at `pro.features.<index>` (`title`, `body`). Bare ink glyphs, no tiles. */
const FEATURE_ICONS = PAYWALL_ROWS.map((row) => row.icon as keyof typeof Ionicons.glyphMap);
const PLAN_IDS: ProPlan[] = ["annual", "monthly", "lifetime"];
const DAY_MS = 24 * 60 * 60 * 1000;
/** Yearly against twelve months at the printed prices ($24.99 vs $3.99 × 12). */
const PRINTED_SAVING_PERCENT = 48;

/** The free month's state as the page tells it, or null when it doesn't apply. */
function freeMonthLine(): { daysLeft: number } | "ended" | null {
  if (!isPaywallLive() && !isDevFreeMonthPreview()) return null;
  if (proEntitlement.get() || isFoundingMember()) return null;
  const endsAt = getFreeMonthEndsAt();
  if (endsAt == null) return null;
  const status = freeMonthStatus(endsAt - FREE_MONTH_DAYS * DAY_MS, getFreeMonthClock());
  return status.active ? { daysLeft: status.daysLeft } : "ended";
}

/**
 * The one Pro page (a full screen since 2026-11-12, founder: "the get pro deserves a
 * full screen"): what Pro adds in five lines, the privacy promise, the prices as rows
 * on paper with an ink tick, one key, and the quiet Restore / Terms / Privacy line
 * Apple requires. It closes by its ✕ alone. Prices come from the store, in the
 * person's currency, once RevenueCat answers; the printed ones are the fallback.
 *
 * Someone who already has Pro (a purchase, or a founding install) sees what they
 * have instead: their plan's line, the store's own page for a subscription, and no
 * buy key. "See plans" unfolds the prices on purpose, so nobody buys twice by
 * accident and a subscriber can still move to another plan.
 */
function ProUpsellPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ProPlan>("annual");
  // Said on the page: a toast would draw beneath this Modal.
  const [notice, setNotice] = useState<string | null>(null);
  // One store conversation at a time: a second tap mid-purchase does nothing.
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const freeMonth = freeMonthLine();
  const storePrices = useProPrices();
  const standing = usePlanState();
  const purchase = useOwnedPro();
  const hasPro = standing.kind === "pro" || standing.kind === "founding";
  const [plansOpen, setPlansOpen] = useState(false);
  // After a purchase or a restore the page says so before it closes (founder,
  // 2026-11-14: "make sure they know it works"), instead of vanishing.
  const [welcome, setWelcome] = useState<"bought" | "restored" | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const showPlans = !welcome && (!hasPro || plansOpen);
  const canManage = purchase != null && !purchase.lifetime;
  // Lifetime is the last plan: nothing left to sell, and a subscription on top would bill twice.
  const canSeePlans = !purchase?.lifetime;
  const ownedLine = () => {
    if (purchase?.lifetime) return t("pro.ownedLifetime");
    if (purchase?.until != null) {
      const date = new Date(purchase.until).toLocaleDateString(currentFormatLocale(), {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return t(purchase.renews ? "pro.ownedRenews" : "pro.ownedEnds", { date });
    }
    return standing.kind === "founding" ? t("pro.ownedFounding") : null;
  };
  const owned = hasPro ? ownedLine() : null;
  // Re-read when a count changes; the ranking itself comes from the service.
  useSyncExternalStore(proUse.subscribe, proUse.get);
  const used = hasPro ? [] : proUseRanking();
  const usedLabel = [t("pro.usedTitle"), ...used.map((entry) => `${t(`pro.used.${entry.group}`)} ${entry.count}`)].join(", ");
  // Lifetime's printed price follows the launch window: $59.99 until it ends, then
  // $79.99 (a store price, when RevenueCat has one, always wins).
  const launchEndsAt = lifetimeLaunchEndsAt();
  const inLaunch = launchEndsAt == null || Date.now() < launchEndsAt;
  const printedPrice = (plan: ProPlan) =>
    plan === "lifetime" && !inLaunch ? t("pro.plans.lifetime.priceLater") : t(`pro.plans.${plan}.price`);
  const priceOf = (plan: ProPlan) => storePrices[plan]?.price ?? printedPrice(plan);
  const subOf = (plan: ProPlan) => {
    if (plan !== "lifetime") return t(`pro.plans.${plan}.sub`);
    if (!inLaunch) return t("pro.plans.lifetime.subAfter");
    // The later price is printed in dollars, so it shows only beside the dollar
    // launch price; another currency names the end date alone.
    const inDollars = priceOf("lifetime") === t("pro.plans.lifetime.price");
    if (launchEndsAt == null) return t(inDollars ? "pro.plans.lifetime.sub" : "pro.plans.lifetime.subNow");
    const date = new Date(launchEndsAt).toLocaleDateString(currentFormatLocale(), { month: "long", day: "numeric" });
    return t(inDollars ? "pro.plans.lifetime.subUntil" : "pro.plans.lifetime.subUntilNow", { date });
  };

  // What a year saves against twelve months, from the store's own prices when it has
  // both (the saving differs by currency), else from the printed ones.
  const yearly = storePrices.annual?.amount;
  const monthly = storePrices.monthly?.amount;
  const savingPercent =
    yearly != null && monthly != null && monthly > 0
      ? Math.round((1 - yearly / (monthly * 12)) * 100)
      : PRINTED_SAVING_PERCENT;

  async function handlePurchase() {
    if (busy) return;
    setNotice(null);
    setBusy(true);
    const result = await purchasePro(selected);
    setBusy(false);
    if (result.ok) {
      // haptics.ts: success → a commit that landed.
      haptic.success();
      setWelcome("bought");
      return;
    }
    if (result.reason === "cancelled") return;
    if (result.reason === "error") {
      // haptics.ts: error → a failure the person has to deal with.
      haptic.error();
      setNotice(t("pro.purchaseFailed"));
      return;
    }
    setNotice(t("pro.purchaseUnavailable"));
  }

  async function handleRestore() {
    if (busy) return;
    setNotice(null);
    setBusy(true);
    const result = await restorePurchases();
    setBusy(false);
    if (result.ok) {
      // haptics.ts: success → a commit that landed.
      haptic.success();
      setWelcome("restored");
      return;
    }
    if (result.reason === "error") {
      // haptics.ts: error → a failure the person has to deal with.
      haptic.error();
      setNotice(t("pro.restoreFailed"));
      return;
    }
    setNotice(result.reason === "unavailable" ? t("pro.purchaseUnavailable") : t("pro.noRestores"));
  }

  return (
    <View style={[s.page, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <View style={s.navRow}>
        {/* Leaving is navigation: silent. */}
        <IconButton icon="close" tone="muted" noHaptic onPress={onClose} accessibilityLabel={t("common.close")} testID="pro-close" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={s.eyebrow}>{t("pro.eyebrow")}</Text>
          {welcome ? (
            // The thanks rises in where the headline was: the same page, one swap.
            <ReAnimated.View entering={riseIn} accessibilityLiveRegion="polite">
              <Text style={s.headline} accessibilityRole="header">
                {t(welcome === "bought" ? "pro.welcomeHeadline" : "pro.restoredHeadline")}
              </Text>
              {owned ? <Text style={s.statusLine}>{owned}</Text> : null}
              <Text style={s.welcomeBody}>{t("pro.welcomeBody")}</Text>
            </ReAnimated.View>
          ) : (
            <>
              <Text style={s.headline}>{t(hasPro ? "pro.ownedHeadline" : "pro.headline")}</Text>
              {owned ? <Text style={s.statusLine}>{owned}</Text> : null}
            </>
          )}
          {freeMonth && !welcome ? (
            <Text style={s.statusLine}>
              {freeMonth === "ended" ? t("pro.freeMonthEnded") : t("pro.freeMonthLeft", { count: freeMonth.daysLeft })}
            </Text>
          ) : null}
          {welcome ? null : <Text style={s.subhead}>{t("pro.subhead")}</Text>}
          {/* What this person used in their free month, most used first: a reminder,
              counted and kept on the phone (services/proUse.ts). */}
          {used.length > 0 && !welcome ? (
            <View style={s.used} accessible accessibilityLabel={usedLabel}>
              <Text style={s.usedTitle}>{t("pro.usedTitle")}</Text>
              <Text style={s.usedLine}>
                {used.map((entry, index) => (
                  <Text key={entry.group}>
                    {index > 0 ? "  ·  " : ""}
                    {t(`pro.used.${entry.group}`)} <Text style={s.usedCount}>{entry.count}</Text>
                  </Text>
                ))}
              </Text>
            </View>
          ) : null}

          <View style={s.features}>
            {FEATURE_ICONS.map((icon, index) => (
              <View key={icon} style={s.featureRow}>
                <Ionicons name={icon} size={20} color={colors.textStrong} style={s.featureGlyph} />
                <View style={s.featureText}>
                  <Text style={s.featureTitle}>{t(`pro.features.${index}.title`)}</Text>
                  <Text style={s.featureBody}>{t(`pro.features.${index}.body`)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {showPlans ? (
          <ReAnimated.View
            entering={hasPro ? collapseIn : undefined}
            // Unfolded below what Pro adds: bring the prices into view.
            onLayout={hasPro ? () => scrollRef.current?.scrollToEnd({ animated: true }) : undefined}
            style={s.plans}
          >
            {PLAN_IDS.map((plan) => {
              const isSelected = plan === selected;
              const saving =
                plan === "annual" && savingPercent > 0 ? t("pro.plans.annual.save", { percent: savingPercent }) : null;
              return (
                <Press
                  key={plan}
                  // haptics.ts: light → a small state flip (a choice in a set).
                  haptic="light"
                  style={s.planRow}
                  onPress={() => setSelected(plan)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={[t(`pro.plans.${plan}.label`), priceOf(plan), saving].filter(Boolean).join(", ")}
                  testID={`pro-plan-${plan}`}
                >
                  <View style={[s.dot, isSelected ? s.dotOn : null]} />
                  <View style={s.planText}>
                    <View style={s.planHeader}>
                      <Text style={[s.planLabel, isSelected ? s.planLabelOn : null]}>{t(`pro.plans.${plan}.label`)}</Text>
                      {saving ? <Text style={s.planTag}>{saving}</Text> : null}
                    </View>
                    <Text style={s.planSub}>{subOf(plan)}</Text>
                  </View>
                  <Text style={s.planPrice}>{priceOf(plan)}</Text>
                </Press>
              );
            })}
          </ReAnimated.View>
        ) : null}
        {/* Under the prices: the doors without a line of their own, then what paying
            never touches. */}
        {welcome ? null : (
          <View style={s.footnotes}>
            <Text style={s.alsoLine}>{t("pro.also")}</Text>
            <Text style={s.freeLine}>{t("pro.freeForGood")}</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {notice ? (
          <Text style={s.notice} accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
        {welcome ? (
          <Button variant="primary" label={t("pro.welcomeDone")} onPress={onClose} style={s.cta} testID="pro-welcome-done" />
        ) : showPlans ? (
          <>
            <Button
              variant="primary-emphasis"
              label={t("pro.getPro")}
              disabled={busy}
              onPress={() => void handlePurchase()}
              style={s.cta}
              testID="pro-get"
            />
            <Text style={s.renewNote}>{t(Platform.OS === "ios" ? "pro.renewNoteIos" : "pro.renewNoteAndroid")}</Text>
          </>
        ) : canManage ? (
          <Button
            variant="secondary"
            label={t("pro.manage")}
            onPress={() => void Linking.openURL(manageSubscriptionUrl(purchase)).catch(() => {})}
            style={s.cta}
          />
        ) : null}
        <View style={s.footerLinks}>
          {welcome ? null : showPlans ? (
            <Press feel="glyph" disabled={busy} onPress={() => void handleRestore()} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>{t("pro.restore")}</Text>
            </Press>
          ) : canSeePlans ? (
            // haptics.ts: light → a small state flip (the prices unfold).
            <Press feel="glyph" haptic="light" onPress={() => setPlansOpen(true)} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>{t("pro.seePlans")}</Text>
            </Press>
          ) : null}
          {!welcome && (showPlans || canSeePlans) ? <Text style={s.linkDot}>·</Text> : null}
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
        </View>
      </View>
    </View>
  );
}

/** The single app-wide Pro page. Mount <ProUpsellHost/> once at the app root; any gated call
 *  site opens it via openProUpsell(feature). It fades in over whatever was open and
 *  fills the screen; Android back and the ✕ close it. */
export function ProUpsellHost() {
  const { visible } = useProUpsellState();
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={closeProUpsell}>
      <ModalGestureRoot>
        {visible ? <ProUpsellPage onClose={closeProUpsell} /> : null}
        {/* A dialog raised while the page is open draws here: iOS cannot present the
            root host's Modal over this one. */}
        <ModalDialogLayer active={visible} />
      </ModalGestureRoot>
    </Modal>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.page,
    paddingHorizontal: spacing.xxl,
  },
  // Glyph-only, the ✕ on the trailing edge: the page has one way out.
  navRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    minHeight: 44,
  },
  scroll: {
    flex: 1,
  },
  // What Pro adds reads from the top; the prices rest just above the key.
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.textSecondary,
  },
  headline: {
    ...textTokens.headerTitle,
    fontSize: 34,
    lineHeight: 40,
    marginTop: spacing.xs,
  },
  statusLine: {
    ...textTokens.supporting,
    color: colors.primaryDeep,
    marginTop: spacing.sm,
  },
  // Used in the free month: an eyebrow and up to three rows, name and tabular count.
  used: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  usedTitle: {
    ...textTokens.annotation,
    color: colors.textSecondary,
  },
  usedLine: {
    ...textTokens.body,
    fontSize: 15,
    lineHeight: 22,
  },
  usedCount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
    fontVariant: ["tabular-nums"],
  },
  welcomeBody: {
    ...textTokens.body,
    color: colors.textStrong,
    marginTop: spacing.md,
  },
  subhead: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  features: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  featureGlyph: {
    width: 22,
    textAlign: "center",
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  // The result first, in full ink; the tool beneath it, quieter.
  featureTitle: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
  },
  featureBody: {
    ...textTokens.supporting,
    fontSize: 14,
    lineHeight: 20,
  },
  footnotes: {
    paddingVertical: spacing.lg,
  },
  alsoLine: {
    ...textTokens.supporting,
  },
  freeLine: {
    ...textTokens.supporting,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  // Prices are rows on paper with an ink tick, not boxed cards.
  plans: {
    marginTop: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
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
    gap: spacing.sm,
  },
  // Jakarta faces come from the text tokens, never as family literals.
  planLabel: {
    fontFamily: textTokens.caption.fontFamily,
    fontSize: 15,
    color: colors.textStrong,
  },
  planLabelOn: {
    fontFamily: textTokens.sectionTitle.fontFamily,
    color: colors.textPrimary,
  },
  // The saving is the page's one accent besides the key: ink, no pill.
  planTag: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
  planSub: {
    ...textTokens.caption,
    fontFamily: textTokens.supporting.fontFamily,
    color: colors.textSecondary,
  },
  planPrice: {
    fontFamily: textTokens.caption.fontFamily,
    fontSize: 15,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  footer: {
    paddingTop: spacing.lg,
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
  // The renewal terms sit by the key that starts them, always in view.
  renewNote: {
    ...textTokens.caption,
    fontFamily: textTokens.supporting.fontFamily,
    color: colors.textSecondary,
    textAlign: "center",
  },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: spacing.xs,
  },
  link: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
  linkDot: {
    ...textTokens.caption,
    fontFamily: textTokens.supporting.fontFamily,
    color: colors.textMuted,
  },
});
