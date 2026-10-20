import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";

export { styles } from "../../styles";

export const settingsScreenStyles = StyleSheet.create({
  // ── About colophon ─────────────────────────────────────────────────────
  colophon: {
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  colophonMark: {
    width: 56,
    height: 56,
    marginBottom: spacing.xs,
  },
  colophonName: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  colophonVersion: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  scrollContent: {
    paddingBottom: 40,
    gap: 22,
  },
  overviewContent: {
    paddingBottom: 48,
    gap: 24,
  },
  overviewSection: {
    gap: 10,
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  backupFileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  backupFileName: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textStrong,
  },
  // Grouped-settings surface: a section's rows share one soft card, separated by
  // hairline dividers rather than each floating in its own bordered box.
  // Structure is rows on paper (2026-10-15): no fill, no border, the rows'
  // own 14 pt inset pulled back out so their glyphs sit on the page gutter.
  group: {
    marginHorizontal: -14,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    marginHorizontal: 14,
  },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  // Flat variant of libraryCard for use inside a `group` surface.
  libraryCardFlat: {
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  // A bare ink glyph; the tinted disc is gone with the cards.
  libraryCardIcon: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  libraryCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  libraryCardTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  libraryCardMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  segmentedField: {
    gap: 8,
  },
  // Padded for placement inside a SettingsGroup surface (matches the row insets).
  segmentedFieldFlat: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  segmentedCopy: {
    gap: 2,
  },
  segmentedTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  segmentedSubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 52,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  aboutRowLabel: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  aboutRowValue: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  // Said in ink, not a green pill (2026-10-20): a quiet check and a word.
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  verifiedChipText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
  inlineNoteRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  // A bare ink glyph, no tinted tile (2026-10-20).
  accountMark: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  accountIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  accountIdentityTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  accountIdentityMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  // The plan is a row on paper, not a terracotta-washed box (2026-10-20).
  planSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
  },
  planSummaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  planTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  planMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textStrong,
  },
  planBadge: {},
  planBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
});
