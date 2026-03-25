import { StyleSheet } from "react-native";

export const songClipToolbarStyles = StyleSheet.create({
  headerStack: {
    gap: 8,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 30,
  },
  menuOffset: {
    left: 0,
    top: 38,
  },
  customTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#ffffff",
  },
  viewToggleOption: {
    minHeight: 28,
    borderRadius: 13,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleOptionActive: {
    backgroundColor: "#0f172a",
  },
  viewToggleText: {
    fontSize: 12,
    lineHeight: 14,
    color: "#475569",
    fontWeight: "700",
  },
  viewToggleTextActive: {
    color: "#ffffff",
  },
});
