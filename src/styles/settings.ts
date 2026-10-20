import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "../design/tokens";

// Settings screen: sections, accordions, toggles, storage, scopes.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const settingsStyles = {
  settingsScrollContent: {
    paddingBottom: 24,
    gap: 18,
  },
  settingsActionCard: {
    marginTop: 4,
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsActionCardCopy: {
    flex: 1,
    gap: 4,
  },
  settingsActionCardTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  settingsActionCardMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  settingsSection: {
    gap: 10,
  },
  settingsAccordionShell: {
    gap: 0,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  settingsAccordionShellOpen: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.page,
  },
  settingsAccordionHeader: {
    minHeight: 68,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsAccordionHeaderOpen: {
    backgroundColor: "transparent",
  },
  settingsAccordionCopy: {
    flex: 1,
    gap: 2,
  },
  settingsAccordionTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  settingsAccordionHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  settingsAccordionBody: {
    gap: 10,
    marginTop: 0,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: "transparent",
  },
  settingsSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  settingsSectionLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  settingsSectionMeta: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  settingsSectionHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  settingsOptionStack: {
    gap: 0,
  },
  // Rows on paper (2026-10-20): a choice, a toggle or a scope row is a line of
  // ink over a hairline, never a filled or bordered box. Selection is said by
  // the row's own mark (a radio, a switch, an ink dot), not by a wash.
  settingsChoiceRow: {
    minHeight: 56,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  settingsChoiceRowSelected: {},
  // Inside a SettingsGroup: the group pulls 14 pt outward and draws the
  // dividers, so a flat row pads back in and drops its own hairline.
  settingsRowFlat: {
    paddingHorizontal: 14,
    borderBottomWidth: 0,
  },
  settingsRowFlatSelected: {},
  settingsChoiceCopy: {
    flex: 1,
    gap: 2,
  },
  settingsChoiceTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  settingsChoiceMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  settingsScopeStack: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  settingsScopeGroup: {},
  settingsWorkspaceRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  settingsWorkspaceSelectZone: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsWorkspaceExpandBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsScopeChildren: {
    paddingStart: spacing.lg,
  },
  settingsScopeRow: {
    minHeight: 52,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  settingsScopeRowNested: {
    paddingStart: spacing.lg,
  },
  settingsScopeRowDisabled: {
    opacity: 0.78,
  },
  settingsScopeCopy: {
    flex: 1,
    gap: 2,
  },
  settingsScopeTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  settingsScopeMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  settingsToggleRow: {
    minHeight: 56,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  settingsSummaryPanel: {
    gap: 12,
  },
  /** A fact on paper (an archive's name, what it holds): two lines over a hairline. */
  settingsFactRow: {
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  settingsFoldRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  settingsSummaryTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  settingsSummaryMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  settingsStoragePrimaryValue: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  settingsStorageMetricRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsStorageMetricCopy: {
    flex: 1,
    gap: 2,
  },
  settingsStorageMetricValue: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  settingsStoragePathRow: {
    gap: 4,
  },
  settingsStoragePathValue: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  settingsStorageNote: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  settingsActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  settingsPrimaryAction: {
    minWidth: 148,
  },
  settingsBusyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsBusyText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
