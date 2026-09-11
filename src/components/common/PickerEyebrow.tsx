import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../design/tokens";
import { UserText } from "../../i18n";

/**
 * The picker's wayfinding line — a kind glyph + an uppercase eyebrow, sitting
 * above a page title while the page is acting as a picker ("ADDING TO SETLIST 1",
 * "CHOOSING A SONG FOR LYRICS"). Same register as the WHERE · WHAT eyebrow in
 * the collection nav row: it says what mode you are in without a banner.
 * Non-interactive; the picker's verbs live in `PickerFooter`.
 */
export function PickerEyebrow({
  icon,
  label,
  userValue,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** The user-authored part of the label (a compilation title), for direction. */
  userValue?: string;
  testID?: string;
}) {
  return (
    <View style={s.row} testID={testID} pointerEvents="none">
      <Ionicons name={icon} size={12} color={colors.eyebrow} />
      <UserText value={userValue ?? label} style={s.text} numberOfLines={1}>
        {label}
      </UserText>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    minWidth: 0,
  },
  // Mirrors CollectionHeaderSection's navEyebrow (the WHERE eyebrow).
  text: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
    color: colors.eyebrow,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    flexShrink: 1,
  },
});
