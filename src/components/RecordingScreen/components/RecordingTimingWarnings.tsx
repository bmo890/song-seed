import React, { useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RecordingTimingWarning } from "../hooks/useRecordingScreenModel";
import { colors } from "../../../design/tokens";
import { durations, springs } from "../../../design/motion";
import { haptic } from "../../../design/haptics";
import { Press } from "../../common/Press";
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
      {warnings.map((warning, index) => (
        <DismissableRow
          key={warning.kind}
          warning={warning}
          last={index === warnings.length - 1}
          onCalibrate={onCalibrate}
          onDismiss={onDismiss}
        />
      ))}
    </View>
  );
}

function DismissableRow({
  warning,
  last,
  onCalibrate,
  onDismiss,
}: {
  warning: RecordingTimingWarning;
  last: boolean;
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
      style={[s.row, last ? s.rowLast : null, { opacity, transform: [{ translateX }] }]}
      {...panResponder.panHandlers}
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={warning.kind === "bt-mic" ? "mic-off-outline" : "timer-outline"}
        size={15}
        color={colors.primaryDeep}
        style={s.icon}
      />
      <Text style={s.message} numberOfLines={2}>
        {warning.message}
      </Text>
      {warning.showCalibrateAction ? (
        <Press
          // Haptics vocabulary: the link only takes you somewhere; navigation is silent.
          haptic="navigate"
          feel="glyph"
          style={s.action}
          onPress={onCalibrate}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t("recording.openCalibration")}
        >
          <Text style={s.actionText}>{t("recording.calibrate")}</Text>
        </Press>
      ) : null}
    </Animated.View>
  );
}

// One quiet line on paper between hairlines (2026-10-16; was a tinted pill
// with a white key): a glyph, a short sentence, an ink link.
const s = StyleSheet.create({
  stack: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  rowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong,
  },
  action: {
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
});
