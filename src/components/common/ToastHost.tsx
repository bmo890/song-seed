import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows } from "../../design/tokens";
import { durations } from "../../design/motion";
import { toastStore, type ToastConfig } from "./toastStore";

const DEFAULT_DURATION_MS = 2000;
/** Clearance above the media dock (which floats at the bottom edge). */
const DOCK_CLEARANCE = 92;

/**
 * Renders the app's single quiet-confirmation toast. Mounted once in App.tsx,
 * above the media dock but below AppDialogHost — a toast must never obscure a
 * decision. Slides up ~8px + fades in, auto-dismisses, announces itself to
 * screen readers.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<(ToastConfig & { id: number }) | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = toastStore.subscribe((toast) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (!toast) {
        Animated.timing(anim, { toValue: 0, duration: durations.fast, useNativeDriver: true }).start(
          () => setActive(null)
        );
        return;
      }
      setActive(toast);
      AccessibilityInfo.announceForAccessibility?.(toast.message);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: durations.base, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: durations.gentle, useNativeDriver: true }).start(
          () => setActive(null)
        );
      }, toast.durationMs ?? DEFAULT_DURATION_MS);
    });
    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [anim]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={[s.wrap, { bottom: insets.bottom + DOCK_CLEARANCE }]}>
      <Animated.View
        style={[
          s.pill,
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        {active.icon ? (
          <Ionicons name={active.icon} size={15} color={colors.primaryDeep} />
        ) : null}
        <Text style={s.text} numberOfLines={2}>
          {active.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "82%",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  text: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textStrong,
  },
});
