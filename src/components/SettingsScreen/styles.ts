import { StyleSheet } from "react-native";
import { colors, radii } from "../../design/tokens";

export { styles } from "../../styles";

export const settingsScreenStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
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
  libraryCardStack: {
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  // Grouped-settings surface: a section's rows share one soft card, separated by
  // hairline dividers rather than each floating in its own bordered box.
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  groupDivider: {
    height: 1,
    backgroundColor: "#ECE6DF",
    marginHorizontal: 14,
  },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.xl,
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
    borderRadius: 999,
    backgroundColor: "#F4EBE6",
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
    backgroundColor: "#3F9C82",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  verifiedChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#fff",
  },
});
