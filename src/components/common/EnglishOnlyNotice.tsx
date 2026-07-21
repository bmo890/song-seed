import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, radii, spacing } from "../../design/tokens";

export function EnglishOnlyNotice({ magpie = false }: { magpie?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.notice} accessibilityRole="text">
      <Ionicons name="language-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.copy}>{t(magpie ? "wordSparks.magpieAvailability" : "wordSparks.availability")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
  },
  copy: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
});
