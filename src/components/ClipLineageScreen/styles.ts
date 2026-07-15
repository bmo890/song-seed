import { StyleSheet } from "react-native";
import { colors } from "../../design/tokens";

export { styles } from "../IdeaDetailScreen/styles";

export const clipLineageStyles = StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  sortToggleRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    marginTop: 0,
    marginBottom: 6,
  },
  sortDirectionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(215,194,189,0.18)",
  },
  sortDirectionPillPressed: {
    backgroundColor: "rgba(215,194,189,0.35)",
  },
  sortDirectionText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textSecondary,
  },
});
