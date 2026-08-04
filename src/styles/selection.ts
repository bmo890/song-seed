import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, shadows } from "../design/tokens";

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
  // ─── Selection top bar (count · All · Cancel) ───────────────────────────────
  // The sketch page's law, made universal: selection repurposes existing chrome
  // in place — no card, no shadow, and above all no pushing the list downward.
  selectionTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 38,
    paddingHorizontal: 2,
    backgroundColor: colors.page,
    zIndex: 20, // above FlatList sticky date headers
  },
  // Overlay variant: stretches over the chrome it replaces (search/filter rows)
  // instead of inserting itself into the flow.
  selectionTopBarOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  selectionTopBarCount: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontVariant: ["tabular-nums"],
    color: colors.textStrong,
  },
  // "All" is editorial ink, not a chip — one quiet word in the action color.
  selectionTopBarChipText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
  // Cancel is a soft key, same register as the sketch page's.
  selectionTopBarCancelBtn: {
    minHeight: 30,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  selectionTopBarCancelBtnText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textStrong,
  },
  // ─── Selection toolbar (icon-only bottom action bar) ─────────────────────────
  // Surface sheet lifted off the page: rounded top corners + whisper shadow
  // instead of a hard hairline.
  selectionToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: "#3D3732",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  selectionToolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
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
    color: colors.textSecondary,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  selectionToolbarActionLabelDanger: {
    color: colors.danger,
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
