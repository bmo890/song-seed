import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../../styles";
import { colors, radii, shadows } from "../../../design/tokens";
import { useStore } from "../../../state/useStore";

/**
 * The hub's one primary action — a new playlist / chart book / setlist — as
 * the same round terracotta key the workspace hub uses for a new collection.
 * Big is earned by being THE action; the soft "New …" keys that sat above
 * each list were a second voice saying the same thing (founder, 2026-10-11).
 */
export function CreateFab({ onPress, accessibilityLabel, testID }: { onPress: () => void; accessibilityLabel: string; testID?: string }) {
  const insets = useSafeAreaInsets();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        local.fab,
        { bottom: playerDockHeight > 0 ? playerDockHeight + 12 : Math.max(32, insets.bottom + 16) },
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <Ionicons name="add" size={26} color={colors.onPrimary} />
    </Pressable>
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
});
