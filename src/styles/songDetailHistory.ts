import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Song detail history: versions, evolution timeline, threads.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const songDetailHistoryStyles = {
  songDetailTimelineControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  songDetailTimelineMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexWrap: "wrap",
  },
  songDetailTimelineMetricChip: {
    minHeight: 28,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  songDetailTimelineMetricChipActive: {
    backgroundColor: "#1b1c1a",
    borderColor: "#1b1c1a",
  },
  songDetailTimelineMetricChipText: {
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailTimelineMetricChipTextActive: {
    color: "#ffffff",
  },
  songDetailTimelineDirectionChip: {
    minHeight: 28,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  songDetailTimelineDirectionText: {
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailTimelineDividerWrap: {
    paddingTop: 2,
    paddingBottom: 4,
  },
  songDetailVersionCard: {
    borderRadius: 12,
    borderColor: "rgba(215,194,189,0.3)",
    shadowOpacity: 0,
    elevation: 0,
    paddingVertical: 7,
    paddingHorizontal: 11,
    gap: 0,
  },
  songDetailVersionCardCompact: {
    borderRadius: radii.lg,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  songDetailVersionCardParentTarget: {
    borderColor: "#B87D6B",
    backgroundColor: "rgba(184,125,107,0.08)",
  },
  songDetailVersionCardParentTargetDisabled: {
    opacity: 0.48,
  },
  songDetailVersionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  songDetailVersionLead: {
    width: 46,
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    flexShrink: 0,
  },
  songDetailVersionLeadInlineActive: {
    justifyContent: "center",
  },
  songDetailVersionLeadDurationSlot: {
    width: "100%",
    minHeight: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  songDetailVersionLeadDurationText: {
    fontSize: 12,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  songDetailVersionMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    justifyContent: "space-between",
  },
  songDetailVersionTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  songDetailVersionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  songDetailVersionRepliesToggle: {
    minHeight: 22,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#F4F1ED",
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  songDetailVersionRepliesToggleText: {
    fontSize: 10,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailVersionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    lineHeight: 17,
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  songDetailVersionTrailing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    minHeight: 24,
  },
  songDetailVersionSetPrimaryBtn: {
    minHeight: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#F4F1ED",
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  songDetailVersionSetPrimaryText: {
    fontSize: 10,
    color: "#524440",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  // "New version" — labeled soft key (mic + words); the affordance says what it
  // does instead of miming the record FAB.
  songDetailVersionReplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: radii.lg,
    backgroundColor: "#F3E4DE",
  },
  songDetailVersionReplyText: {
    fontSize: 10.5,
    color: colors.primaryDeep,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  songDetailVersionReplyBtnCompact: {
    width: 24,
    height: 24,
    paddingHorizontal: 0,
    borderRadius: 12,
  },
  songDetailVersionHistoryBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  songDetailVersionMeta: {
    fontSize: 10,
    lineHeight: 13,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  songDetailVersionNotes: {
    fontSize: 12,
    lineHeight: 17,
    color: "#84736f",
  },
  songDetailEvolutionGuideWrap: {
    position: "relative",
    width: 42,
    flexShrink: 0,
    alignSelf: "stretch",
  },
  // Continuous vertical thread line (Reddit-style spine). Negative top/bottom
  // bridge the FlatList row gap so the line reads as one unbroken thread.
  songDetailThreadSpine: {
    position: "absolute",
    left: 25,
    top: -5,
    bottom: -5,
    width: 1.5,
    backgroundColor: "#D7C2BD",
  },
  // Curved branch (╰) that peels off the spine and curls into each reply card.
  songDetailThreadCurve: {
    position: "absolute",
    left: 25,
    top: -5,
    width: 13,
    height: 28,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#D7C2BD",
    borderBottomLeftRadius: 10,
  },
  songDetailEvolutionStem: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    left: 9,
    backgroundColor: "#D7C2BD",
  },
  songDetailEvolutionStemStart: {
    top: "50%",
  },
  songDetailEvolutionStemEnd: {
    height: 22,
  },
  songDetailEvolutionElbow: {
    position: "absolute",
    top: 22,
    width: 14,
    height: 1,
    left: 9,
    backgroundColor: "#D7C2BD",
  },
  songDetailEvolutionDot: {
    position: "absolute",
    right: -3,
    top: -2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#C4AFA9",
  },
  songDetailEvolutionMoreGuide: {
    width: 42,
    alignSelf: "stretch",
    position: "relative",
    flexShrink: 0,
  },
  songDetailEvolutionMoreStem: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    left: 25,
    backgroundColor: "#D7C2BD",
  },
  songDetailEvolutionExpandRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  songDetailEvolutionExpandText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#84736f",
  },
  // ── Stemmed thread (Evolution v2) ─────────────────────────────────────────
  // One tinted shell per multi-version lineage: head card on top, history stem
  // below, the thread's "New version" action in the footer.
  songDetailThreadShell: {
    backgroundColor: "rgba(232,228,223,0.42)",
    borderRadius: 14,
    padding: 6,
  },
  songDetailStem: {
    position: "relative",
    marginTop: 2,
    marginHorizontal: 6,
    paddingTop: 10,
    paddingLeft: 22,
  },
  // The stem is drawn per row, never as one span: each row carries a segment
  // into its node, and only a row with history below it continues past. That
  // way the line always TERMINATES at the last node instead of running on to
  // the container's floor (which overshot whenever a row grew, e.g. with a note).
  // Node centre sits 13.5 below the row top (node top 9 + half of 9);
  // x = -13.75 centres the 1.5px line on the 9px node.
  songDetailStemSegmentIn: {
    position: "absolute",
    left: -13.75,
    width: 1.5,
    backgroundColor: "rgba(184,125,107,0.35)",
  },
  songDetailStemSegmentOn: {
    position: "absolute",
    left: -13.75,
    top: 13.5,
    bottom: 0,
    width: 1.5,
    backgroundColor: "rgba(184,125,107,0.35)",
  },
  songDetailStemRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingVertical: 5,
    paddingRight: 4,
    borderRadius: 8,
  },
  // Transport sits before the copy and owns its own hit area, so it keeps
  // working in selection mode (audition a candidate before committing).
  songDetailStemPlay: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  songDetailStemScrubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  songDetailStemScrubTrack: {
    flex: 1,
  },
  songDetailStemCheck: {
    width: 16,
    height: 16,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  songDetailStemCheckOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  songDetailStemRowSelected: {
    backgroundColor: "rgba(184,125,107,0.10)",
  },
  // Hollow node centred on the stem line (line x = 9 within .songDetailStem;
  // row content starts at paddingLeft 22, so the node backs up into the gutter).
  songDetailStemNode: {
    position: "absolute",
    left: -17.5,
    top: 9,
    width: 9,
    height: 9,
    borderRadius: radii.round,
    backgroundColor: "#FDFBF7",
    borderWidth: 2,
    borderColor: "rgba(184,125,107,0.6)",
  },
  songDetailStemNodeActive: {
    backgroundColor: "#B87D6B",
    borderColor: "#B87D6B",
  },
  songDetailStemRowBody: {
    flex: 1,
    minWidth: 0,
  },
  songDetailStemRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  songDetailStemVn: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    color: "#A89994",
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
  },
  songDetailStemWhen: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11.5,
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  songDetailStemDur: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#A89994",
    fontVariant: ["tabular-nums"],
  },
  songDetailStemFoldText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#84736f",
  },
  songDetailStemHideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
  },
  // Thread footer: the one forward action, labeled in words.
  songDetailThreadFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(215,194,189,0.4)",
  },
  songDetailThreadFootText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11.5,
    color: colors.primaryDeep,
  },
  songDetailEvolutionGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 2,
  },
  songDetailEvolutionGroupContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 24,
    // Sharp corners + tonal layering instead of a bubbly 12px radius + 1px border.
    borderRadius: 6,
    backgroundColor: "#EDE9E4",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  songDetailEvolutionGroupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  songDetailEvolutionGroupTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: "#524440",
  },
  songDetailEvolutionGroupMeta: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11,
    color: "#a89994",
    fontVariant: ["tabular-nums"],
  },
  songDetailEvolutionGroupMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  songDetailEvolutionGroupCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  songDetailEvolutionCollapseAllRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 4,
  },
  songDetailEvolutionCollapseAllButton: {
    // Quiet contextual text action — no bordered/filled pill.
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  songDetailEvolutionCollapseAllText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#84736f",
  },
  songDetailEvolutionExpandSep: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: "#c4b5b0",
  },
  songDetailEvolutionHistoryLink: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: "#a89994",
  },
  // Legacy — kept to avoid TS errors until cleanup
  songDetailEvolutionMoreButtonWrap: {
    alignSelf: "stretch",
    justifyContent: "center",
  },
  songDetailEvolutionMoreButton: {
    minHeight: 26,
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#FDFBF7",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  songDetailEvolutionMoreButtonText: {
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
