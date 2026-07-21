import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../i18n";

type Props = {
  kind: "playlist" | "songbook" | "setlist";
  targetTitle: string;
  addedCount: number;
  onDone: () => void;
  onCancel: () => void;
};

const KIND_ICONS = {
  playlist: "musical-notes",
  songbook: "book",
  setlist: "albums",
} as const;

/** Persistent "collecting" indicator shown while the user browses the app adding
 * items to a playlist, songbook, or setlist. Same solid-terracotta mode language
 * as the song-target picker banner: you're in a mode, and the two exits are
 * explicit — Done returns to the collection, ✕ ends collecting in place. */
export function LibraryCollectorBanner({ kind, targetTitle, addedCount, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <View style={bannerStyles.bar}>
      <View style={bannerStyles.iconWrap}>
        <Ionicons name={KIND_ICONS[kind]} size={13} color={colors.onPrimary} />
      </View>
      <UserText value={targetTitle} style={bannerStyles.text} numberOfLines={1}>{t("common.addingTo", { title: targetTitle })}</UserText>
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
        accessibilityLabel={t("common.doneBackTo", { title: targetTitle })}
      >
        <Text style={bannerStyles.doneText}>{t("common.done")}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [bannerStyles.cancelBtn, pressed ? bannerStyles.btnPressed : null]}
        onPress={onCancel}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("common.stopAdding")}
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
