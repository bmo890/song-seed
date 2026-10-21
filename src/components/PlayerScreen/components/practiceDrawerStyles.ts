import { StyleSheet } from "react-native";
import { colors, radii, text } from "../../../design/tokens";

/**
 * The practice panel's three drawers (Marks / Loop / Sound).
 *
 * Layout law for RTL: rows that map onto the tape's time axis (edge chips, the
 * drag slider, nudge carets) are pinned LTR by the component so "left = earlier"
 * always agrees with the reel above; everything else mirrors normally.
 */
/** Space between two Marks rows: the list's gap either side of the hairline. */
const MARK_ROW_PITCH_GAP = 10 + 1 + 10;

export const pd = StyleSheet.create({
  wrap: {
    gap: 10,
  },

  // ---- marks list ----
  // The play glyph leads in its own 30 pt seat, so the row's left padding is
  // lighter and the gap after it is the glyph's own breathing room.
  markRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    paddingLeft: 2,
    paddingRight: 10,
    borderRadius: radii.lg,
  },
  markGlyph: {
    width: 18,
    alignItems: "center",
  },
  markNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  markName: {
    ...text.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  markNote: {
    ...text.supporting,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  markNameSelected: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  // ---- where the playhead is (domain/markPhase) ----
  // Now: a tonal wash under the row, the name a weight up. No colour: colour
  // here belongs to the held row and to the sections' own inks.
  markNowWash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
  },
  // A section and the pins inside it share one wash: only the group's outer
  // corners are round, and each pin's wash reaches up over the gap and the
  // hairline above it, so the block is unbroken.
  markNowWashHead: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  markNowWashMid: {
    borderRadius: 0,
    top: -MARK_ROW_PITCH_GAP,
  },
  markNowWashTail: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    top: -MARK_ROW_PITCH_GAP,
  },
  // The rail that ties a section to its pins: one unbroken line from the
  // section's row to the last pin inside it.
  markGroupRail: {
    position: "absolute",
    left: 0,
    top: -MARK_ROW_PITCH_GAP,
    bottom: 0,
    width: 2,
  },
  // Round only the rail's two ends, so the joins between rows are seamless.
  markGroupRailHead: {
    top: 10,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  markGroupRailTail: {
    bottom: 10,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  markNameNow: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  markTimeNow: {
    color: colors.textStrong,
  },
  // Past: the row recedes — quieter ink, a paler glyph. Still readable, still tappable.
  markNamePast: {
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textMuted,
  },
  markTimePast: {
    color: colors.textMuted,
  },
  markPastGlyph: {
    opacity: 0.45,
  },
  markTime: {
    ...text.supporting,
    fontVariant: ["tabular-nums"],
  },
  // Unheld row's end: the time and the play glyph, read as one quiet cluster.
  markTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  markDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 10,
  },
  selectedCard: {
    backgroundColor: colors.primarySurface,
    borderRadius: radii.lg,
    paddingBottom: 10,
  },

  // ---- inspector ----
  inspector: {
    paddingHorizontal: 10,
    gap: 9,
  },
  edgesRow: {
    alignItems: "center",
    gap: 8,
  },
  edgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  edgeChipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  edgeChipLabel: {
    ...text.annotation,
    fontSize: 9,
    color: colors.textSecondary,
  },
  edgeChipLabelActive: {
    color: colors.primaryDeep,
  },
  edgeChipTime: {
    ...text.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  edgeArrow: {
    ...text.supporting,
    color: colors.textMuted,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  usePlayheadBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  usePlayheadText: {
    ...text.caption,
    color: colors.primaryDeep,
  },
  dragRow: {
    alignItems: "center",
    gap: 8,
  },
  dragSlider: {
    flex: 1,
    height: 32,
  },
  nudgeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  inspectorHint: {
    ...text.annotation,
    flexShrink: 1,
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: "none",
    color: colors.textMuted,
  },
  selectedHeadActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headIconBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  // ---- add row / footer actions ----
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    marginTop: 2,
  },
  inkLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  inkLinkText: {
    ...text.caption,
    color: colors.primaryDeep,
  },
  clickVolumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    marginTop: -4,
  },
  clickVolumeSlider: { flex: 1, height: 30 },
  // Leading the list: the divider moves under the row instead of above it.
  // Pinned over the list once it scrolls: opaque, so rows pass beneath.
  addRowSticky: {
    backgroundColor: colors.page,
  },
  addRowLead: {
    borderTopWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    paddingTop: 2,
    paddingBottom: 12,
    marginTop: 0,
    marginBottom: 2,
  },
  addHint: {
    ...text.supporting,
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: "auto",
    fontVariant: ["tabular-nums"],
  },
  // Undo/redo sit at the row's end, tighter than the row's 18pt gap — they are
  // one control in two halves, not two separate actions.
  undoRedoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  emptyText: {
    ...text.supporting,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },

  // ---- generic rows (loop + sound) ----
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  rowInCard: {
    paddingTop: 2,
  },
  rowLabel: {
    ...text.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  rowValue: {
    ...text.supporting,
    marginLeft: "auto",
    fontVariant: ["tabular-nums"],
  },
  // Step up rides the loop; its switch dims when there is no loop to count.
  stepUpSwitchDisabled: {
    opacity: 0.4,
  },
  // ---- step up's own progress line, under the row ----
  stepUpProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 8,
  },
  stepUpDots: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  stepUpDot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: "transparent",
  },
  stepUpDotDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stepUpDotCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  stepUpDotLink: {
    width: 7,
    height: 1,
  },
  stepUpProgressCount: {
    ...text.supporting,
    marginLeft: "auto",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  stepUpProgressRate: {
    ...text.supporting,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
    fontVariant: ["tabular-nums"],
  },
  stepUpLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  // The "?" beside a row label, centred on the word's capitals rather than its
  // line box: Jakarta's line box carries the ascender headroom above the caps,
  // so a box-centred glyph sits high beside the word (founder, 2026-10-21).
  labelHelp: {
    transform: [{ translateY: 2 }],
  },
  // Pushes a row's controls to its trailing edge.
  rowSpacer: {
    flex: 1,
  },
  countInLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  countInLengthKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  countInLength: {
    ...text.supporting,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  // On: the length takes the action ink, so the row agrees with its switch.
  countInLengthOn: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
  stepUpValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginLeft: "auto",
    // Shrinks before the icons and switch do — a long saved-plan name truncates
    // rather than pushing them off the row's edge.
    flexShrink: 1,
    minWidth: 0,
  },
  stepUpPlanName: {
    ...text.supporting,
    color: colors.textSecondary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    flexShrink: 1,
  },
  stepUpClimb: {
    ...text.supporting,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  // Between the practice dials and the take's sound: a hairline, with the room's
  // own side inset, and air either side so the knob never crowds the pitch rail.
  soundDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  soundStrip: {
    paddingHorizontal: 10,
  },
  // Keep / Reset all, once under the tabs: a quiet line, not a tool.
  keepRow: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  keepLabel: {
    ...text.supporting,
    color: colors.textSecondary,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    marginTop: 2,
  },
  subhead: {
    ...text.annotation,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  inkOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginLeft: "auto",
  },
  inkOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inkOptionText: {
    ...text.supporting,
    color: colors.textMuted,
  },
  inkOptionTextOn: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
  inkOptionDot: {
    width: 5,
    height: 5,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  partsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 18,
    rowGap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  partInk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  partInkBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  partInkText: {
    ...text.supporting,
    color: colors.textSecondary,
  },
  partInkTextOn: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
  note: {
    ...text.supporting,
    fontSize: 11.5,
    color: colors.textMuted,
    paddingHorizontal: 10,
  },

  // ---- sound ----
  // (speed + pitch dials live in common/SpeedPitchDials — shared with the editor)
  ghostRow: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderMuted,
    borderRadius: radii.lg,
    minHeight: 44,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // ---- record a layer ----
  recordLayerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    marginTop: 2,
  },
  recordLayerDot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
    backgroundColor: colors.record,
  },
  recordLayerText: {
    ...text.caption,
    fontSize: 13,
    color: colors.primaryDeep,
  },
});
