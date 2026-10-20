import { StyleSheet } from "react-native";
import { colors, spacing, text as textTokens } from "../../design/tokens";

/**
 * Import from Share is a task, so it reads as rows on paper (2026-10-20): a
 * quiet status line, the files that arrived, and the places they can go as
 * `ListRow`s. No cards: nothing here is the musician's work yet.
 */
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
    gap: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...textTokens.sectionTitle,
  },
  status: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 28,
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
  /** Skipped files: said in ink, not a warning colour (color is scarce). */
  skippedText: {
    ...textTokens.supporting,
    color: colors.textStrong,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  toggleGlyph: {
    width: 22,
    alignItems: "center",
  },
  toggleLabel: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  nested: {
    paddingStart: spacing.lg,
  },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
  },
  archiveName: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  archiveActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  archiveImport: {
    flex: 1,
  },
});
