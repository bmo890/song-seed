import { useEffect, useRef } from "react";
import { Animated, I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { useTranslation } from "react-i18next";
import { physicalEdge } from "../../i18n";

export type LyricsChordsValue = "lyrics" | "chords";

const PAD = 4;
const SEG_W = 96;

/** A two-state toggle for switching a lyric version between its words and its
 * chord chart. A clay thumb slides under the active side; each side has an icon
 * so the two views read at a glance. Shared by the version card and the version
 * page so they stay identical. */
export function LyricsChordsToggle({
  value,
  onChange,
}: {
  value: LyricsChordsValue;
  onChange: (value: LyricsChordsValue) => void;
}) {
  const { t } = useTranslation();
  // The thumb is anchored to the PHYSICAL left of the track and slides right by
  // whole segments, because translateX is physical too. In RTL the segments
  // render right-to-left, so "chords" (second in reading order) is the one on the
  // physical left — the offset has to be computed from the rendered position, not
  // the index. Getting this wrong slid the thumb clean off the track.
  const physicalSlot = I18nManager.isRTL
    ? (value === "chords" ? 0 : 1)
    : (value === "chords" ? 1 : 0);
  const translateX = useRef(new Animated.Value(physicalSlot * SEG_W)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: physicalSlot * SEG_W,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [translateX, physicalSlot]);

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      {(["lyrics", "chords"] as const).map((key) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            style={styles.seg}
            onPress={() => {
              if (key === value) return;
              haptic.tap();
              onChange(key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(key === "lyrics" ? "common.lyrics" : "common.chords")}
          >
            <Ionicons
              name={key === "lyrics" ? "text" : "musical-notes"}
              size={14}
              color={active ? colors.onPrimary : colors.textSecondary}
            />
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {t(key === "lyrics" ? "common.lyrics" : "common.chords")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    width: SEG_W * 2 + PAD * 2,
    padding: PAD,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    position: "relative",
  },
  thumb: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    [physicalEdge("left")]: PAD,
    width: SEG_W,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    ...shadows.control,
  },
  seg: {
    width: SEG_W,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.onPrimary,
  },
});
