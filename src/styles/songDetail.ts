import { I18nManager, StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../design/tokens";

// Song detail screen: header, nav, breadcrumbs, tabs, summary, meta, notes.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const songDetailStyles = {
  songDetailHeader: {
    marginTop: 2,
    marginBottom: 10,
  },
  songDetailNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // Trailing cluster on the nav row: workspace mark (side menu) + overflow.
  songDetailNavTrail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  songDetailNavLead: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // WHERE · WHAT label riding in the back button ("‹ IDEAS · SKETCH").
  songDetailNavEyebrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  songDetailNavEyebrow: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
    color: colors.eyebrow,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  // The compact title shares the eyebrow's slot and crossfades in over it.
  songDetailNavSlotOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  songDetailMetaLine: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  songDetailInlineBreadcrumbs: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
    flexWrap: "nowrap",
  },
  songDetailNavCompactTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    color: "#1b1c1a",
  },
  songDetailNavCompactTypeLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    lineHeight: 20,
    color: "#a89994",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  songDetailCompactTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailBreadcrumbWrap: {
    flex: 1,
    minWidth: 0,
  },
  songDetailBreadcrumbScrollContent: {
    alignItems: "center",
    gap: 4,
    paddingRight: 8,
  },
  songDetailBreadcrumbChunk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  songDetailBreadcrumbTextHitbox: {
    minHeight: 18,
    justifyContent: "center",
  },
  songDetailBreadcrumbSeparator: {
    fontSize: 12,
    lineHeight: 14,
    color: "#B8A8A3",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  songDetailBreadcrumbText: {
    fontSize: 12,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  songDetailBreadcrumbTextActive: {
    color: "#524440",
  },
  songDetailBreadcrumbEllipsis: {
    fontSize: 12,
    lineHeight: 14,
    color: "#B8A8A3",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  songDetailNavEditActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailNavTextAction: {
    minHeight: 30,
    borderRadius: radii.round,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
  },
  songDetailNavTextActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  songDetailNavTextActionText: {
    fontSize: 12,
    color: "#524440",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailNavTextActionPrimaryText: {
    fontSize: 12,
    color: "#ffffff",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailTitleBlock: {
    marginTop: 4,
    gap: 3,
  },
  songDetailTitleBlockHidden: {
    display: "none",
  },
  songDetailHeaderModeLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  songDetailTitleInputWrap: {
    marginHorizontal: 0,
    marginTop: 2,
  },
  songDetailTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 2,
  },
  songDetailTitleLead: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  songDetailPageTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1C1C19",
  },
  songDetailPageTitleLarge: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 26,
    lineHeight: 32,
    color: "#1b1c1a",
  },
  songDetailPageTitleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  songDetailTypeLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  songDetailTypeEyebrow: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    lineHeight: 14,
    color: "#a89994",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  songDetailBreadcrumbLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
    marginBottom: 4,
    overflow: "hidden",
  },
  songDetailHeaderEditActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailHeaderActionBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  songDetailDangerMenuText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailTopStack: {
    gap: 8,
    marginBottom: 6,
  },
  songDetailProgressStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
    marginBottom: 14,
  },
  // Stage shown as editorial ink (dot + word in stage hue), not a chip —
  // matches the collection filter's ink language.
  songDetailStageInk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailStageInkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  songDetailSongTabs: {
    marginTop: -2,
    marginBottom: 4,
  },
  songDetailTabScroll: {
    flex: 1,
  },
  songDetailTabScrollContent: {
    gap: 10,
    paddingBottom: 0,
  },
  songDetailTabPanelWrap: {
    gap: 10,
  },
  // A tab's one quiet way onward (the Lyrics tab's "Write with the tape"), set
  // on the title's start x and kept clear of the panel beneath.
  songDetailTabLinkRow: {
    flexDirection: "row",
    paddingHorizontal: 2,
    marginBottom: -4,
  },
  songDetailTabPanelCard: {
    width: "100%",
  },
  songDetailMetaTabStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  songDetailMetaTab: {
    minHeight: 28,
    borderRadius: radii.xl,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  songDetailMetaTabActive: {
    backgroundColor: "#1C1C19",
  },
  songDetailMetaTabText: {
    fontSize: 11,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailMetaTabTextActive: {
    color: "#FDFBF7",
  },
  songDetailMetaPanel: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  songDetailMetaPanelBody: {
    gap: 6,
  },
  songDetailMetaCompactStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  songDetailMetaStageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailMetaValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailMetaLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  songDetailMetaFieldLabel: {
    fontSize: 11,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  songDetailMetaFieldHint: {
    fontSize: 11,
    color: "#B8A8A3",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  songDetailMetaValue: {
    fontSize: 16,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailMetaValueCompact: {
    fontSize: 15,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
    fontVariant: ["tabular-nums"],
  },
  songDetailMetaSliderWrap: {
    gap: 2,
  },
  songDetailMetaPreview: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#524440",
  },
  songDetailMetaPreviewMuted: {
    color: "#84736f",
  },
  songDetailMetaActionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  songDetailMetaActionChip: {
    minHeight: 26,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#F4F1ED",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  songDetailMetaActionChipText: {
    fontSize: 10,
    color: "#524440",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailSummaryCard: {
    gap: 8,
    paddingVertical: 12,
  },
  songDetailSummaryCardCompact: {
    gap: 6,
    paddingVertical: 10,
  },
  songDetailSummaryStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  songDetailSummaryProgressCell: {
    flex: 0.9,
    minWidth: 0,
  },
  songDetailSummaryActionsStack: {
    flex: 1.1,
    minWidth: 0,
    gap: 8,
  },
  songDetailSummaryProgressCard: {
    minHeight: 84,
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  songDetailSummaryActionCard: {
    minHeight: 0,
    paddingVertical: 10,
    gap: 4,
  },
  songDetailSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  songDetailSummaryTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailStatusSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  songDetailStatusPercent: {
    fontSize: 16,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailStatusPercentCompact: {
    fontSize: 18,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
    lineHeight: 22,
  },
  songDetailStatusBadgeLarge: {
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  songDetailEditorCard: {
    gap: 10,
    paddingVertical: 12,
  },
  songDetailNotesEditorCard: {
    flex: 1,
  },
  songDetailWritingRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  songDetailWritingCell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  songDetailWritingRowStacked: {
    flexDirection: "column",
  },
  songDetailMiniCard: {
    minWidth: 0,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 0,
    minHeight: 88,
  },
  songDetailMiniCardStandalone: {
    width: "100%",
    minHeight: 0,
  },
  songDetailMiniCardRow: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  songDetailMiniCardStacked: {
    flex: 0,
    width: "100%",
  },
  songDetailMiniCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  songDetailMiniCardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  songDetailMiniCardTitle: {
    fontSize: 13,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailMiniCardMetaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  songDetailMiniCardActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  songDetailMiniCardMetaText: {
    fontSize: 10,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  songDetailMiniCardBody: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#84736f",
  },
  songDetailMiniCardActionText: {
    fontSize: 10,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  songDetailSummaryLinkCard: {
    minHeight: 60,
    paddingVertical: 10,
    gap: 4,
    justifyContent: "center",
  },
  songDetailSummaryLinkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  songDetailSummaryLinkLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  songDetailSummaryLinkTitle: {
    fontSize: 13,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailSummaryLinkMetaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  songDetailSummaryLinkMetaText: {
    fontSize: 10,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  songDetailSummaryLinkBody: {
    fontSize: 11.5,
    lineHeight: 15,
    color: "#84736f",
  },
  songDetailMiniCardButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  songDetailMiniCardButton: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
  },
  songDetailMiniCardButtonText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailLyricsCard: {
    borderColor: "rgba(215,194,189,0.3)",
    backgroundColor: "#FDFBF7",
    minHeight: 0,
  },
  songDetailSectionEyebrow: {
    fontSize: 11,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  songDetailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  songDetailSectionHeaderCopy: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    minWidth: 0,
  },
  songDetailSectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: "#a89994",
    textTransform: "uppercase" as "uppercase",
    letterSpacing: 0.8,
  },
  songDetailSectionMeta: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: "#a89994",
    fontVariant: ["tabular-nums"],
  },
  songDetailClipListHeader: {
    gap: 10,
  },
  songDetailClipSummarySection: {
    marginBottom: 4,
  },
  songDetailClipSection: {
    gap: 8,
  },
  songDetailStickyIdeasHeader: {
    // Pinned toolbar: opaque page tone so content scrolls cleanly beneath it,
    // separated by a single 0.5pt technical line rather than a filled band + shadow.
    backgroundColor: "#FDFBF7",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E4DF",
    overflow: "visible" as const,
    zIndex: 120,
  },
  songDetailPrimaryDivider: {
    height: 1,
    backgroundColor: "#E8E4DF",
    marginTop: 12,
    marginBottom: 2,
  },
  songDetailListWithStrip: {
    flex: 1,
  },
  // The primary take line (2026-10-15): play · name · "Primary take", on the
  // paper under the meta line. Transport rows never mirror (docs/design-system.md
  // "Direction policy"): the play glyph sits where time starts in every
  // language, so `row-reverse` under RTL rather than an explicit direction.
  songDetailPrimaryLine: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 34,
    marginTop: -2,
    marginBottom: spacing.sm,
  },
  // The glyph's box backs into the gutter so the triangle lines up with the title.
  songDetailPrimaryLinePlay: {
    width: 28,
    height: 28,
    marginStart: -7,
    alignItems: "center",
    justifyContent: "center",
  },
  songDetailPrimaryLineName: {
    flexShrink: 1,
    minWidth: 0,
  },
  // A name earns Lora; a filename or timestamp stays tabular Jakarta.
  songDetailPrimaryLineTitleSerif: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    color: colors.textStrong,
  },
  songDetailPrimaryLineTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  songDetailPrimaryLineLabel: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textMuted,
    flexShrink: 0,
  },
  // Primary ink: dot + word share ONE colour with the card's crown rule, so the
  // status reads as a single mark. primaryDeep (not primary) — a 9.5px label
  // needs the contrast, and the crown wears the same value.
  songDetailPrimaryInk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  songDetailPrimaryInkDot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
    backgroundColor: colors.primaryDeep,
  },
  songDetailPrimaryInkText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.primaryDeep,
  },
  songDetailClipPrimaryLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#a89994",
  },
  songDetailRecordBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.round,
  },
  songDetailClipRowWrap: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  songDetailClipList: {
    flex: 1,
  },
  songDetailClipListContent: {
    paddingTop: 0,
    paddingBottom: 0,
    gap: 7,
  },
  songDetailParentPickCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingRight: 12,
  },
  songDetailParentPickHelper: {
    fontSize: 12,
    lineHeight: 16,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  songDetailParentPickMeta: {
    fontSize: 11,
    lineHeight: 15,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  songDetailParentPickInlineHint: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7C2BD",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  songDetailParentPickInlineTitle: {
    fontSize: 12,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailParentPickInlineText: {
    fontSize: 11,
    lineHeight: 15,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // -- Song Notes Tab --
  songNotesTabEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  songNotesTabEmptyTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#84736f",
  },
  songNotesTabEmptySubtitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#B8A8A3",
  },
  songNotesTabBody: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#524440",
  },
  songNotesTabEditorInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#FDFBF7",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 280,
    textAlignVertical: "top",
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#1C1C19",
    marginBottom: 6,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
