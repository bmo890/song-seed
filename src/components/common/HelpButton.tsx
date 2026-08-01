import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { useTranslation } from "react-i18next";

/**
 * The "?" affordance that opens a HelpSheet. Consistent everywhere.
 *
 * `compact` is the in-row variant: a single tool inside a dense row explaining
 * itself, rather than the whole screen. Same glyph and behaviour, sized so it sits
 * beside a label without competing with it — hit area stays a full target via hitSlop.
 */
export function HelpButton({ onPress, compact = false }: { onPress: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={compact ? 12 : 8}
      style={({ pressed }) => [compact ? s.btnCompact : s.btn, pressed ? s.pressed : null]}
      accessibilityRole="button"
      accessibilityLabel={t("common.help")}
    >
      <Ionicons
        name="help-circle-outline"
        size={compact ? 15 : 22}
        color={compact ? colors.textMuted : colors.textSecondary}
      />
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
  btnCompact: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
