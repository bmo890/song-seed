import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import type { ReceivedMeta } from "../../types";

/**
 * "From Dana" — marks work that came from someone else, wherever it sits among
 * your own (Compilations lists). Since 2026-10-15 a quiet inline word in the
 * meta line with the mail-open glyph, not a boxed blush chip: SongNook has no
 * chips.
 */
export function ProvenanceChip({ received }: { received: ReceivedMeta }) {
  const { t } = useTranslation();
  const label = received.senderName
    ? t("received.from", { name: received.senderName })
    : t("received.fromSomeone");
  return (
    <View style={chipStyles.chip} accessibilityLabel={label}>
      <Ionicons name="mail-open-outline" size={12} color={colors.textStrong} />
      <Text style={chipStyles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textStrong,
  },
});
