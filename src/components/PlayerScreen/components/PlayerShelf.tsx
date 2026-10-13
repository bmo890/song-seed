import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "../../common/Press";
import { styles as appStyles } from "../../../styles";
import { colors, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

/**
 * The quiet shelf pinned above the transport (reading-ladder phase 2): editorial
 * ink doors for what the clip HAS — no chips, no dead taps. Today it carries
 * Notes; it renders only when there is something to open, so an empty clip
 * keeps an empty shelf line off the page.
 *
 * A glyph, not a dot (2026-10-13): on this page a dot beside a word now means
 * on/off ("Marks"), and a door must not borrow a switch's face.
 */
export const PlayerShelf = memo(PlayerShelfInner);

function PlayerShelfInner({
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
      <Press
        haptic="none"
        style={shelfStyles.ink}
        onPress={onOpenNotes}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("player.clipNotes")}
      >
        <Ionicons name="document-text-outline" size={15} color={colors.textSecondary} />
        <Text style={shelfStyles.inkText}>{t("songDetail.notes")}</Text>
      </Press>
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
  inkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
});
