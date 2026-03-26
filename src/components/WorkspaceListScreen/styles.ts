import { StyleSheet } from "react-native";
import { colors, spacing, text as textTokens } from "../../design/tokens";

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
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: spacing.md,
    ...textTokens.supporting,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  listContent: {
    paddingVertical: 10,
    gap: spacing.sm,
  },
  orderMenuSection: {
    gap: spacing.sm,
  },
  orderMenuTitle: {
    ...textTokens.sectionTitle,
    color: colors.textSecondary,
  },
  orderMenuItem: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  orderMenuItemActive: {
    backgroundColor: "#eef2f6",
  },
  orderMenuItemLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  orderMenuItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.textStrong,
    fontWeight: "600",
  },
  orderMenuItemTextActive: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  pressDown: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  emptyText: {
    marginTop: 10,
    color: "#6b7280",
  },
});
