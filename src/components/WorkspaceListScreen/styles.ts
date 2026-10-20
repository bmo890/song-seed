import { StyleSheet } from "react-native";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    paddingHorizontal: spacing.lg,
  },
  flexFill: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 128,
    gap: 0,
  },

  // ── Sort row ──────────────────────────────────────────────────────────────
  sortRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 20,
  },
  sortMenuContainer: {
    position: "relative",
    zIndex: 10,
  },
  sortMenuBackdrop: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 9,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.lg,
  },
  // Active order reads in full ink, never a fill (toolbar keys are ink).
  sortPillActive: {},
  sortPillText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
  sortPillTextActive: {
    color: colors.textPrimary,
  },
  // The same popover card as every toolbar menu (ideasSortMenu).
  sortMenu: {
    position: "absolute",
    right: 0,
    top: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 0.5,
    borderColor: colors.borderSubtle,
    paddingVertical: 6,
    minWidth: 220,
    zIndex: 10,
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  orderMenuSection: {
    gap: 2,
  },
  orderMenuTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  orderMenuItem: {
    minHeight: 38,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  orderMenuItemActive: {
    backgroundColor: colors.surfaceHigh,
  },
  orderMenuItemLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  orderMenuItemText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textStrong,
  },
  orderMenuItemTextActive: {
    color: colors.textPrimary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // ── Workspace list: rows on paper, the hairline above the first ─────────
  listContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  // ── From others / Archived: a small-caps label over their own rows ───────
  archivedSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...textTokens.sectionTitle,
  },

  // ── Misc ──────────────────────────────────────────────────────────────────
  pressDown: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },

  // ── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
});
