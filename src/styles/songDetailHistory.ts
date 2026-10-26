import { I18nManager } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Song detail history: versions, evolution timeline, threads.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const songDetailHistoryStyles = {
  songDetailTimelineDividerWrap: {
    paddingTop: 2,
    paddingBottom: 4,
  },
  // "Moving" on the take being given a parent: quiet caps, not a badge.
  songDetailParentSourceTag: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  songDetailVersionCardParentSource: {
    opacity: 0.45,
  },
  songDetailVersionCardParentTargetDisabled: {
    opacity: 0.35,
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
  // The card's ink keys ("+ Version", "2 older ⌄"): glyph + word, no fill,
  // on the footer's trailing edge.
  songDetailCardKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    minHeight: 26,
  },
  songDetailCardKeyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
  },
  songDetailVersionHistoryBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
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
  // Indented so the stem sits INSIDE the head card's edge rather than flush
  // with it — history reads as hanging off the card, not as a second column.
  songDetailStem: {
    position: "relative",
    marginHorizontal: 6,
    paddingTop: 4,
    // Physical: the stem and its nodes are drawn at physical left offsets, and a
    // take row is a playback row ([▶ … ] left to right, like every clip card).
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
    // A take is a playback row: ▶ on the left in every language (founder,
    // 2026-10-26). The words inside follow the language (songDetailStemRowBody).
    direction: "ltr",
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
  // elapsed · scrub line · total · ✕: a timeline, left to right in every language.
  songDetailStemScrubRow: {
    direction: "ltr",
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
  songDetailStemNodeActive: {
    backgroundColor: "#B87D6B",
    borderColor: "#B87D6B",
  },
  songDetailStemRowBody: {
    direction: I18nManager.isRTL ? "rtl" : "ltr",
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
  songDetailEvolutionGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 2,
  },
  // A group is a heading on the paper, not a surface: the name in Lora (a
  // name you typed earns the serif), the count quiet beside it.
  songDetailEvolutionGroupContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    minHeight: 32,
    paddingVertical: 4,
  },
  songDetailEvolutionGroupChevron: {
    alignSelf: "center",
  },
  songDetailEvolutionGroupTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  songDetailEvolutionGroupMeta: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  songDetailEvolutionCollapseAllRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 2,
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
    fontSize: 12,
    color: colors.textSecondary,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
