import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Ideas list rows, cards and list chrome.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const ideasListStyles = {
  ideasListContentFloating: {
    paddingBottom: 178,
  },
  ideasListContentSelection: {
    paddingBottom: 168,
  },
  ideasListItemWrap: {
    gap: 6,
  },
  ideasListLeadHotzone: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 76,
    zIndex: 4,
  },
  ideasListLeadHotzoneCompact: {
    width: 70,
  },
  ideasListLeadHotzoneExpanded: {
    width: 76,
  },
  ideasListLeadHotzoneInline: {
    flexDirection: "column",
    width: 46,
  },
  ideasListLeadHotzoneTop: {
    flex: 1,
    width: "100%",
  },
  ideasListLeadHotzoneBottom: {
    flex: 1,
    width: "100%",
  },
  ideasListCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    // Borderless shell (locked 2026-07-23): the resting card carries zero lines —
    // depth comes from the whisper shadow alone. Selected / now-playing states
    // deliberately re-add their borders below.
    borderWidth: 0,
    // Spacing rhythm (locked): 12 above the title, 10 under the meta row.
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 11,
    position: "relative",
    shadowColor: "#3D3732",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    minHeight: 60,
  },
  ideasListCardCompact: {
    borderRadius: radii.lg,
    // paddingTop/Bottom (not paddingVertical) so these actually beat the base
    // card's specific paddingTop/paddingBottom in RN's style resolution.
    paddingTop: 5,
    paddingBottom: 5,
    paddingHorizontal: 9,
    minHeight: 0,
  },
  ideasListProjectCard: {
    borderLeftWidth: 3.5,
  },
  ideasListCardNowPlaying: {
    // Base shell is borderless now, so now-playing re-adds its own hairline.
    borderWidth: 1,
    borderColor: "rgba(184,125,107,0.4)",
  },
  ideasListCardSelected: {
    borderColor: "#B87D6B",
    borderWidth: 2,
    backgroundColor: "#FDF5F2",
  },
  // Crown: a rule across the card's top edge, following its 12px radius.
  // Reserved for the primary take — the LEFT spine belongs to the sketch tell
  // alone (design-system §card canon), so status never borrows that device.
  ideasListCardCrown: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    zIndex: 2,
  },
  ideasListCardCornerBadge: {
    position: "absolute",
    top: 7,
    right: 8,
    zIndex: 2,
    width: 20,
    height: 20,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  ideasListCardHighlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(184,125,107,0.22)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(184,125,107,0.55)",
  },
  ideasListExpandedStaticWrap: {
    flex: 1,
    justifyContent: "space-between",
  },
  ideasListExpandedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ideasListExpandedHeaderLead: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ideasListExpandedHeaderMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ideasListExpandedMetaGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  ideasListExpandedMetaRows: {
    gap: 2,
  },
  ideasListExpandedMetaGridRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ideasListExpandedMetaLeadSpacer: {
    width: 46,
    flexShrink: 0,
  },
  ideasListExpandedMetaLeftCol: {
    width: 46,
    minHeight: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ideasListExpandedMetaCenterCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  ideasListExpandedMetaRightCol: {
    width: 72,
    gap: 1,
    flexShrink: 0,
  },
  ideasListExpandedMetaRightIndicators: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  ideasListCardRow: {
    // A clip card is a media surface: play control leads on the left, scrubber
    // runs left→right. Pinned LTR so the whole card never mirrors under a Hebrew
    // UI (the title still aligns to its own script via UserText).
    direction: "ltr",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  ideasListLeadCol: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexShrink: 0,
    alignSelf: "stretch",
  },
  ideasListLeadColInlineActive: {
    justifyContent: "space-evenly",
  },
  ideasListCardMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    justifyContent: "space-between",
  },
  // Strip zone — FIXED geometry, identical at rest and while previewing so the
  // card never changes height or reflows when the inline player appears.
  // height 18 = the ✕ glyph box; the 14px strip centers inside it. With the
  // main column's gap 3 the visual rhythm is unchanged from the old margins:
  // 3 (gap) + 3 (marginTop) + 2 (zone slack) = 8 above the bars,
  // 2 (zone slack) + 2 (marginBottom) + 3 (gap) = 7 below.
  ideaCardStripZone: {
    height: 18,
    marginTop: 3,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ideaCardStripFlex: {
    flex: 1,
    minWidth: 0,
  },
  // Right slot permanently reserved for the ✕ (empty spacer at rest, the close
  // IconButton while previewing) so the strip's measured width — and the bar
  // pitch derived from it — never changes between states.
  ideaCardStripCloseSlot: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  // Compact inline control row while the strip is the live player: the elapsed
  // caption on the left — nothing else (✕ rides the strip row). minHeight 14
  // matches ideasListMetaRow so the meta line keeps one height in both states.
  ideaCardInlineControlRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 14,
  },
  ideasListCardMainCompact: {
    gap: 4,
  },
  ideasListCardBottomBlock: {
    gap: 1,
    minWidth: 0,
  },
  // Meta-row right cluster: consistent 10pt gaps between caption-scale items.
  ideasListCardTrailing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexShrink: 0,
  },
  ideasListCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  ideasListCardTitleRowExpanded: {
    alignItems: "flex-start",
  },
  ideasListTitleIconWrap: {
    width: 14,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ideasListCardTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 18,
    color: "#1C1C19",
  },
  ideasListCardTitleProject: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  // Earned serif (locked 2026-07-23): only *named* clips/sketches get Lora.
  ideasListCardTitleSerif: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  // Auto-named clips keep their timestamp title in quiet tabular Jakarta.
  ideasListCardTitleAuto: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  // Duration caption at the end of the title row (moved out of the lead column).
  ideasListTitleDurationText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11,
    lineHeight: 18,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  ideasListCardTitleCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  ideasListCardTitleHighlight: {
    // Warm amber — a quieter, on-brand search highlight (was cold #fde68a).
    backgroundColor: "#F0DFC0",
    color: "#1C1C19",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  // Search-match snippet (comfortable): sits in the strip zone in place of the
  // waveform. Field glyph + the matched line, italic and quiet.
  ideasCardSnippet: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  ideasCardSnippetText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12.5,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  ideasListCardMeta: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#84736f",
    },
  ideasListCreatedAtText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10,
    lineHeight: 12,
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  ideasListExpandedMetaStack: {
    gap: 1,
  },
  ideasListDateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  ideasListDateStack: {
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  ideasListMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 14,
  },
  ideasListMetaLeftCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  ideasListMetaToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ideasListMetaIconWrap: {
    width: 13,
    height: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  ideasListMetaDurationText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    lineHeight: 14,
    color: "#524440",
    fontVariant: ["tabular-nums"],
  },
  ideasListMetaDurationTextCompact: {
    fontSize: 12,
    lineHeight: 13,
  },
  ideasListMetaText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 13,
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  ideasListMetaRightCol: {
    width: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
  },
  ideasListMetaRightColInner: {
    width: "100%",
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 14,
  },
  ideasListMetaRightCluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    minHeight: 12,
  },
  ideasListMetaSizeText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  ideasListDateSizeCol: {
    width: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    minHeight: 28,
  },
  ideasListDateSizeText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10,
    lineHeight: 13,
    color: "#84736f",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  ideasListMetaSizeTextCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  ideasListMetaSeparator: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    lineHeight: 12,
    color: "#B8A8A3",
    },
  ideasListStatusBadgeText: {
    fontSize: 9,
    lineHeight: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 46,
    textAlign: "center",
  },
  ideasListProgressText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    lineHeight: 12,
    color: "#84736f",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  ideasListNowPlayingTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: "rgba(215,194,189,0.4)",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  ideasListNowPlayingFill: {
    height: "100%",
    backgroundColor: "#B87D6B",
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
