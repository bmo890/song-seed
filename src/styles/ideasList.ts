import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, shadows } from "../design/tokens";

// Ideas list rows, cards and list chrome.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const ideasListStyles = {
  ideasListItemWrap: {
    gap: 6,
  },
  ideasListCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    // Borderless shell (locked 2026-07-23): the resting card carries zero lines —
    // depth comes from the whisper shadow alone. Selected / now-playing states
    // deliberately re-add their borders below. The border is RESERVED (2px,
    // transparent) rather than absent, so turning it on can't resize the card
    // and nudge everything below it.
    borderWidth: 2,
    borderColor: "transparent",
    // Spacing rhythm (locked): 12 above the title, 10 under the meta row —
    // less the reserved border so the inner rhythm is unchanged.
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 9,
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
  // A sketch's stack of pages: two tonal edges under its card (2026-10-15).
  // The wrapper's bottom padding is the stack's whole extra height.
  ideasListStack: {
    paddingBottom: 10,
  },
  ideasListStackBack: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 0,
    height: 24,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    ...shadows.card,
  },
  ideasListStackMiddle: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 5,
    height: 24,
    borderRadius: 11,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  ideasListCardSounding: {
    // The card that is sounding — dock session or inline preview, one look
    // (2026-10-03). Colour and lift only: the shell already reserves the 2px
    // border, so states may never change its width or the card resizes
    // underneath the content.
    borderColor: colors.primaryOutline,
    ...shadows.cardActive,
  },
  ideasListCardSelected: {
    borderColor: "#B87D6B",
    backgroundColor: "#FDF5F2",
  },
  ideasListCardHighlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(184,125,107,0.22)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(184,125,107,0.55)",
  },
  ideasListCardRow: {
    // A clip card is a media surface: play control leads on the left, scrubber
    // runs left→right. Pinned LTR so the whole card never mirrors under a Hebrew
    // UI (the title keeps its own writing direction via UserText, aligned to the UI edge).
    direction: "ltr",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
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
  // Same fixed height as ideasListMetaRow: the bottom zone may never change
  // size between rest and play, or the card's centre — and the waveform's
  // alignment with the centred play glyph — drifts.
  ideaCardInlineControlRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 26,
  },
  // Meta-row right cluster: consistent 10pt gaps between caption-scale items.
  ideasListCardTrailing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexShrink: 0,
  },
  // Fixed to the same height as the meta row so the strip zone sits at the
  // card's exact vertical centre — which is where the lead play glyph is
  // centred. Without this the title row's height varies (serif lineHeight 21
  // vs auto 18) and the waveform drifts off the glyph's axis per card.
  ideasListCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
    minHeight: 26,
  },
  ideasListCardTitle: {
    flex: 1,
    // Title-row truncation law (locked 2026-07-27): the title takes the room and
    // ellipsizes FIRST, but never below this floor — past it the stage word gives
    // way instead (see `stageInk`.flexShrink). The row is single-line by
    // construction, so a title can never push a mark onto a second row.
    minWidth: 88,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 18,
    color: "#1C1C19",
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
  ideasListCreatedAtText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10,
    lineHeight: 12,
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  // Fixed-height bottom zone (set to the tallest occupant, the 26px soft key):
  // every state of every card bottoms out identically, so the play glyph —
  // centred on the whole card — always lines up with the waveform.
  ideasListMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 26,
  },
  // A clip's tags in the meta row (2026-10-03): quiet words in each tag's own
  // ink, no capsules — the same register as the date beside them.
  ideasListTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  ideasListTagWord: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.3,
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
  ideasListMetaText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 13,
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  ideasListMetaRightCluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    minHeight: 12,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
