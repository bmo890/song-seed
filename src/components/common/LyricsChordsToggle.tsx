import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows } from "../../design/tokens";
import { haptic } from "../../design/haptics";

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
  const anim = useRef(new Animated.Value(value === "chords" ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value === "chords" ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [anim, value]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, SEG_W] });

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
            accessibilityLabel={key === "lyrics" ? "Lyrics" : "Chords"}
          >
            <Ionicons
              name={key === "lyrics" ? "text" : "musical-notes"}
              size={14}
              color={active ? colors.onPrimary : colors.textSecondary}
            />
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {key === "lyrics" ? "Lyrics" : "Chords"}
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
    left: PAD,
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
