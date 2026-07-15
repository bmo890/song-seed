import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Lyrics editing and version views.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const lyricsStyles = {
  lyricsSummaryCard: {
    marginBottom: 8,
  },
  lyricsScreenContent: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 24,
  },
  lyricsScreenContentKeyboard: {
    paddingBottom: 120,
  },
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
  lyricsVersionTopActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  lyricsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  lyricsHeaderText: {
    flex: 1,
    gap: 4,
  },
  lyricsInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D7C2BD",
    backgroundColor: "#fff",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 18,
    fontSize: 16,
    lineHeight: 25,
    color: "#1b1c1a",
    fontFamily: "PlayfairDisplay_400Regular",
    textAlignVertical: "top",
    marginBottom: 20,
  },
  lyricsInputFill: {
    flex: 1,
    minHeight: 0,
    marginBottom: 0,
  },
  lyricsEditFieldActive: {
    borderColor: "#a89994",
    borderWidth: 2,
    borderStyle: "dashed",
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
  lyricsActionBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.round,
  },
  lyricsActionBtnText: {
    fontSize: 11,
  },
  lyricsTimelineCard: {
    gap: 8,
  },
  lyricsTimelineCardPressable: {
    gap: 8,
  },
  lyricsVersionHeader: {
    gap: 8,
  },
  lyricsVersionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  lyricsVersionBadgePlaceholder: {
    minWidth: 100,
    minHeight: 28,
  },
  lyricsVersionToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
    borderWidth: 1,
    borderColor: "#E8E4DF",
  },
  lyricsTimelinePreviewScroll: {
    height: 160,
  },
  lyricsVersionPreviewContent: {
    flexGrow: 1,
  },
  lyricsPreviewText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textPrimary,
    fontFamily: "PlayfairDisplay_400Regular",
  },
  lyricsHistoryList: {
    marginTop: 10,
    gap: 10,
  },
  lyricsHistoryCard: {
    borderWidth: 1,
    borderColor: "#E8E4DF",
    borderRadius: 12,
    backgroundColor: "#F4F1ED",
    padding: 12,
    gap: 8,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
