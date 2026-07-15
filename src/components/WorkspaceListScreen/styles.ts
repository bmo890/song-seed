import { StyleSheet } from "react-native";
import { colors, radii } from "../../design/tokens";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    paddingHorizontal: 24,
  },
  flexFill: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 128,
    gap: 0,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingTop: 32,
    paddingBottom: 0,
    gap: 0,
    marginBottom: 32,
  },
  hamburgerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
    marginBottom: 8,
  },
  eyebrow: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
    color: "#526351",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  pageTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 48,
    lineHeight: 58,
    color: "#1C1C19",
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
    borderRadius: 999,
  },
  sortPillActive: {
    backgroundColor: colors.surfaceHigh,
  },
  sortPillText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
  sortPillTextActive: {
    color: colors.textPrimary,
  },
  sortMenu: {
    position: "absolute",
    right: 0,
    top: 4,
    backgroundColor: colors.surface,
    borderRadius: 6,
    padding: 8,
    minWidth: 180,
    zIndex: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
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

  // ── Workspace list ────────────────────────────────────────────────────────
  listContent: {
    gap: 16,
  },
  emptyText: {
    marginTop: 32,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // ── Archived section ──────────────────────────────────────────────────────
  archivedSection: {
    marginTop: 64,
    borderTopWidth: 1,
    borderTopColor: "rgba(215, 194, 189, 0.3)",
    paddingTop: 48,
    gap: 24,
  },
  archivedSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  archivedHeading: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 30,
    lineHeight: 36,
    color: colors.textSecondary,
  },
  archivedDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(215, 194, 189, 0.2)",
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
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
});
