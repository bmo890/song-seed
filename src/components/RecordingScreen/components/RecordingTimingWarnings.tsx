import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RecordingTimingWarning } from "../hooks/useRecordingScreenModel";
import { colors } from "../../../design/tokens";

/**
 * Quiet timing-honesty banners for the recording screen: uncalibrated/stale Bluetooth
 * output, Bluetooth microphone input, and mid-take route changes. Never blocking — the
 * user can always record anyway — but silent misalignment is no longer possible.
 */
export function RecordingTimingWarnings({
  warnings,
  onCalibrate,
}: {
  warnings: RecordingTimingWarning[];
  onCalibrate: () => void;
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <View style={s.stack}>
      {warnings.map((warning) => (
        <View key={warning.kind} style={s.row}>
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
              style={({ pressed }) => [s.action, pressed ? s.pressed : null]}
              onPress={onCalibrate}
              accessibilityRole="button"
              accessibilityLabel="Open Bluetooth calibration"
            >
              <Text style={s.actionText}>Calibrate</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
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
    backgroundColor: "#f6ece5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "#5a4b45",
  },
  action: {
    borderRadius: 999,
    backgroundColor: colors.primaryDeep,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
  pressed: {
    opacity: 0.8,
  },
});
