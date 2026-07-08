import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";

type Props = {
  playlistTitle: string;
  addedCount: number;
  onDone: () => void;
  onCancel: () => void;
};

/** Persistent "collecting" indicator shown while the user browses the app adding
 * items to a playlist. Same solid-terracotta mode language as the song-target
 * picker banner: you're in a mode, and the two exits are explicit — Done returns
 * to the playlist, ✕ ends collecting in place. */
export function PlaylistCollectorBanner({ playlistTitle, addedCount, onDone, onCancel }: Props) {
  return (
    <View style={bannerStyles.bar}>
      <View style={bannerStyles.iconWrap}>
        <Ionicons name="musical-notes" size={13} color={colors.onPrimary} />
      </View>
      <Text style={bannerStyles.text} numberOfLines={1}>
        Adding to {playlistTitle}
      </Text>
      {addedCount > 0 ? (
        <View style={bannerStyles.countBadge}>
          <Text style={bannerStyles.countBadgeText}>{addedCount}</Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [bannerStyles.doneBtn, pressed ? bannerStyles.btnPressed : null]}
        onPress={onDone}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Done — back to ${playlistTitle}`}
      >
        <Text style={bannerStyles.doneText}>Done</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [bannerStyles.cancelBtn, pressed ? bannerStyles.btnPressed : null]}
        onPress={onCancel}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Stop adding to playlist"
      >
        <Ionicons name="close" size={15} color={colors.onPrimary} />
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
    borderRadius: radii.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
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
  doneBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  doneText: {
    ...textTokens.caption,
    color: colors.onPrimary,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  cancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.7,
  },
});
