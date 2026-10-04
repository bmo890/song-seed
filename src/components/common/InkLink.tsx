import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { haptic } from "../../design/haptics";
import { colors } from "../../design/tokens";
import { styles } from "../../styles";

type Props = {
  label: string;
  onPress: () => void;
  /** A leading glyph for a link that *does* something (play, write) rather than goes somewhere. */
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
};

/**
 * The quiet ink link — a way onward, never a second button (design system §3:
 * "one primary + a quiet ink link"). Jakarta semibold in primaryDeep with a
 * trailing chevron; tap = `haptic.tap` (vocabulary row: tap, a control acted).
 */
export function InkLink({ label, onPress, icon, testID }: Props) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [s.link, pressed ? styles.pressDown : null]}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={8}
      testID={testID}
    >
      {icon ? <Ionicons name={icon} size={14} color={colors.primaryDeep} /> : null}
      <Text style={s.text}>{label}</Text>
      <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.primaryDeep} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
  },
  text: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13.5,
    color: colors.primaryDeep,
    letterSpacing: 0.2,
  },
});
