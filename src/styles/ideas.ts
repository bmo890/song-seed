import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, shadows } from "../design/tokens";

// Ideas screen: header, sorting, filters, stage, utility bar, dense rows.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const ideasStyles = {
  ideasToolbar: {
    marginBottom: 10,
    gap: 10,
    position: "relative",
    zIndex: 30,
  },
  ideasToolbarBackdrop: {
    position: "absolute",
    top: -420,
    bottom: -2400,
    left: -24,
    right: -24,
    zIndex: 20,
  },
  // One quiet toolbar line: search (stretch) then bare filter/sort glyphs.
  ideasUtilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ideasUtilityRowLead: {
    flex: 1,
    minWidth: 0,
  },
  ideasUtilityRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  // Shared popover menu card (filter/sort glyph menus, header overflow menus):
  // white surface, hairline border, shadows.card lifted slightly (≤ 0.10).
  ideasSortMenu: {
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
    shadowColor: "#3D3732",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  // Toolbar popovers hold PopoverMenu parts, which carry their own inset.
  ideasPopoverMenu: {
    position: "absolute",
    top: 44,
    alignSelf: "flex-start",
    minWidth: 260,
    maxWidth: 300,
    zIndex: 30,
    paddingHorizontal: 0,
    gap: 0,
  },
  // Filter/sort popovers hang from the toolbar's trailing edge (the glyphs
  // live at the end of the search row).
  ideasPopoverMenuEnd: {
    right: 0,
  },
  ideasStageChipsScroll: {
    maxHeight: 168,
  },
  ideasStageInk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  ideasStageInkDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
  },
  ideasStageInkText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.textSecondary,
  },
  ideasStageInkTextActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  // On-brand toggle: warm-neutral track when off, terracotta when on, paper
  // thumb — no cold near-black.
  ideasSwitch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderMuted,
    padding: 2,
    justifyContent: "center",
  },
  ideasSwitchActive: {
    backgroundColor: colors.primary,
  },
  ideasSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
  },
  ideasSwitchThumbActive: {
    alignSelf: "flex-end",
  },
  ideasHeaderMenuBtnPlaceholder: {
    width: 32,
    height: 32,
  },
  ideasHeaderMenuLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 10,
  },
  ideasHeaderMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  // Floats clear of the top-right corner: dropped below the nav row (top 54)
  // and inset from the edge (right 12). Wide enough that dev/import rows stay
  // single-line.
  // The "…" popovers hold PopoverMenuRows, which carry their own inset.
  ideasHeaderOverflowMenu: {
    position: "absolute",
    top: 54,
    right: 12,
    minWidth: 230,
    maxWidth: 280,
    zIndex: 2,
    paddingHorizontal: 0,
    gap: 0,
  },
  // Date group marker: quiet caps label with air above (16) and 8 below in
  // total (marginBottom 2 + the item wrap's gap 6).
  ideasDayDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 1,
    marginTop: 16,
    marginBottom: 2,
  },
  ideasDayDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(215,194,189,0.35)",
  },
  ideasDayDividerText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  // Count pill on a collapsed-day marker, e.g. "23 hidden".
  ideasCollapsedDayCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.round,
    backgroundColor: colors.primarySurface,
  },
  ideasCollapsedDayCountText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.primaryDeep,
    letterSpacing: 0.4,
  },
  ideasStickyDayWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 25,
  },
  // Borderless tonal chip — reads as a floating label, not a control.
  ideasStickyDayChip: {
    backgroundColor: "#F4F1ED",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  ideasStickyDayChipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: "#84736f",
    letterSpacing: 0.6,
  },
  // Horizontal edge set by FloatingActionDock (bottom-right in every language).
  ideasFabWrap: {
    position: "absolute",
    bottom: 20,
    alignItems: "flex-end",
    gap: 10,
    zIndex: 50,
  },
  ideasUndoWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    zIndex: 40,
  },
  ideasUndoCard: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1b1c1a",
    backgroundColor: "#1b1c1a",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  ideasUndoText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  ideasUndoBtn: {
    minHeight: 28,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#a89994",
    backgroundColor: "#524440",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ideasUndoBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasFabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // The one loud element in the app, and deliberately so — it's the primary action.
  // Warm brick red (colors.record) instead of the old #d92d20, a cold Tailwind red that
  // belonged to no palette and read as a stock alert button on warm paper. The glow is
  // ambient (0.08, per the shadow rules) rather than the old 0.24 halo.
  ideasRecordFab: {
    width: 62,
    height: 62,
    borderRadius: radii.round,
    backgroundColor: colors.record,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.record,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  // ── Dense compact row (collection "compact" density) ──────────────────────
  // A flush, single-line list row — no card shell, hairline divider between
  // rows — so the list scans tightly instead of as smaller cards.
  ideaDenseRow: {
    position: "relative",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E4DF",
    backgroundColor: "transparent",
  },
  ideaDenseRowSelected: { backgroundColor: "#EDE9E4" },
  ideaDenseRowNowPlaying: { backgroundColor: "rgba(184,125,107,0.08)" },
  ideaDenseInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  // Bare glyph — no circle, no border. The Pressable's hitSlop supplies the
  // ~44pt target; this box just centers the play/pause icon.
  ideaDensePlay: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ideaDenseMain: { flex: 1, minWidth: 0 },
  ideaDenseTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 18,
    color: "#1C1C19",
  },
  ideaDenseTitleProject: { fontFamily: "PlusJakartaSans_700Bold" },
  ideaDenseMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  ideaDenseDuration: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  // Quiet visual divider between the bookmark and the clip length.
  ideaDenseDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.textMuted,
  },
  // The compact preview extend: elapsed · draggable scrub line · duration · ✕,
  // sitting under the title so it aligns past the play glyph.
  ideaDenseScrubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    paddingLeft: 30,
  },
  // Compact search-match: a quiet second line under the title (glyph + snippet).
  ideaDenseSnippet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 5,
    paddingLeft: 30,
  },
  ideaDenseSnippetText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  // Day dividers need breathing room above when rows sit flush (dense list).
  ideasDayDividerRowDense: { marginTop: 12, marginBottom: 3 },
  // Quiet "hide this section" affordance at the end of a timeline divider.
  ideasDayDividerHideBtn: {
    width: 26,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  // Compact inline version embedded in the dashed separator row
  // Pill shown near filter bar when any items are hidden
  // Quiet tonal pill — no border (screen chrome is borderless, 2026-07-23).
  ideasUnhideAllPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "#F4F1ED",
  },
  ideasUnhideAllPillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#84736f",
    },
  // Pick ring (2026-09-11): while a page is a picker the lead slot swaps the
  // play glyph for a check circle — hollow borderMuted ring at rest, filled
  // terracotta with a white check when picked. Same 32pt box as the play glyph
  // so the card's geometry never moves between modes.
  ideaCardPickRing: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  ideaCardPickRingOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ideaCardPickRingDisabled: {
    borderColor: colors.borderSubtle,
  },
  // Unpicked: the ring is there for layout, not for the eye.
  ideaCardPickRingHidden: {
    opacity: 0,
  },
  // Dense rows keep a 20pt lead box, so the ring shrinks to fit the line.
  ideaCardPickRingDense: {
    width: 18,
    height: 18,
    borderWidth: 1.25,
  },
  // Trailing pick column (picker mode): the ring rides the card's end edge so the
  // play glyph keeps the lead slot and a clip can still be auditioned while picked.
  ideaCardPickCol: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  ideaCardLeadCol: {
    // Play-glyph column: the glyph sits vertically centered on the whole card
    // (approved 2026-07-23 — replaces the old top-seated optical lift).
    // Effective target stays 44pt via the button's own hitSlop.
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexShrink: 0,
    alignSelf: "stretch",
  },
  // Bare glyph (locked 2026-07-23): no circle, no border — the card's IdeaCard
  // Pressable adds hitSlop so the effective target stays ≥44pt.
  ideasInlinePlayBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
