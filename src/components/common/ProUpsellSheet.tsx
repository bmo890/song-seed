import { useState } from "react";
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { closeProUpsell, useProUpsellState } from "./proUpsell";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { purchasePro, restorePurchases, type ProPlan } from "../../services/billing";
import { useTranslation } from "react-i18next";

// TODO(owner): confirm these once the privacy policy is hosted (OWNER-TODO §3) and a terms
// page exists. Apple requires functional Terms + Privacy links on a live paywall; the sheet
// is never shown to real users until billing lands, so placeholders are fine until then.
const PRIVACY_URL = "https://bmo890.github.io/song-nook/privacy-policy";
const TERMS_URL = "https://bmo890.github.io/song-nook/terms";

type FeatureRow = { icon: keyof typeof Ionicons.glyphMap; title: string; blurb: string };

const FEATURE_ICONS: FeatureRow["icon"][] = ["infinite-outline", "layers-outline", "sparkles-outline", "cloud-upload-outline", "file-tray-full-outline", "document-text-outline"];
const PLAN_IDS: ProPlan[] = ["annual", "monthly", "lifetime"];

function ProUpsellSheetBody({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const [selected, setSelected] = useState<ProPlan>("annual");
    // Feedback is rendered INLINE, not via AppAlert: this sheet is a Modal, AppDialog is
    // also a Modal, and iOS won't present a dialog over an already-open Modal — so an alert
    // here would silently no-op (a dead-end tap). Inline copy also reads better than a
    // dialog stacked on the sheet.
    const [notice, setNotice] = useState<string | null>(null);
    const maxScroll = Math.round(Dimensions.get("window").height * 0.5);

    async function handlePurchase() {
        haptic.tap();
        const result = await purchasePro(selected);
        if (!result.ok) {
            setNotice(t("pro.purchaseUnavailable"));
        } else {
            onClose();
        }
    }

    async function handleRestore() {
        const result = await restorePurchases();
        if (!result.ok) {
            setNotice(t("pro.noRestores"));
        } else {
            onClose();
        }
    }

    const ctaLabel = selected === "lifetime" ? t("pro.getLifetime") : t("pro.startTrial");
    const features: FeatureRow[] = FEATURE_ICONS.map((icon, index) => ({ icon, title: t(`pro.features.${index}.title`), blurb: t(`pro.features.${index}.blurb`) }));

    return (
        <View style={styles.container}>
            <ScrollView
                style={{ maxHeight: maxScroll }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <Text style={styles.eyebrow}>SONGNOOK PRO</Text>
                <Text style={styles.headline}>{t("pro.headline")}</Text>
                <Text style={styles.subhead}>
                    {t("pro.subhead")}
                </Text>

                <View style={styles.features}>
                    {features.map((f) => (
                        <View key={f.title} style={styles.featureRow}>
                            <View style={styles.featureIcon}>
                                <Ionicons name={f.icon} size={18} color={colors.primaryDeep} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{f.title}</Text>
                                <Text style={styles.featureBlurb}>{f.blurb}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.plans}>
                    {PLAN_IDS.map((plan) => {
                        const p = { plan, label: t(`pro.plans.${plan}.label`), price: t(`pro.plans.${plan}.price`), sub: t(`pro.plans.${plan}.sub`), tag: plan === "annual" ? t("pro.plans.annual.tag") : undefined };
                        const isSelected = p.plan === selected;
                        return (
                            <Pressable
                                key={p.plan}
                                onPress={() => {
                                    haptic.light();
                                    setSelected(p.plan);
                                }}
                                style={[styles.planCard, isSelected && styles.planCardSelected]}
                            >
                                <View style={styles.planHeader}>
                                    <Text style={styles.planLabel}>{p.label}</Text>
                                    {p.tag ? <Text style={styles.planTag}>{p.tag}</Text> : null}
                                </View>
                                <Text style={styles.planPrice}>{p.price}</Text>
                                <Text style={styles.planSub}>{p.sub}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                {notice ? <Text style={styles.notice}>{notice}</Text> : null}
                <Pressable onPress={handlePurchase} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
                    <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                </Pressable>
                <View style={styles.footerLinks}>
                    <Pressable onPress={handleRestore} hitSlop={8}>
                        <Text style={styles.link}>{t("pro.restore")}</Text>
                    </Pressable>
                    <Text style={styles.linkDot}>·</Text>
                    <Pressable onPress={() => void Linking.openURL(TERMS_URL).catch(() => {})} hitSlop={8}>
                        <Text style={styles.link}>{t("pro.terms")}</Text>
                    </Pressable>
                    <Text style={styles.linkDot}>·</Text>
                    <Pressable onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})} hitSlop={8}>
                        <Text style={styles.link}>{t("pro.privacy")}</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

/** The single app-wide paywall. Mount <ProUpsellHost/> once at the app root; any gated call
 *  site opens it via openProUpsell(feature). */
export function ProUpsellHost() {
    const { visible } = useProUpsellState();
    return (
        <BottomSheet visible={visible} onClose={closeProUpsell}>
            {visible ? <ProUpsellSheetBody onClose={closeProUpsell} /> : null}
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 4,
    },
    eyebrow: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 10,
        letterSpacing: 1.5,
        color: colors.primaryDeep,
    },
    headline: {
        fontFamily: "PlayfairDisplay_600SemiBold",
        fontSize: 30,
        lineHeight: 34,
        color: colors.textPrimary,
        marginTop: 4,
    },
    subhead: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
        marginTop: 8,
    },
    features: {
        marginTop: 22,
        gap: 14,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    featureIcon: {
        width: 38,
        height: 38,
        borderRadius: radii.round,
        backgroundColor: colors.surfaceContainer,
        alignItems: "center",
        justifyContent: "center",
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 14,
        color: colors.textPrimary,
    },
    featureBlurb: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 13,
        lineHeight: 17,
        color: colors.textSecondary,
        marginTop: 1,
    },
    plans: {
        marginTop: 22,
        gap: 10,
    },
    planCard: {
        borderWidth: 1,
        borderColor: colors.borderMuted,
        borderRadius: radii.xl,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    planCardSelected: {
        borderWidth: 2,
        borderColor: colors.primary,
        backgroundColor: "#FDF5F2",
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    planHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    planLabel: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 15,
        color: colors.textPrimary,
    },
    planTag: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 9,
        letterSpacing: 0.6,
        color: colors.primaryDeep,
        backgroundColor: "#F5E5DF",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radii.round,
        overflow: "hidden",
    },
    planPrice: {
        fontFamily: "PlayfairDisplay_600SemiBold",
        fontSize: 22,
        color: colors.textPrimary,
        marginTop: 6,
    },
    planSub: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    footer: {
        marginTop: 18,
        gap: 12,
    },
    notice: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 12,
        lineHeight: 16,
        color: colors.textSecondary,
        textAlign: "center",
    },
    cta: {
        backgroundColor: colors.primaryDeep,
        borderRadius: radii.round,
        paddingVertical: 15,
        alignItems: "center",
    },
    ctaPressed: {
        opacity: 0.9,
    },
    ctaLabel: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 15,
        letterSpacing: 0.3,
        color: colors.surface,
    },
    footerLinks: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
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
