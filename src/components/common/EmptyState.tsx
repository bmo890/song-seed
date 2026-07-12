import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../design/tokens";
import { haptic } from "../../design/haptics";

/**
 * Shared empty-state: a muted icon, one editorial line, a supporting sentence,
 * and an optional action. One component so every "nothing here yet" surface
 * reads the same and teaches what the surface is for instead of showing a void.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tighter padding for inline regions (e.g. an empty section inside a screen). */
  compact?: boolean;
}) {
  return (
    <View style={[s.wrap, compact ? s.wrapCompact : null]}>
      <View style={s.iconRing}>
        <Ionicons name={icon} size={compact ? 22 : 26} color={colors.textMuted} />
      </View>
      <Text style={s.title}>{title}</Text>
      {body ? <Text style={s.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            onAction();
          }}
          style={({ pressed }) => [s.action, pressed ? s.actionPressed : null]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={s.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Bare inline variant (icon + one line) for the smallest slots. */
export function EmptyStateHint({ children }: { children: ReactNode }) {
  return <Text style={s.hint}>{children}</Text>;
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: spacing.sm,
  },
  wrapCompact: {
    paddingVertical: 28,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 300,
  },
  action: {
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.onPrimary,
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
});
