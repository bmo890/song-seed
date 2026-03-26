import { StyleSheet } from "react-native";
import { colors, spacing, text as textTokens } from "../../design/tokens";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    paddingHorizontal: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...textTokens.sectionTitle,
    marginBottom: 2,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 24,
  },
  previewText: {
    flex: 1,
    ...textTokens.body,
    color: colors.textStrong,
  },
  helperText: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  warningText: {
    ...textTokens.supporting,
    color: "#b45309",
  },
  pressDown: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  toggleRow: {
    minHeight: 42,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  toggleLabel: {
    ...textTokens.caption,
    color: colors.textStrong,
  },
  collectionList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  newCollectionRow: {
    minHeight: 46,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  newCollectionCopy: {
    flex: 1,
    gap: 2,
  },
  newCollectionTitle: {
    ...textTokens.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  newCollectionMeta: {
    ...textTokens.supporting,
  },
});
