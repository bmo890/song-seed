import { StyleSheet } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../../styles";
import { colors, radii, shadows, spacing } from "../../../design/tokens";
import { ProMark } from "../../common/ProMark";
import type { ProFeature } from "../../../domain/entitlements";
import { useStore } from "../../../state/useStore";

/**
 * The hub's one primary action — a new playlist / chart book / setlist — as
 * the same round terracotta key the workspace hub uses for a new collection.
 * Big is earned by being THE action; the soft "New …" keys that sat above
 * each list were a second voice saying the same thing (founder, 2026-10-11).
 */
export function CreateFab({
  onPress,
  accessibilityLabel,
  testID,
  pro,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  /** Creating this is a Pro door (chart books, setlists): the Pro mark rides above the key. */
  pro?: ProFeature;
}) {
  const insets = useSafeAreaInsets();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  return (
    <Press
      haptic="none"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[local.fab,
        { bottom: playerDockHeight > 0 ? playerDockHeight + 12 : Math.max(32, insets.bottom + 16) }]}
      onPress={onPress}
    >
      <Ionicons name="add" size={26} color={colors.onPrimary} />
      {pro ? <ProMark feature={pro} style={local.mark} /> : null}
    </Press>
  );
}

const local = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 24,
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.cardActive,
  },
  // Above the circle, not on it: small ink would not read on terracotta.
  mark: {
    position: "absolute",
    top: -spacing.lg,
    alignSelf: "center",
  },
});
