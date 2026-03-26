import { StyleSheet } from "react-native";

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
    color: "#334155",
  },
});
