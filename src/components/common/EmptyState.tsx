import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../design/tokens";
import { dirIcon } from "../../design/directionalIcons";
import { haptic } from "../../design/haptics";
import { styles } from "../../styles";
import { Button } from "./Button";
import { Ledger } from "./Ledger";

/**
 * Shared empty-state — the ONLY "nothing here yet" surface (canon, 2026-09-08).
 *
 * Default: a muted icon ring, one Lora line, one supporting sentence, then at most
 * one primary soft key and one quiet ink link. Never two buttons.
 *
 * `ledger`: the Shelf's signature — the title rests on a shelf edge (see Ledger)
 * with the sentence and link beneath. Left-aligned, no icon. Reserved for the
 * Shelf; every other page stays on the default so the one special place stays
 * special.
 *
 * Copy budgets are hard: title ≤ 6 words, body ≤ 14, labels ≤ 2.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  linkLabel,
  onLink,
  compact = false,
  variant = "default",
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  /** The one primary action. Rendered as the canon tonal soft key. */
  actionLabel?: string;
  onAction?: () => void;
  /** A quiet ink link — a way onward, never a second button. */
  linkLabel?: string;
  onLink?: () => void;
  /** Tighter padding for inline regions (e.g. an empty section inside a screen). */
  compact?: boolean;
  variant?: "default" | "ledger";
  testID?: string;
}) {
  const link =
    linkLabel && onLink ? (
      <Pressable
        onPress={() => {
          haptic.tap();
          onLink();
        }}
        style={({ pressed }) => [s.link, pressed ? styles.pressDown : null]}
        accessibilityRole="link"
        accessibilityLabel={linkLabel}
        hitSlop={8}
      >
        <Text style={s.linkText}>{linkLabel}</Text>
        <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.primaryDeep} />
      </Pressable>
    ) : null;

  if (variant === "ledger") {
    return (
      <View style={[s.ledgerWrap, compact ? s.ledgerWrapCompact : null]} testID={testID}>
        <Text style={s.ledgerTitle}>{title}</Text>
        <Ledger />
        {body ? <Text style={s.ledgerBody}>{body}</Text> : null}
        {actionLabel && onAction ? (
          <Button label={actionLabel} onPress={onAction} style={s.ledgerAction} />
        ) : null}
        {link ? <View style={s.ledgerLink}>{link}</View> : null}
      </View>
    );
  }

  return (
    <View style={[s.wrap, compact ? s.wrapCompact : null]} testID={testID}>
      {icon ? (
        <View style={[s.iconRing, compact ? s.iconRingCompact : null]}>
          <Ionicons name={icon} size={compact ? 20 : 26} color={colors.textMuted} />
        </View>
      ) : null}
      <Text style={[s.title, compact ? s.titleCompact : null]}>{title}</Text>
      {body ? <Text style={s.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={s.action} />
      ) : null}
      {link ? <View style={actionLabel && onAction ? null : s.action}>{link}</View> : null}
    </View>
  );
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
  iconRingCompact: {
    width: 44,
    height: 44,
  },
  title: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
    textAlign: "center",
  },
  titleCompact: {
    fontSize: 17,
    lineHeight: 22,
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
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
  },
  linkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13.5,
    color: colors.primaryDeep,
    letterSpacing: 0.2,
  },

  // ── Ledger variant (Shelf only) ──────────────────────────────────────────
  ledgerWrap: {
    alignSelf: "stretch",
    paddingTop: 88,
    paddingBottom: 32,
    paddingHorizontal: spacing.xs,
  },
  ledgerWrapCompact: {
    paddingTop: 32,
  },
  ledgerTitle: {
    fontFamily: "Lora_500Medium",
    fontSize: 24,
    lineHeight: 28,
    color: colors.textPrimary,
    paddingBottom: spacing.sm,
  },
  ledgerBody: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    maxWidth: 300,
    marginTop: spacing.lg,
  },
  ledgerAction: {
    alignSelf: "flex-start",
    marginTop: spacing.lg,
  },
  ledgerLink: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
});
