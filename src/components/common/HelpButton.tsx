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
 *
 * `emphasized` is the first-visit state (persisted via `seenHints`): a quiet
 * terracotta wash behind the glyph until the sheet is opened once, then it
 * recedes to the muted resting look. A hint, not a badge — no motion, no dot.
 */
export function HelpButton({
  onPress,
  compact = false,
  emphasized = false,
  size,
}: {
  onPress: () => void;
  compact?: boolean;
  emphasized?: boolean;
  size?: number;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={compact ? 12 : 8}
      style={({ pressed }) => [
        compact ? s.btnCompact : s.btn,
        // A custom glyph size shrinks the box with it, so the button sits flush
        // beside same-size IconButton glyphs in dense toolbars.
        !compact && size != null ? { width: size + 12, height: size + 12 } : null,
        emphasized ? s.btnEmphasized : null,
        pressed ? s.pressed : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("common.help")}
    >
      <Ionicons
        name="help-circle-outline"
        size={size ?? (compact ? 15 : 22)}
        color={emphasized ? colors.primaryDeep : compact ? colors.textMuted : colors.textSecondary}
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
  btnEmphasized: {
    backgroundColor: colors.primarySurface,
  },
  pressed: {
    opacity: 0.6,
  },
});
