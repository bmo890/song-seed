import { useEffect, useRef, useSyncExternalStore } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useStore } from "../state/useStore";
import { getPersistHealth, onPersistHealthChange, type PersistHealth } from "../state/persistRuntime";
import { colors, radii } from "../design/tokens";
import { haptic } from "../design/haptics";

const COPY: Record<Exclude<PersistHealth, "ok">, { title: string; hint: string }> = {
    // Both stores refused several writes in a row — nothing is landing.
    failing: { title: "recovery.cantSave", hint: "recovery.cantSaveHint" },
    // SQLite refused; writes are parked in the fallback and replayed when it recovers.
    degraded: { title: "recovery.saveDegraded", hint: "recovery.saveDegradedHint" },
    // A safety gate refuses every write for the rest of the session.
    blocked: { title: "recovery.saveLocked", hint: "recovery.saveLockedHint" },
};

/**
 * Persistent persistence-health bar (2026-08-26 audit F5; widened 2026-09-07): shows
 * whenever the user is editing a library that is not reaching the authoritative
 * store — writes failing both stores, writes landing only in the fallback, or a
 * safety gate freezing the session. Silent variants of all three cost a take, its
 * title, and its sketch in the field. Clears itself the moment a write lands in
 * SQLite (blocked stays until the gate is deliberately lifted). Mirrors
 * ImportProgressBanner's shell so the two bars read as one vocabulary.
 */
export function PersistFailureBanner({ hidden = false }: { hidden?: boolean }) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const playerDockHeight = useStore((s) => s.playerDockHeight);
    const health = useSyncExternalStore(
        (onStoreChange) => onPersistHealthChange(onStoreChange),
        getPersistHealth,
        getPersistHealth
    );
    const visible = health !== "ok" && !hidden;
    const lastShown = useRef<Exclude<PersistHealth, "ok">>("failing");
    if (health !== "ok") lastShown.current = health;
    const copy = COPY[lastShown.current];

    const slideAnim = useRef(new Animated.Value(0)).current;
    const wasVisible = useRef(false);
    useEffect(() => {
        if (visible && !wasVisible.current) {
            wasVisible.current = true;
            // Failures fire `error` (haptics vocabulary: "a destructive or failed
            // outcome the user must not miss").
            haptic.error();
            slideAnim.setValue(0);
            Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
        } else if (!visible && wasVisible.current) {
            wasVisible.current = false;
            Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
    }, [visible, slideAnim]);

    if (!visible && !wasVisible.current) return null;

    const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
    const bottom = playerDockHeight > 0 ? playerDockHeight + 8 : Math.max(insets.bottom, 14);

    return (
        <Animated.View
            style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom,
                zIndex: 50,
                transform: [{ translateY }],
                pointerEvents: "none",
            }}
        >
            <View
                style={{
                    backgroundColor: colors.dangerSurface,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: colors.danger,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_600SemiBold",
                            fontSize: 13,
                            color: colors.danger,
                            lineHeight: 17,
                        }}
                    >
                        {t(copy.title)}
                    </Text>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_400Regular",
                            fontSize: 11,
                            color: colors.textSecondary,
                            lineHeight: 15,
                        }}
                    >
                        {t(copy.hint)}
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
}
