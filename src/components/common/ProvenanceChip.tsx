import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import type { ReceivedMeta } from "../../types";

/**
 * "FROM DANA" — the small blush chip that marks work which came from someone
 * else, wherever it sits among your own (Compilations lists, the Received
 * page's kind chip is the same recipe). Uppercase label, the mail-open glyph,
 * primaryDeep ink on the record-surface wash.
 */
export function ProvenanceChip({ received }: { received: ReceivedMeta }) {
  const { t } = useTranslation();
  const label = received.senderName
    ? t("received.from", { name: received.senderName })
    : t("received.fromSomeone");
  return (
    <View style={chipStyles.chip} accessibilityLabel={label}>
      <Ionicons name="mail-open-outline" size={11} color={colors.primaryDeep} />
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
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: colors.recordSurface,
    borderWidth: 1,
    borderColor: colors.recordBorder,
    borderRadius: radii.sm,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  text: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.primaryDeep,
  },
});
