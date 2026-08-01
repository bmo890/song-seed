import { StyleSheet } from "react-native";
import { colors, radii, text } from "../../../design/tokens";

/**
 * The practice panel's three drawers (Marks / Loop / Sound).
 *
 * Layout law for RTL: rows that map onto the tape's time axis (edge chips, the
 * drag slider, nudge carets) are pinned LTR by the component so "left = earlier"
 * always agrees with the reel above; everything else mirrors normally.
 */
export const pd = StyleSheet.create({
  wrap: {
    gap: 10,
  },

  // ---- marks list ----
  markRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
  },
  markGlyph: {
    width: 18,
    alignItems: "center",
  },
  markName: {
    ...text.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    flex: 1,
  },
  markNameSelected: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  markTime: {
    ...text.supporting,
    fontVariant: ["tabular-nums"],
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
  // section span glyph (|—|), drawn from views so it tints per mark
  spanBarV: {
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  spanBarH: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  spanGlyph: {
    width: 16,
    flexDirection: "row",
    alignItems: "center",
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
  addHint: {
    ...text.supporting,
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: "auto",
    fontVariant: ["tabular-nums"],
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
  dialHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  dialValue: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 26,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  dialUnit: {
    ...text.caption,
    color: colors.textSecondary,
  },
  soundSlider: {
    height: 34,
    marginHorizontal: 10,
  },
  tickLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginTop: -2,
  },
  tickLabel: {
    ...text.supporting,
    fontSize: 10.5,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  tickLabelOn: {
    color: colors.primaryDeep,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  pitchRow: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
  },
  pitchRail: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 22,
  },
  pitchTick: {
    width: 1,
    height: 7,
    backgroundColor: colors.borderMuted,
  },
  pitchTickZero: {
    height: 12,
    backgroundColor: colors.textMuted,
  },
  pitchTickOn: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
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
