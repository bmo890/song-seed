import { StyleSheet } from "react-native";
import { colors, radii } from "../../design/tokens";

export { styles } from "../../styles";

export const settingsScreenStyles = StyleSheet.create({
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
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  groupDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 14,
  },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingVertical: 13,
    paddingHorizontal: 13,
  },
  // Flat variant of libraryCard for use inside a `group` surface.
  libraryCardFlat: {
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  libraryCardIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
  },
  libraryCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  libraryCardTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  libraryCardMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
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
  segmentedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  segmentedChip: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedChipActive: {
    backgroundColor: colors.primary,
  },
  segmentedChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentedChipTextActive: {
    color: colors.onPrimary,
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
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accentSuccessText,
    borderRadius: radii.round,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  verifiedChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.onPrimary,
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
  accountMark: {
    width: 48,
    height: 48,
    borderRadius: radii.round,
    backgroundColor: colors.primarySurface,
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
  planSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.primarySurface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  planSummaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  planTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.primaryDeep,
  },
  planMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textStrong,
  },
  planBadge: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  planBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.primaryDeep,
  },
});
