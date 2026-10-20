import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, text } from "../design/tokens";

// Clip cards, clip actions/notes sheets, status chips, tag picker, threads.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const clipsStyles = {
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
  tagPickerAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // The one field recipe: a tonal fill, no border (SearchField).
  tagPickerAddInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceContainer,
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
  // The sheet's name when it edits the note alone: an editorial title, Lora.
  clipNotesSheetHeading: {
    ...text.headerTitle,
  },
  clipNotesSheetSubtitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
    marginTop: -4,
    paddingHorizontal: 2,
  },
  // Same shell as the title above it; tall enough for a verse, not a page.
  clipNotesSheetTextInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 132,
    maxHeight: 320,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    color: colors.textPrimary,
  },
  clipNotesSheetButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingTop: 4,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
