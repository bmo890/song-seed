import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { styles } from "../../styles";
import { colors, radii, shadows } from "../../design/tokens";

type SurfaceCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function SurfaceCard({ children, style, onPress, onLongPress }: SurfaceCardProps) {
  if (onPress || onLongPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          surfaceCardStyles.card,
          style,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={250}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[surfaceCardStyles.card, style]}>{children}</View>;
}

const surfaceCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
    gap: 6,
    position: "relative",
    ...shadows.card,
  },
});
