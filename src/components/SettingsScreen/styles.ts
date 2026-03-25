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
});
