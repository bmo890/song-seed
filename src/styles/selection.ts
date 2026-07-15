import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Multi-select mode: selection bars, toolbars, sheets, indicators.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const selectionStyles = {
  selectionIndicatorHidden: { width: 0, marginRight: 0 },
  selectionBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#fff",
    fontSize: 12,
    lineHeight: 14,
    textAlign: "center",
    textAlignVertical: "center",
  },
  selectionIndicatorCol: {
    width: 24,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  selectionIndicatorCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(215,194,189,0.6)",
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIndicatorActive: {
    borderColor: "#B87D6B",
    backgroundColor: "#B87D6B",
  },
  selectionBar: {
    marginTop: 4,
    marginBottom: 8,
    padding: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  songSelectionBar: {
    marginTop: 4,
    marginBottom: 8,
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#fff",
    gap: 10,
    alignItems: "stretch",
  },
  songSelectionBarHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  songSelectionBarActions: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  selectionText: { fontSize: 13, color: colors.textStrong, fontFamily: "PlusJakartaSans_600SemiBold" },
  // ─── Selection top bar (count · All/None · Done) ────────────────────────────
  selectionTopBar: {
    backgroundColor: "#EDE8E2",
    borderBottomWidth: 1,
    borderBottomColor: "#D9D2CA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    zIndex: 20, // above FlatList sticky date headers
  },
  selectionTopBarCount: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#1b1c1a",
  },
  // Bordered "All" chip — sits right after the count
  selectionTopBarChip: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryDeep,
  },
  selectionTopBarChipText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
  selectionTopBarCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.primaryDeep,
  },
  selectionTopBarCancelBtnText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FDFBF7",
  },
  // ─── Selection toolbar (icon-only bottom action bar) ─────────────────────────
  selectionToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FDFBF7",
    borderTopWidth: 1,
    borderTopColor: "#E8E4DF",
    zIndex: 50,
  },
  selectionToolbarActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectionToolbarAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 3,
  },
  selectionToolbarActionDisabled: {
    opacity: 0.35,
  },
  selectionToolbarActionLabel: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10,
    color: "#524440",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  selectionToolbarActionLabelDanger: {
    color: "#a83232",
  },
  selectionToolbarActionLabelDisabled: {
    color: "#b8a9a5",
  },
  selectionSheetTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    lineHeight: 20,
    color: "#1C1C19",
    marginBottom: 10,
  },
  selectionSheetActionList: {
    gap: 8,
  },
  selectionSheetAction: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(215, 194, 189, 0.2)",
    backgroundColor: "#FDFBF7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectionSheetActionDanger: {
    borderColor: "rgba(184, 50, 50, 0.15)",
    backgroundColor: "#FDF5F4",
  },
  selectionSheetActionLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectionSheetActionText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: "#524440",
  },
  selectionSheetActionTextDanger: {
    color: "#a83232",
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
