import { StyleSheet } from "react-native";
import { colors } from "../../design/tokens";

export { styles } from "../../styles";

export const settingsScreenStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tagBadgeText: {
    fontSize: 12,
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  backupSummaryBlock: {
    marginTop: 12,
    gap: 10,
  },
  backupSummaryRow: {
    gap: 6,
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
    fontSize: 14,
    lineHeight: 20,
    color: colors.textStrong,
  },
  backupCancelButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backupCancelText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  libraryCardStack: {
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    fontSize: 11.5,
    color: colors.textSecondary,
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
