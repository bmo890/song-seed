import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, shadows } from "../design/tokens";

// Clip cards, clip actions/notes sheets, status chips, tag picker, threads.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const clipsStyles = {
  threadRowWrap: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  threadGuideWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingRight: 4,
  },
  threadGuideLine: {
    width: 10,
    borderLeftWidth: 1,
    borderLeftColor: "#D7C2BD",
    marginRight: 2,
  },
  threadCard: {
    flex: 1,
  },
  threadToggleBtn: {
    borderWidth: 1,
    borderColor: "#D7C2BD",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#F4F1ED",
  },
  threadToggleText: {
    fontSize: 10,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  // One note treatment app-wide (unified 2026-07-27): earned serif in true
  // italic — a note is content you wrote, not chrome. Replaces the old 11px
  // grey sans + document glyph (which also carried a cold #94a3b8 literal).
  clipNoteLine: {
    fontFamily: "Lora_500Medium_Italic",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#524440",
    marginTop: 3,
  },
  // Measurement twin: occupies no space and paints nothing.
  clipNoteLineMeasure: {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: -1,
  },
  clipNoteLineMore: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: colors.primaryDeep,
    marginTop: 2,
  },
  clipCardTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 2,
  },
  // Tags rendered inline on the footer date row: right-aligned, no stacking margin.
  clipCardTagsRowFooter: {
    marginTop: 0,
    justifyContent: "flex-end",
    flexShrink: 1,
  },
  clipCardTagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clipCardTagBadgeText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  clipCardAddTagBtn: {
    width: 18,
    height: 18,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  tagPickerContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tagPickerSectionLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#a89994",
    marginBottom: 8,
    marginTop: 10,
  },
  tagPickerChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  tagPickerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    // Match the card tag-badge corner (radii.md). Border is always present so
    // the outline (unselected) and filled (selected) states are the same size.
    borderRadius: 6,
    borderWidth: 1,
  },
  tagPickerChipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    },
  tagPickerCustomDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagPickerAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagPickerAddInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    borderRadius: 4,
    paddingHorizontal: 10,
    fontSize: 13,
    color: "#1b1c1a",
    backgroundColor: "#F4F1ED",
  },
  tagPickerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  tagPickerAddBtnDisabled: {
    opacity: 0.5,
  },
  tagPickerColorRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  tagPickerColorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  tagPickerColorSwatchActive: {
    borderWidth: 2,
    borderColor: "#524440",
  },
  clipCard: {
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    gap: 4,
    opacity: 0.97,
  },
  // Stage as title-row ink (locked 2026-07-27) — dial + word, same form as the
  // PRIMARY mark so the most-read line on the card speaks one language.
  // flexShrink 1 (not 0): on a squeezed row the WORD gives way, never the title,
  // and never the dial (which carries the stage on its own).
  stageInk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    flexShrink: 1,
  },
  stageInkText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9.5,
    lineHeight: 18,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  statusChipBtn: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radii.round,
    minHeight: 34,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
  },
  statusBtnActive: {
    borderColor: colors.primary,
    ...shadows.cardActive,
  },
  statusRowSpaced: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  clipRowWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    flex: 1,
  },
  clipRowCard: {
    flex: 1,
  },
  clipActionsTitleBlock: {
    gap: 2,
    marginBottom: 8,
  },
  clipActionsSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  clipActionsOptionList: {
    gap: 6,
  },
  clipActionsOption: {
    minHeight: 42,
    borderRadius: 12,
  },

  // -- ClipNotesSheet --
  clipNotesSheetContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    paddingBottom: 4,
  },
  clipNotesSheetScroll: {
    maxHeight: 560,
  },
  clipNotesSheetSubtitle: {
    fontSize: 12,
    color: "#84736f",
    marginTop: -4,
  },
  clipNotesSheetTextInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D7C2BD",
    backgroundColor: "#fff",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 200,
    maxHeight: 360,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
    color: "#1b1c1a",
  },
  clipNotesSheetButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingTop: 4,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
