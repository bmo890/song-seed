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
    borderRadius: 14,
    backgroundColor: "rgba(215,194,189,0.2)",
  },
  viewToggleOption: {
    minHeight: 28,
    borderRadius: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleOptionActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#3D3732",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  viewToggleText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    lineHeight: 14,
    color: "#84736f",
    fontWeight: "600",
  },
  viewToggleTextActive: {
    color: "#1C1C19",
  },
});
