import type { ReactNode } from "react";
import { StyleSheet, View, type AccessibilityRole, type AccessibilityState, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "./Press";
import { styles } from "../../styles";
import { colors, radii, shadows } from "../../design/tokens";

type SurfaceCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Assistive semantics for a pressable card (a selectable row is a "button"). */
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
  testID?: string;
};

export function SurfaceCard({
  children,
  style,
  selected,
  onPress,
  onLongPress,
  accessibilityRole,
  accessibilityState,
  accessibilityLabel,
  testID,
}: SurfaceCardProps) {
  if (onPress || onLongPress) {
    return (
      <Press
        haptic="none"
        testID={testID}
        style={[surfaceCardStyles.card,
          selected ? surfaceCardStyles.cardSelected : null,
          style]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={450}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Press>
    );
  }

  return (
    <View style={[surfaceCardStyles.card, selected ? surfaceCardStyles.cardSelected : null, style]}>
      {children}
    </View>
  );
}

const surfaceCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(215, 194, 189, 0.1)",
    padding: 14,
    gap: 6,
    position: "relative",
    ...shadows.card,
  },
  cardSelected: {
    backgroundColor: "#FDF5F2",
    borderColor: colors.primary,
    borderWidth: 2,
  },
});
