import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Lyrics editing and version views.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const lyricsStyles = {
  lyricsVersionDocumentContent: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 28,
  },
  lyricsVersionDocumentContentEdit: {
    flex: 1,
    paddingBottom: 0,
  },
  lyricsVersionScreenBody: {
    flex: 1,
    paddingBottom: 28,
  },
  lyricsVersionDocumentFill: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 16,
  },
  lyricsVersionDocumentFillEdit: {
    paddingBottom: 0,
  },
  lyricsInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D7C2BD",
    backgroundColor: "#fff",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingEnd: 18,
    fontSize: 16,
    lineHeight: 25,
    color: "#1b1c1a",
    fontFamily: "Lora_500Medium",
    textAlignVertical: "top",
    marginBottom: 20,
  },
  lyricsInputFill: {
    flex: 1,
    minHeight: 0,
    marginBottom: 0,
  },
  // Editing is writing on a page (2026-10-15): the white sheet of your work,
  // no dashed frame around it.
  lyricsEditFieldActive: {
    borderWidth: 0,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  lyricsPreviewWrap: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 160,
    marginBottom: 10,
  },
  lyricsPreviewWrapExpanded: {
    flex: 1,
    minHeight: 0,
  },
  lyricsPreviewWrapDocument: {
    marginBottom: 16,
  },
  lyricsScrollableWrap: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    marginBottom: 0,
  },
  // Chord view: drop the stacked bottom padding so the zoom bar sits at the screen
  // bottom (above the safe-area inset).
  lyricsVersionBodyFlush: {
    paddingBottom: 0,
  },
  // Chord view: bleed the chart band to the screen edges (cancels the screen's
  // 16px horizontal padding) for maximum horizontal room, square corners.
  lyricsChordChartFlush: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginHorizontal: -16,
    marginBottom: 0,
    borderRadius: 0,
  },
  lyricsScrollIndicatorTrack: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 4,
    borderRadius: 999,
    backgroundColor: "rgba(27,28,26,0.08)",
    overflow: "hidden",
  },
  lyricsScrollIndicatorThumb: {
    width: 4,
    borderRadius: 999,
    backgroundColor: "rgba(27,28,26,0.38)",
  },
  lyricsVersionPreviewContent: {
    flexGrow: 1,
  },
  lyricsPreviewText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textPrimary,
    fontFamily: "Lora_500Medium",
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
