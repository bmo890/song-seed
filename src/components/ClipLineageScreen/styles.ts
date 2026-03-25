import { StyleSheet } from "react-native";

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
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "#64748b",
    marginTop: 1,
  },
  sortToggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: "#e8eaed",
    borderRadius: 10,
    padding: 3,
  },
  sortTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 8,
  },
  sortTabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  sortTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  sortTabTextActive: {
    color: "#0f172a",
  },
});
