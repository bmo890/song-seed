import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";

type Props = {
  count: number;
  onCancel: () => void;
};

/** Persistent indicator shown across screens while the user is navigating the
 * app to pick a song target (e.g. "Add to Song" from the Lyrics Pad). Deliberately
 * a solid terracotta bar — visually distinct from the neutral clipboard banner — so
 * it reads as its own mode at a glance, not a copy/move clipboard state. Rendered
 * full-width outside the scroll area wherever it's used so it stays pinned in place. */
export function SongTargetPickerBanner({ count, onCancel }: Props) {
  return (
    <View style={bannerStyles.bar}>
      <View style={bannerStyles.iconWrap}>
        <Ionicons name="albums" size={14} color={colors.onPrimary} />
      </View>
      <Text style={bannerStyles.text} numberOfLines={1}>
        Pick a song to add lyrics to
      </Text>
      {count > 1 ? (
        <View style={bannerStyles.countBadge}>
          <Text style={bannerStyles.countBadgeText}>{count}</Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [bannerStyles.cancelBtn, pressed ? bannerStyles.cancelBtnPressed : null]}
        onPress={onCancel}
        hitSlop={8}
      >
        <Text style={bannerStyles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...textTokens.body,
    flex: 1,
    color: colors.onPrimary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    ...textTokens.annotation,
    color: colors.onPrimary,
    letterSpacing: 0,
  },
  cancelBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  cancelBtnPressed: {
    opacity: 0.7,
  },
  cancelText: {
    ...textTokens.caption,
    color: colors.onPrimary,
    textTransform: "none",
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
