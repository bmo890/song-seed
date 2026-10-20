import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Multi-select mode: selection bars, toolbars, sheets, indicators.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const selectionStyles = {
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
  selectionText: { fontSize: 13, color: colors.textStrong, fontFamily: "PlusJakartaSans_600SemiBold" },
  // ─── Selection top bar (count · All · Cancel) ───────────────────────────────
  // The sketch page's law, made universal: selection repurposes existing chrome
  // in place — no card, no shadow, and above all no pushing the list downward.
  selectionTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 38,
    paddingHorizontal: 14,
    backgroundColor: colors.page,
    // Above the search/filter chrome it replaces — the filter bar carries its own
    // high zIndex for dropdown menus, so this must clear that too.
    zIndex: 200,
    // Android orders siblings by elevation, so the bar needs one to win — but every
    // elevation casts a Material shadow, which drew a hard line under this quiet
    // chrome swap on Android only (iOS ignores elevation). Keep the stacking,
    // drop the shadow: a transparent shadow colour is honoured on Android 9+.
    elevation: 20,
    shadowColor: "transparent",
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
  // Inline variant: sits in the trailing stretch of a toolbar row (the
  // collection page swaps only its filter/sort glyphs for these controls so the
  // search field beside them stays live). No fill, no padding — the row owns both.
  selectionTopBarInline: {
    gap: 12,
    minHeight: 0,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    flexShrink: 0,
    elevation: 0,
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
  selectionSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  selectionSheetBack: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginStart: -6,
  },
  selectionSheetTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  // Rows on paper (2026-10-15) for sheets that draw their own rows (the
  // workspace picker): same recipe as SelectionActionSheet.
  selectionSheetActionList: {
    gap: 0,
  },
  selectionSheetAction: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectionSheetActionLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  selectionSheetActionText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 16,
    color: colors.textPrimary,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
