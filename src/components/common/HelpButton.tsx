import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { useTranslation } from "react-i18next";

/** The "?" affordance that opens a screen's HelpSheet. Consistent everywhere. */
export function HelpButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [s.btn, pressed ? s.pressed : null]}
      accessibilityRole="button"
      accessibilityLabel={t("common.help")}
    >
      <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
