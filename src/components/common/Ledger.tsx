import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing } from "../../design/tokens";

/**
 * A shelf edge — the Shelf page's signature (2026-09-08).
 *
 * One hairline with two short end brackets, so it reads as the lip of a shelf
 * rather than a divider, and a whisper of shadow beneath it (two fading hairlines;
 * no gradient dependency, identical on both platforms). An optional label sits on
 * the shelf the way a section title would rest on a real one. The same primitive
 * carries the empty state (`EmptyState variant="ledger"`) and the populated
 * page's section labels, so the shelf looks like the same place full or empty.
 */
export function Ledger({
  label,
  count,
  lip = true,
  style,
}: {
  label?: string;
  count?: number;
  /** The faint shadow under the edge. Off for a secondary ledger lower on the page. */
  lip?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.wrap, style]}>
      {label ? (
        <Text style={s.label} numberOfLines={1}>
          {label}
          {count != null ? <Text style={s.count}>{`  ·  ${count}`}</Text> : null}
        </Text>
      ) : null}
      <View style={s.edgeRow}>
        <View style={s.bracket} />
        <View style={s.edge} />
        <View style={s.bracket} />
      </View>
      {lip ? (
        <>
          <View style={[s.lipLine, s.lipNear]} />
          <View style={[s.lipLine, s.lipFar]} />
        </>
      ) : null}
    </View>
  );
}

const BRACKET_HEIGHT = 5;

const s = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
  },
  label: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  count: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textMuted,
    letterSpacing: 0,
  },
  edgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    height: BRACKET_HEIGHT,
  },
  edge: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.borderMuted,
  },
  bracket: {
    width: StyleSheet.hairlineWidth * 2,
    height: BRACKET_HEIGHT,
    backgroundColor: colors.borderMuted,
  },
  lipLine: {
    height: 1,
    backgroundColor: colors.textPrimary,
  },
  lipNear: {
    marginTop: -BRACKET_HEIGHT + 1,
    opacity: 0.07,
  },
  lipFar: {
    opacity: 0.035,
  },
});
