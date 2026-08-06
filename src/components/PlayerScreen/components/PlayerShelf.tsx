import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

/**
 * The quiet shelf pinned above the transport (reading-ladder phase 2): editorial
 * ink doors for what the clip HAS — no chips, no dead taps. Today it carries
 * Notes (terracotta dot = something's inside); it renders only when there is
 * something to open, so an empty clip keeps an empty shelf line off the page.
 */
export function PlayerShelf({
  hasNotes,
  onOpenNotes,
}: {
  hasNotes: boolean;
  onOpenNotes: () => void;
}) {
  const { t } = useTranslation();
  if (!hasNotes) return null;
  return (
    <View style={shelfStyles.row}>
      <Pressable
        style={({ pressed }) => [shelfStyles.ink, pressed ? appStyles.pressDown : null]}
        onPress={onOpenNotes}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("player.clipNotes")}
      >
        <View style={shelfStyles.dot} />
        <Text style={shelfStyles.inkText}>{t("songDetail.notes")}</Text>
      </Pressable>
    </View>
  );
}

const shelfStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 2,
  },
  ink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  inkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
});
