import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { colors, radii, spacing } from "../../../../design/tokens";
import { styles as appStyles } from "../../../../styles";
import { haptic } from "../../../../design/haptics";
import { useTranslation } from "react-i18next";

export const CHORD_ZOOM_MIN = 0.5;
export const CHORD_ZOOM_MAX = 1.6;

/** Horizontal font-zoom for the chord chart — shrink to fit a long line on one
 * screen, or enlarge for readability. Mirrors the chord-sheet full-view zoom. */
export function ChordZoomBar({
  zoom,
  onChange,
  compact = false,
}: {
  zoom: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const atDefault = Math.abs(zoom - 1) < 0.001;
  return (
    <View style={[styles.zoomBar, compact ? styles.zoomBarCompact : null]}>
      <Ionicons name="text" size={13} color={colors.textMuted} />
      <Slider
        onSlidingComplete={() => haptic.tap()}
        style={styles.slider}
        minimumValue={CHORD_ZOOM_MIN}
        maximumValue={CHORD_ZOOM_MAX}
        value={zoom}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.borderMuted}
        thumbTintColor={colors.primary}
      />
      <Ionicons name="text" size={20} color={colors.textMuted} />
      <Pressable
        onPress={() => onChange(1)}
        disabled={atDefault}
        hitSlop={8}
        accessibilityLabel={t("chordEditor.resetZoom")}
        style={({ pressed }) => [styles.reset, pressed ? appStyles.pressDown : null]}
      >
        <Ionicons name="refresh" size={16} color={atDefault ? colors.borderMuted : colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zoomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  zoomBarCompact: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  slider: {
    flex: 1,
  },
  reset: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
