import { useState } from "react";
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { AppAlert } from "./AppAlert";
import { closeProUpsell, useProUpsellState } from "./proUpsell";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { purchasePro, restorePurchases, type ProPlan } from "../../services/billing";

// TODO(owner): confirm these once the privacy policy is hosted (OWNER-TODO §3) and a terms
// page exists. Apple requires functional Terms + Privacy links on a live paywall; the sheet
// is never shown to real users until billing lands, so placeholders are fine until then.
const PRIVACY_URL = "https://bmo890.github.io/song-seed/privacy-policy";
const TERMS_URL = "https://bmo890.github.io/song-seed/terms";

type FeatureRow = { icon: keyof typeof Ionicons.glyphMap; title: string; blurb: string };

const FEATURES: FeatureRow[] = [
    { icon: "infinite-outline", title: "Practice suite", blurb: "Loop, slow down, and pitch-shift to learn any part." },
    { icon: "layers-outline", title: "Unlimited overdub layers", blurb: "Stack takes into a full arrangement." },
    { icon: "sparkles-outline", title: "Unlimited word sparks", blurb: "Keep every rhyme, cut-up, and stolen line." },
    { icon: "cloud-upload-outline", title: "Auto-backup", blurb: "Your library saved automatically." },
    { icon: "file-tray-full-outline", title: "Archive offload", blurb: "Move finished workspaces off-device to Files." },
    { icon: "document-text-outline", title: "PDF export", blurb: "Print chord charts and setlists." },
];

type PlanCard = { plan: ProPlan; label: string; price: string; sub: string; tag?: string };

// Placeholder prices — the real, localized prices come from the store (RevenueCat offerings)
// at runtime once billing lands; these are only ever seen in the pre-launch preview.
const PLANS: PlanCard[] = [
    { plan: "annual", label: "Annual", price: "$27.99 / yr", sub: "7-day free trial · about $2.33/mo", tag: "Best value" },
    { plan: "monthly", label: "Monthly", price: "$3.99 / mo", sub: "7-day free trial" },
    { plan: "lifetime", label: "Lifetime", price: "$69.99", sub: "Pay once — yours forever" },
];

function ProUpsellSheetBody({ onClose }: { onClose: () => void }) {
    const [selected, setSelected] = useState<ProPlan>("annual");
    const maxScroll = Math.round(Dimensions.get("window").height * 0.5);

    async function handlePurchase() {
        haptic.tap();
        const result = await purchasePro(selected);
        if (!result.ok) {
            AppAlert.info(
                "Songstead Pro",
                "Purchasing isn't available in this build yet — this is a preview of the upgrade."
            );
        } else {
            onClose();
        }
    }

    async function handleRestore() {
        const result = await restorePurchases();
        if (!result.ok) {
            AppAlert.info("Restore purchases", "There are no purchases to restore yet.");
        } else {
            onClose();
        }
    }

    const ctaLabel = selected === "lifetime" ? "Get Lifetime" : "Start free trial";

    return (
        <View style={styles.container}>
            <ScrollView
                style={{ maxHeight: maxScroll }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <Text style={styles.eyebrow}>SONGSTEAD PRO</Text>
                <Text style={styles.headline}>Grow every idea</Text>
                <Text style={styles.subhead}>
                    Capturing is always free. Pro unlocks the tools that turn a scrap into a song.
                </Text>

                <View style={styles.features}>
                    {FEATURES.map((f) => (
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
                    {PLANS.map((p) => {
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
                <Pressable onPress={handlePurchase} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
                    <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                </Pressable>
                <View style={styles.footerLinks}>
                    <Pressable onPress={handleRestore} hitSlop={8}>
                        <Text style={styles.link}>Restore</Text>
                    </Pressable>
                    <Text style={styles.linkDot}>·</Text>
                    <Pressable onPress={() => void Linking.openURL(TERMS_URL).catch(() => {})} hitSlop={8}>
                        <Text style={styles.link}>Terms</Text>
                    </Pressable>
                    <Text style={styles.linkDot}>·</Text>
                    <Pressable onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})} hitSlop={8}>
                        <Text style={styles.link}>Privacy</Text>
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
        color: "#FFFFFF",
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
