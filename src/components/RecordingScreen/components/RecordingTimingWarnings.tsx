import React, { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RecordingTimingWarning } from "../hooks/useRecordingScreenModel";
import { colors, radii } from "../../../design/tokens";
import { durations, springs } from "../../../design/motion";
import { haptic } from "../../../design/haptics";
import { styles as globalStyles } from "../../../styles";
import { useTranslation } from "react-i18next";

/** Horizontal travel past which a release commits the dismissal. */
const DISMISS_THRESHOLD_PX = 64;

/**
 * Quiet timing-honesty notices for the recording screen: uncalibrated/stale Bluetooth
 * output, Bluetooth microphone input, and mid-take route changes. Never blocking — the
 * user can always record anyway — and never insistent: each notice can be swiped away
 * for the rest of the session once it's been read.
 */
export function RecordingTimingWarnings({
  warnings,
  onCalibrate,
  onDismiss,
}: {
  warnings: RecordingTimingWarning[];
  onCalibrate: () => void;
  onDismiss: (kind: RecordingTimingWarning["kind"]) => void;
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <View style={s.stack}>
      {warnings.map((warning) => (
        <DismissableRow key={warning.kind} warning={warning} onCalibrate={onCalibrate} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

function DismissableRow({
  warning,
  onCalibrate,
  onDismiss,
}: {
  warning: RecordingTimingWarning;
  onCalibrate: () => void;
  onDismiss: (kind: RecordingTimingWarning["kind"]) => void;
}) {
  const { t } = useTranslation();
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const dismissedRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture only once it is clearly horizontal, so vertical scrolls and
      // plain taps (the Calibrate key) pass through untouched.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_event, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_event, gesture) => {
        const committed =
          Math.abs(gesture.dx) > DISMISS_THRESHOLD_PX || Math.abs(gesture.vx) > 0.8;
        if (committed && !dismissedRef.current) {
          dismissedRef.current = true;
          // haptics.ts vocabulary: light → small state flips (the notice is read & set aside).
          haptic.light();
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: gesture.dx >= 0 ? 480 : -480,
              duration: durations.base,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: durations.base,
              useNativeDriver: true,
            }),
          ]).start(() => onDismiss(warning.kind));
          return;
        }
        Animated.spring(translateX, {
          toValue: 0,
          ...springs.handle,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          ...springs.handle,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[s.row, { opacity, transform: [{ translateX }] }]}
      {...panResponder.panHandlers}
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={warning.kind === "bt-mic" ? "mic-off-outline" : "timer-outline"}
        size={14}
        color={colors.primaryDeep}
        style={s.icon}
      />
      <Text style={s.message} numberOfLines={3}>
        {warning.message}
      </Text>
      {warning.showCalibrateAction ? (
        <Pressable
          style={({ pressed }) => [s.action, pressed ? globalStyles.pressDown : null]}
          onPress={onCalibrate}
          accessibilityRole="button"
          accessibilityLabel={t("recording.openCalibration")}
        >
          <Text style={s.actionText}>{t("recording.calibrate")}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  stack: {
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primarySurface,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textStrong,
  },
  action: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
});
