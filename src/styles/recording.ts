import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Recording surface: controls, live waveform, guides, input/output, counts.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const recordingStyles = {
  recordingLyricsPanel: {
    gap: 8,
    paddingTop: 2,
  },
  recordingLyricsHeader: {
    marginBottom: 0,
    alignItems: "center",
    minHeight: 44,
  },
  recordingLyricsTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1b1c1a",
  },
  // Expanded: same look as collapsed, just a touch smaller.
  recordingLyricsTitleExpanded: {
    fontSize: 16,
    lineHeight: 20,
  },
  recordingLyricsMeta: {
    fontSize: 13,
    color: "#84736f",
  },
  recordingLyricsSyncMeta: {
    fontSize: 12,
    color: "#B87D6B",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  recordingLyricsAutoscrollBtn: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  recordingLyricsToggleBtn: {
    backgroundColor: "transparent",
    borderWidth: 0,
    width: 28,
    height: 28,
  },
  recordingLyricsBody: {
    borderWidth: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  // Expanded "perform" view: break out of the 28px gutter to full-bleed and
  // fill the height left below the slim reel.
  recordingLyricsPanelExpanded: {
    flex: 1,
  },
  recordingLyricsBodyExpanded: {
    flex: 1,
    marginHorizontal: -28,
    gap: 10,
    paddingTop: 4,
  },
  recordingLyricsTitleArea: {
    flex: 1,
  },
  // Expanded: extend the header to the right screen edge so the autoscroll/zoom
  // controls and the collapse chevron line up with the full-bleed lyrics.
  recordingLyricsHeaderExpanded: {
    marginRight: -28,
    paddingRight: 8,
  },
  // Pushes the title + chord toggle to the left and the rest of the controls
  // to the right edge.
  recordingLyricsHeaderSpacer: {
    flex: 1,
  },
  recordingLyricsHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingLyricsZoomBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  recordingLyricsZoomBtnActive: {
    backgroundColor: "#F2E4DF",
  },
  // Speed readout button — same footprint as the icon buttons beside it.
  recordingLyricsSpeedBtn: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  recordingLyricsSpeedBtnText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  recordingLyricsSpeedBtnTextActive: {
    color: colors.primaryDeep,
  },
  // Flat numeric speed row — revealed only by the speed button, closes itself
  // the moment a number is picked or a take starts.
  recordingLyricsSpeedRow: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 8,
  },
  recordingLyricsSpeedRowItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  recordingLyricsSpeedRowItemActive: {
    backgroundColor: "#B87D6B",
  },
  recordingLyricsSpeedRowText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#84736f",
    fontVariant: ["tabular-nums"],
  },
  recordingLyricsSpeedRowTextActive: {
    color: "#ffffff",
  },
  recordingLyricsScrollContent: {
    paddingHorizontal: 16,
    // A blank line of lead-in above the first lyric so autoscroll has a buffer.
    paddingTop: 34,
    paddingBottom: 6,
  },
  recordingLyricsScroll: {
    flex: 1,
    minHeight: 160,
  },
  recordingLyricsText: {
    fontSize: 20,
    lineHeight: 36,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_400Regular",
  },
  recordingScreenLayout: {
    flex: 1,
  },
  recordingScroll: {
    flex: 1,
  },
  recordingScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 12,
    gap: 14,
  },
  recordingPerformBody: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 12,
    gap: 14,
  },
  recordingScrollContentWithCollapsedLyrics: {
    paddingBottom: 8,
  },
  recordingContentBody: {
    flex: 1,
    gap: 12,
  },
  recordingContentBodyCollapsedLyrics: {
    justifyContent: "space-between",
  },
  recordingBluetoothWarning: {
    backgroundColor: "#F4F1ED",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  recordingBluetoothWarningLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "#B87D6B",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  recordingBluetoothWarningText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#1b1c1a",
  },
  recordingBluetoothWarningMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: "#84736f",
  },
  recordingBluetoothWarningButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    minHeight: 32,
    borderRadius: 4,
    backgroundColor: "#EDE9E4",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  recordingBluetoothWarningButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#B87D6B",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  recordingGuideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  recordingGuideHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  recordingGuideCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recordingGuideEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  recordingGuideTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  recordingGuideTiming: {
    alignItems: "flex-end",
    gap: 2,
  },
  recordingGuideTimingText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  recordingGuideState: {
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  recordingGuideWaveWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 4,
  },
  recordingGuidePlayhead: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#B87D6B",
    opacity: 0.8,
  },
  recordingMetaSection: {
    gap: 6,
  },
  recordingIdeaLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  recordingTimer: {
    fontSize: 44,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1b1c1a",
    letterSpacing: -1.1,
    marginTop: 0,
  },
  recordingTimerCompact: {
    fontSize: 36,
    marginTop: 0,
  },
  recordingCountInBlock: {
    gap: 10,
    paddingVertical: 10,
  },
  recordingCountInTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1b1c1a",
    letterSpacing: -0.8,
  },
  recordingCountInTitleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  recordingCountInDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recordingCountInDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D7C2BD",
    backgroundColor: "transparent",
  },
  recordingCountInDotCompact: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  recordingCountInDotActive: {
    backgroundColor: "#B5483A",
    borderColor: "#B5483A",
  },
  recordingStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: -2,
  },
  recordingStatusDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
  },
  recordingStatusDotActive: {
    backgroundColor: "#B5483A",
  },
  recordingStatusDotIdle: {
    backgroundColor: "#D7C2BD",
  },
  recordingStatusText: {
    fontSize: 15,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  liveWaveWrap: {
    marginTop: 0,
    marginBottom: 0,
    marginHorizontal: -28,
    backgroundColor: "#F4F1ED",
    borderRadius: 4,
    justifyContent: "center",
    paddingHorizontal: 8,
    position: "relative",
    overflow: "hidden",
  },
  liveWaveWrapDefault: {
    height: 320,
  },
  // Expanded ("perform") layout: a slim confidence monitor so the lyrics get the height.
  liveWaveWrapCompact: {
    height: 130,
    marginBottom: 0,
  },
  // Collapsed-lyrics layout: the reel fills the leftover space above the lyrics tab.
  liveWaveWrapFill: {
    flex: 1,
    minHeight: 220,
  },
  recordingMetaSectionFill: {
    flex: 1,
    justifyContent: "center",
  },
  recordingControlsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordingControlsBarCompact: {
    gap: 12,
  },
  recordingControlsSpacer: {
    width: 64,
  },
  recordingControlsSaveColumn: {
    width: 64,
    alignItems: "center",
  },
  recordingOutputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: "#F4F1ED",
  },
  recordingOutputCopy: {
    flex: 1,
    gap: 1,
  },
  recordingOutputLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#84736f",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recordingOutputValue: {
    fontSize: 14,
    color: "#1b1c1a",
  },
  recordingOutputAuto: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#a89994",
  },
  circleControlBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.round,
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  circleControlBtnCompact: {
    width: 42,
    height: 42,
    borderRadius: radii.round,
  },
  circleControlBtnDisabled: {
    opacity: 0.5,
  },
  recordBtnWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  recordBeatHalo: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: radii.round,
    backgroundColor: "#B5483A",
  },
  recordBeatHaloCompact: {
    width: 60,
    height: 60,
  },
  circleRecordBtn: {
    width: 96,
    height: 96,
    borderRadius: radii.round,
    backgroundColor: "#B5483A",
    borderWidth: 8,
    borderColor: "#EDE9E4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B5483A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  circleRecordBtnCompact: {
    width: 60,
    height: 60,
    borderRadius: radii.round,
    borderWidth: 5,
  },
  circleRecordBtnActive: {
    borderColor: "#D7C2BD",
    borderWidth: 8,
  },
  circleRecordBtnDisabled: {
    backgroundColor: "#CDA89E",
    borderColor: "#E8E4DF",
    opacity: 0.72,
  },
  recordingInputCard: {
    gap: 10,
    marginBottom: 4,
  },
  recordingSettingsTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: "#1b1c1a",
    marginBottom: 4,
  },
  recordingSettingsMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: "#84736f",
    marginBottom: 14,
  },
  recordingInputHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  recordingInputHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  recordingInputTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#84736f",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recordingInputActiveLabel: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1b1c1a",
  },
  recordingInputRefreshBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
    borderWidth: 1,
    borderColor: "#E8E4DF",
  },
  recordingInputOptionList: {
    gap: 6,
  },
  recordingInputOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#FFFFFF",
  },
  recordingInputOptionActive: {
    borderColor: "#B87D6B",
    backgroundColor: "#B87D6B",
  },
  recordingInputOptionDisabled: {
    opacity: 0.55,
  },
  recordingInputOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#524440",
  },
  recordingInputOptionTextActive: {
    color: "#FFFFFF",
  },
  recordingInputOptionCheck: {
    marginLeft: "auto",
  },
  recordingInputDisabledNote: {
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  recordingInputError: {
    fontSize: 12,
    color: colors.danger,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  recordingBottomDock: {
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "rgba(253,251,247,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#E8E4DF",
  },
  recordingBottomDockCompact: {
    paddingTop: 4,
    paddingBottom: 6,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
