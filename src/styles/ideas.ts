import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, shadows } from "../design/tokens";

// Ideas screen: header, sorting, filters, stage, utility bar, dense rows.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const ideasStyles = {
  ideasWorkspacePill: {
    maxWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E8E4DF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ideasWorkspacePillText: {
    flexShrink: 1,
    fontSize: 12,
    color: "#524440",
    fontFamily: "PlusJakartaSans_700Bold",
  },
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
  ideasFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ideasFilterChip: {
    minHeight: 32,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  ideasFilterChipActive: {
    backgroundColor: "#B87D6B",
  },
  ideasFilterChipText: {
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasFilterChipTextActive: {
    color: "#ffffff",
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
  ideasUtilityRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  ideasUtilityRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  ideasUtilityControlGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ideasUtilityLeadIndicator: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
  },
  ideasUtilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#FDFBF7",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ideasUtilityChipOpen: {
    borderColor: "rgba(215,194,189,0.8)",
    backgroundColor: "#F4F1ED",
  },
  ideasUtilityChipIconOnly: {
    minWidth: 42,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  ideasUtilityChipFilterOnly: {
    minWidth: 74,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  ideasUtilityChipSortOnly: {
    minWidth: 82,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  ideasUtilityChipDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(215,194,189,0.5)",
  },
  ideasUtilityChipDividerActive: {
    backgroundColor: "rgba(215,194,189,0.8)",
  },
  ideasUtilityChipPrimary: {
    backgroundColor: "#B87D6B",
    borderColor: "#B87D6B",
  },
  ideasUtilityChipClear: {
    borderColor: "rgba(184,50,50,0.2)",
    backgroundColor: "rgba(184,50,50,0.05)",
  },
  ideasUtilityChipText: {
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasUtilityChipTextDanger: {
    color: colors.danger,
  },
  ideasUtilityChipTextPrimary: {
    color: "#ffffff",
  },
  ideasSortChipIconStack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  ideasUtilityIconChip: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
  },
  ideasUtilityIconDanger: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(184,50,50,0.2)",
    backgroundColor: "rgba(184,50,50,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  ideasUtilityClearIconBtn: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
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
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ideasPopoverMenu: {
    position: "absolute",
    top: 44,
    alignSelf: "flex-start",
    minWidth: 220,
    maxWidth: 272,
    zIndex: 30,
  },
  // Filter/sort popovers hang from the toolbar's trailing edge (the glyphs
  // live at the end of the search row).
  ideasPopoverMenuEnd: {
    right: 0,
  },
  ideasStageChipsScroll: {
    maxHeight: 168,
  },
  ideasSortMenuItem: {
    minHeight: 40,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  ideasMenuItemLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  ideasSortMenuItemActive: {
    backgroundColor: colors.surfaceContainer,
  },
  ideasSortMenuItemText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textPrimary,
    },
  // Active row: terracotta ink + the check glyph — never a heavy tint.
  ideasSortMenuItemTextActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
    },
  ideasDropdownSectionToggle: {
    minHeight: 34,
    borderRadius: radii.lg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Section labels inside menus: text.annotation-style caps.
  ideasDropdownSectionToggleText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  ideasDropdownSectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ideasDropdownSectionMetaText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#84736f",
    },
  ideasDropdownSectionStack: {
    gap: 8,
  },
  // Multi-select ink: word + leading dot, no capsule (locked 2026-07-24).
  ideasStageInkWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
    rowGap: 11,
    paddingHorizontal: 6,
    marginTop: 8,
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
  // Legacy stage/group chips — still used by the song-detail takes filter
  // (SongClipFilterMenu). Slated to move to the ink language too.
  ideasToggleRow: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
  ideasSortDirectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  ideasSortDirectionControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ideasSortDirectionChip: {
    minHeight: 30,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#FDFBF7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  ideasSortDirectionChipActive: {
    backgroundColor: "#B87D6B",
    borderColor: "#B87D6B",
  },
  ideasSortDirectionChipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: "#84736f",
    },
  ideasSortDirectionChipTextActive: {
    color: "#ffffff",
  },
  ideasDropdownSectionTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: "#84736f",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  ideasDropdownDivider: {
    height: 1,
    backgroundColor: "rgba(215,194,189,0.4)",
    marginVertical: 4,
  },
  ideasHeaderSelectBtn: {
    minHeight: 32,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ideasHeaderSelectBtnText: {
    fontSize: 12,
    color: "#524440",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ideasHeaderActionsPlaceholder: {
    width: 84,
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
  ideasHeaderOverflowMenu: {
    position: "absolute",
    top: 54,
    right: 12,
    minWidth: 230,
    maxWidth: 280,
    zIndex: 2,
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
    backgroundColor: "#F2E4DF",
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
  ideasFabWrap: {
    position: "absolute",
    right: 18,
    bottom: 20,
    alignItems: "flex-end",
    gap: 10,
    zIndex: 50,
  },
  ideasNowPlayingDock: {
    marginBottom: 8,
    zIndex: 28,
  },
  ideasNowPlayingCard: {
    minHeight: 56,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    shadowColor: "#1b1c1a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  ideasNowPlayingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ideasNowPlayingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  ideasNowPlayingTitle: {
    fontSize: 12,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasNowPlayingSubtitle: {
    fontSize: 11,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  ideasNowPlayingBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
  },
  ideasNowPlayingProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ideasNowPlayingProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E8E4DF",
    overflow: "hidden",
  },
  ideasNowPlayingProgressFill: {
    height: "100%",
    backgroundColor: "#1b1c1a",
  },
  ideasNowPlayingTimeText: {
    fontSize: 10,
    lineHeight: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    fontVariant: ["tabular-nums"],
    minWidth: 34,
    textAlign: "center",
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
  ideasFabMenu: {
    gap: 8,
    alignItems: "flex-end",
    marginBottom: 10,
  },
  // Paper chips, not glassy bubbles: page-tinted surface + the app's faint technical
  // line, the same recipe as SurfaceCard. They read as slips laid on the page.
  ideasFabMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 40,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 15,
    paddingVertical: 9,
    ...shadows.card,
  },
  ideasFabMenuItemText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.1,
  },
  ideasFabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ideasCreateFab: {
    width: 46,
    height: 46,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
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
  ideasSelectionDock: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
    shadowColor: "#1b1c1a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 50,
  },
  ideasSelectionDockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ideasSelectionCount: {
    fontSize: 14,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasSelectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ideasSelectionHeaderBtn: {
    minHeight: 30,
    borderRadius: radii.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  ideasSelectionHeaderBtnText: {
    fontSize: 11,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasSelectionActions: {
    gap: 8,
    paddingRight: 6,
  },
  ideasSelectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FDFBF7",
    borderWidth: 1,
    borderColor: "#E8E4DF",
  },
  ideasSelectionActionText: {
    fontSize: 12,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ideasSelectionActionDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  ideasSelectionActionDangerText: {
    fontSize: 12,
    color: colors.danger,
    fontFamily: "PlusJakartaSans_700Bold",
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
  // Active (peeking) state of the "N hidden" toggle chip.
  ideasUnhideAllPillActive: {
    backgroundColor: "#F2E4DF",
  },
  ideasUnhideAllPillTextActive: {
    color: colors.primaryDeep,
  },
  // Per-row restore (eye) button shown while peeking at hidden items.
  ideaDenseRestoreBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ideaRowHiddenDim: { opacity: 0.5 },
  ideasHiddenDayCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  ideasHiddenDayTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    lineHeight: 15,
    color: "#524440",
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
  ideasSearchTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  ideasSearchTag: {
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: "#F4F1ED",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ideasSearchTagText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: "#84736f",
    },
  // Bare glyph (locked 2026-07-23): no circle, no border — the card's IdeaCard
  // Pressable adds hitSlop so the effective target stays ≥44pt.
  ideasInlinePlayBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  ideasInlinePlayBtnCompact: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
  },
  ideasGhostProjectRow: {
    borderStyle: "dashed",
    borderColor: "#16a34a",
    borderWidth: 1,
    borderRadius: radii.round,
    backgroundColor: "#f5fff7",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ideasGhostProjectIcon: {
    backgroundColor: "transparent",
    borderColor: "#16a34a",
  },
  ideasTitleModalCard: {
    gap: 8,
  },
  ideasTitleModalText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
