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
  // "New version" on a single-take card: a bare ink "+" in the footer's
  // trailing slot (the thread's labeled action lives on the stem row).
  songDetailVersionReplyBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
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
  // One slim tinted shell per multi-version lineage: head card on top, then the
  // stem — older versions (when unfolded) ending in ONE 40pt row that names the
  // history and carries the thread's "New version" action.
  songDetailThreadShell: {
    backgroundColor: "rgba(232,228,223,0.42)",
    borderRadius: 14,
    padding: 4,
  },
  // Indented so the stem sits INSIDE the head card's edge rather than flush
  // with it — history reads as hanging off the card, not as a second column.
  songDetailStem: {
    position: "relative",
    marginHorizontal: 6,
    paddingTop: 4,
    paddingLeft: 34,
  },
  // The stem is drawn per row, never as one span: each row carries a segment
  // into its node, and only a row with history below it continues past. That
  // way the line always TERMINATES at the last node instead of running on to
  // the container's floor (which overshot whenever a row grew, e.g. with a note).
  // Rows are 40pt: node centre sits 20 below the row top (padding 11 + half
  // of the 18pt first line); x = -14.75 centres the 1.5px line on the 9px node.
  songDetailStemSegmentIn: {
    position: "absolute",
    left: -14.75,
    width: 1.5,
    backgroundColor: "rgba(184,125,107,0.35)",
  },
  songDetailStemSegmentOn: {
    position: "absolute",
    left: -14.75,
    top: 20,
    bottom: -1.5,
    width: 1.5,
    backgroundColor: "rgba(184,125,107,0.35)",
  },
  // Transparent border at rest so selection never changes the row's size —
  // the selected tell is the card's own language (tint + terracotta border),
  // not a checkbox no other surface uses.
  songDetailStemRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    minHeight: 40,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  // "View in context" flash — the row's own selected language (wash + terracotta
  // edge), faded in and out by the same Animated.Value the head card reads.
  songDetailStemRowHighlight: {
    position: "absolute",
    top: -1.5,
    bottom: -1.5,
    left: -1.5,
    right: -1.5,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  // Transport sits before the copy and owns its own hit area, so it keeps
  // working in selection mode (audition a candidate before committing).
  songDetailStemPlay: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
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
  songDetailStemRowSelected: {
    borderColor: "#B87D6B",
    backgroundColor: "#FDF5F2",
  },
  // Hollow node centred on the stem line (line x = 9 within .songDetailStem;
  // row content starts at paddingLeft 22, so the node backs up into the gutter).
  songDetailStemNode: {
    position: "absolute",
    left: -18.5,
    top: 15.5,
    width: 9,
    height: 9,
    borderRadius: radii.round,
    backgroundColor: "#FDFBF7",
    borderWidth: 2,
    borderColor: "rgba(184,125,107,0.6)",
  },
  // The fold hinge: a chevron centred on the stem line where a node would sit,
  // so the toggle row is read as a hinge in the line, never as a version.
  songDetailStemHinge: {
    position: "absolute",
    left: 3,
    top: 9,
    width: 22,
    height: 22,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 18,
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
  // The stem's one row (40pt): terminal node + "vN · k older versions" toggle
  // on the left, the thread's forward action on the right. Same horizontal
  // geometry as a version row so the node lands on the same line.
  songDetailStemFoot: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  // Reaches back into the stem gutter so the round key is inside the press target.
  songDetailStemFootToggle: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginStart: -34,
    paddingStart: 34,
  },
  songDetailStemFootAction: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 6,
    paddingLeft: 12,
  },
  songDetailStemFootActionText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11.5,
    color: colors.primaryDeep,
  },
  songDetailEvolutionGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 2,
  },
  // A group is a QUIET SECTION LABEL, not a surface. The old filled bar made a
  // third tonal layer (page → group bar → thread shell → card) and read as
  // another card; an editorial label separates without adding weight.
  songDetailEvolutionGroupContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 24,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  songDetailEvolutionGroupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  songDetailEvolutionGroupTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#a89994",
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
