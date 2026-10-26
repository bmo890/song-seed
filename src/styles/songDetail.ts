import { StyleSheet } from "react-native";
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
  songDetailNavCompactTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    color: "#1b1c1a",
  },
  songDetailCompactTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  songDetailTitleInputWrap: {
    marginHorizontal: 0,
    marginTop: 2,
  },
  songDetailPageTitleLarge: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 26,
    lineHeight: 32,
    color: "#1b1c1a",
  },
  songDetailTypeLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  songDetailTabScrollContent: {
    gap: 10,
    paddingBottom: 0,
  },
  songDetailTabPanelWrap: {
    gap: 10,
  },
  songDetailTabPanelCard: {
    width: "100%",
  },
  songDetailMiniCard: {
    minWidth: 0,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 0,
    minHeight: 88,
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
  songDetailMiniCardActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  songDetailClipSummarySection: {
    marginBottom: 4,
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
  // The primary take line (2026-10-15): play · name · "Primary take", on the
  // paper under the meta line. Transport rows never mirror (docs/design-system.md
  // "Direction policy"): the play glyph sits where time starts in every
  // language, so `row-reverse` under RTL rather than an explicit direction.
  // A playback row: ▶ on the left in every language, the words after it
  // following the language (playRowFrame / playRowRest at the call site).
  songDetailPrimaryLine: {
    flexDirection: "row",
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
  // The Notes tab is the page (2026-10-15): the words on the paper, tall
  // enough that a tap on the blank space below them still opens the editor.
  songNotesTabPage: {
    minHeight: 320,
    paddingTop: spacing.md,
  },
  songNotesTabText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    lineHeight: 25,
    color: colors.textPrimary,
  },
  songNotesTabPlaceholder: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    lineHeight: 25,
    color: colors.textMuted,
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

} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
