import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";

/** Fixed body height so the sheet never resizes as content changes. The sheet
 * deliberately does NOT avoid the keyboard: it stays put and the keyboard
 * overlays the results; the search/theme/mode controls at the top stay
 * visible and results reappear when the keyboard is dismissed. */
const SHEET_BODY_HEIGHT = 440;

export const finderStyles = StyleSheet.create({
  body: {
    height: SHEET_BODY_HEIGHT,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  themeLine: {
    height: 32,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  themeScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  themeAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingRight: spacing.sm,
  },
  themeAddText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textMuted,
  },
  themePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  themePillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.onPrimary,
  },
  themePlusBtn: {
    width: 24,
    height: 24,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  themeInput: {
    minWidth: 90,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  themeAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  themeAddBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.onPrimary,
  },
  toolBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  toolBarText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
  },
  toolGroup: {
    marginBottom: spacing.md,
  },
  toolGroupTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
  },
  toolRowText: {
    flex: 1,
    gap: 1,
  },
  toolRowLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  toolRowDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  resultsArea: {
    flex: 1,
    marginTop: spacing.md,
  },
  stateCenter: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  stateText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
    textAlign: "center",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  syllableGroup: {
    marginBottom: spacing.xs,
  },
  syllableLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
  },
  moreChip: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderStyle: "dashed",
  },
  moreChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  hintRow: {
    height: 18,
    justifyContent: "center",
  },
  hint: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textAlign: "center",
  },
  // ── Definition preview (takes over the body) ──────────────────────────────
  previewFill: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  previewWord: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 26,
    color: colors.textPrimary,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBody: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  previewMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  previewDefs: {
    gap: spacing.md,
  },
  previewDefRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  previewPos: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.primary,
    textTransform: "uppercase",
    paddingTop: 2,
    minWidth: 52,
  },
  previewDefText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  previewActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  previewActionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.round,
    paddingVertical: 11,
    backgroundColor: colors.surfaceHigh,
  },
  previewActionSecondaryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  previewActionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.round,
    paddingVertical: 11,
    backgroundColor: colors.primary,
  },
  previewActionPrimaryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.onPrimary,
  },
});
