import { StyleSheet } from "react-native";
import { colors } from "../../../../design/tokens";

export const songClipToolbarStyles = StyleSheet.create({
  headerStack: {
    gap: 8,
    overflow: "visible",
    zIndex: 130,
    elevation: 13,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 130,
    elevation: 13,
    overflow: "visible",
  },
  controlsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  menuOffset: {
    left: 0,
    top: 38,
  },
  menuOffsetRight: {
    left: 0,
    top: 38,
  },
  filterClearText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.primary,
  },
  customTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  viewTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 12,
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "rgba(215,194,189,0.2)",
  },
  viewTriggerOpen: {
    backgroundColor: "rgba(215,194,189,0.4)",
  },
  viewTriggerText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  viewTriggerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 3,
    borderRadius: 999,
    backgroundColor: "rgba(215,194,189,0.2)",
  },
  viewToggleOption: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleOptionActive: {
    backgroundColor: colors.surface,
    shadowColor: "#3D3732",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  viewToggleText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    lineHeight: 14,
    color: colors.textSecondary,
    },
  viewToggleTextActive: {
    color: "#1C1C19",
  },
});
