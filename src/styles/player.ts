import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Playback UI: mini media bar, transport, player lyrics, docks, progress, waveforms.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const playerStyles = {
  playerLyricsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  playerLyricsHeaderText: {
    flex: 1,
    gap: 4,
  },
  playerLyricsTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#1b1c1a",
  },
  playerLyricsMeta: {
    fontSize: 12,
    color: "#84736f",
  },
  playerLyricsSyncMeta: {
    fontSize: 11,
    color: "#B87D6B",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  playerLyricsToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
    borderWidth: 1,
    borderColor: "#E8E4DF",
  },
  playerLyricsBody: {
    borderWidth: 1,
    borderColor: "#D7C2BD",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  playerLyricsScroll: {
    maxHeight: 140,
  },
  playerLyricsText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1b1c1a",
  },
  playerUtilityBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  playerUtilityBtnSecondary: {
    backgroundColor: "#524440",
  },
  playerUtilityBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  playerUtilityBtnTextSecondary: {
    color: "#fff",
  },
  progressWrap: {
    width: "100%",
    marginBottom: 8,
    gap: 6,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E8E4DF",
    overflow: "hidden",
  },
  progressInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressTrackInline: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E8E4DF",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1b1c1a",
  },
  progressMeta: {
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  transportLayout: {
    flex: 1,
  },
  transportHeaderZone: {
    gap: 12,
  },
  transportHeaderActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transportHeaderActionBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  transportBodyZone: {
    flex: 1,
    position: "relative",
  },
  transportSurface: {
    flex: 1,
  },
  transportSurfaceWithFloating: {
    paddingBottom: 220,
  },
  transportScrollContent: {
    paddingBottom: 12,
  },
  transportScrollContentWithFloating: {
    paddingBottom: 220,
  },
  transportFloatingZone: {
    position: "absolute",
    right: 16,
    left: 16,
    bottom: 12,
  },
  transportFooterZone: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: "#FDFBF7",
    borderTopWidth: 1,
    borderTopColor: "#E8E4DF",
  },
  transportFooterCard: {
    backgroundColor: "#fff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    padding: 14,
    gap: 12,
  },
  transportFooterMeta: {
    gap: 2,
  },
  transportFooterEyebrow: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#84736f",
  },
  transportFooterTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1b1c1a",
  },
  transportFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  transportFooterButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#1b1c1a",
    alignItems: "center",
    justifyContent: "center",
  },
  transportFooterButtonSecondary: {
    backgroundColor: "#E8E4DF",
  },
  transportFooterButtonDanger: {
    backgroundColor: colors.danger,
  },
  transportFooterButtonDisabled: {
    backgroundColor: "#D7C2BD",
  },
  transportFooterButtonText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  transportFooterButtonTextSecondary: {
    color: "#1b1c1a",
  },
  miniProgressWrap: {
    marginBottom: 4,
  },
  miniProgressTopDivider: {
    height: 1,
    borderRadius: 999,
    backgroundColor: "rgba(215,194,189,0.4)",
    marginTop: 6,
    marginBottom: 6,
  },
  miniProgressTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  miniProgressTime: {
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  miniProgressTrackHitbox: {
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: 12,
  },
  // Track + trailing accessory (e.g. an inline close button) share one row so the
  // accessory centers on the track line rather than the whole labeled block.
  miniProgressTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniProgressTrackHitboxFlex: {
    flex: 1,
  },
  // Inline (flanking) time labels: fixed min-width + tabular figures so the track
  // start/end don't jitter as the elapsed digits change.
  miniProgressTimeFlankStart: {
    minWidth: 30,
    fontVariant: ["tabular-nums"],
  },
  miniProgressTimeFlankEnd: {
    minWidth: 30,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  miniProgressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E8E4DF",
    overflow: "visible",
    position: "relative",
  },
  miniProgressFill: {
    height: "100%",
    backgroundColor: "#1b1c1a",
    borderRadius: 999,
  },
  miniProgressDot: {
    position: "absolute",
    top: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1b1c1a",
    transform: [{ translateX: -5 }, { translateY: -5 }],
  },
  globalInlineDockWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
  },
  globalInlineDockCard: {
    minHeight: 58,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    shadowColor: "#1b1c1a",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  globalInlineDockTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  globalInlineDockCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  globalInlineDockTitle: {
    fontSize: 12,
    lineHeight: 15,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  globalInlineDockSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  globalInlineDockCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
  },
  globalInlineDockProgressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E8E4DF",
    overflow: "hidden",
  },
  globalInlineDockProgressFill: {
    height: "100%",
    backgroundColor: "#1b1c1a",
  },
  globalInlineDockTimesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  globalInlineDockTime: {
    fontSize: 10,
    lineHeight: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    fontVariant: ["tabular-nums"],
  },
  // ─── Global Media Dock ──────────────────────────────────────────────────────
  miniMediaDockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  // Playback surface — full-width, hairline top, warm paper
  // Inverted scheme: a warm terracotta field with paper-colored type/icons, so
  // the dock reads as one calm color block, clearly distinct from the paper page.
  miniMediaDockSurface: {
    backgroundColor: "#8b4f3b",
    paddingHorizontal: 16,
    // Flush at the very top — the progress track (first child) sits right on the
    // surface's top edge with no gap. All vertical rhythm lives in the row below.
    paddingTop: 0,
    paddingBottom: 6,
  },
  // Recording tint variant — keeps its own light red surface + hairline (the
  // terracotta inversion is playback-only).
  miniMediaDockSurfaceRecording: {
    backgroundColor: colors.recordSurface,
    borderTopWidth: 1,
    borderTopColor: colors.recordBorder,
    paddingTop: 10,
  },
  // Inner content wrapper — dims as a unit for preview state (recording dock)
  miniMediaDockContent: {
    gap: 4,
  },
  // Hairline progress along the dock's top edge — display-only (scrubbing lives
  // in the full player). Bleeds past the surface padding to run edge-to-edge.
  // Deep terracotta track (a groove cut into the dock) + warm gold fill. Neither
  // color matches the paper page above, so the fill reads as progress inside a
  // bar instead of "the page bleeding into the dock" — the previous paper-on-paper
  // fill was invisible against the page it sat flush against.
  miniMediaDockProgressTrack: {
    height: 3,
    backgroundColor: "#6f3d2d",
    marginHorizontal: -16,
  },
  miniMediaDockProgressFill: {
    height: 3,
    backgroundColor: "#E8B865",
  },
  // The single dock row: [ ✕ ] [ title/context …flex… ] [ ◀ ▶ ▶▶ ] [ ≡ / n·n ].
  // ✕ anchors left, the title absorbs the slack, and the transport + queue
  // clusters sit at the right. A touch of extra vertical room lets the title
  // carry both the clip title and its context line when present.
  miniMediaDockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    // Equal top/bottom so the transport cluster centers itself below the flush
    // progress track — this is where the dock's extra height + centering live.
    paddingTop: 10,
    paddingBottom: 10,
  },
  // Prev · play · next kept tight together so they read as one control.
  miniMediaDockTransport: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  // Queue button with its "n / n" position readout stacked beneath it.
  miniMediaDockQueueCol: {
    minWidth: 34,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  // Translucent paper chip on the terracotta field; fills solid paper when active.
  miniMediaDockHeaderBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    backgroundColor: "rgba(253,251,247,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniMediaDockHeaderBtnActive: {
    backgroundColor: "#FDFBF7",
  },
  // Small "n / n" queue-position readout under the queue button (only for a real
  // multi-item queue). Tabular so it doesn't jitter as the position changes.
  miniMediaDockQueueCount: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10,
    lineHeight: 11,
    color: "rgba(253,251,247,0.64)",
    fontVariant: ["tabular-nums"],
  },
  miniMediaDockTitlePress: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 3,
    gap: 1,
  },
  miniMediaDockTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    lineHeight: 17,
    color: "#FDFBF7",
  },
  miniMediaDockSubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 14,
    color: "rgba(253,251,247,0.64)",
  },
  // Cream circle with a terracotta glyph — the one inverted focal control.
  miniMediaDockPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
  },
  // Bare skip button — no background
  miniMediaDockSkipBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  // Recording dock row: copy block
  miniMediaDockRecordingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  miniMediaDockRecordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  miniMediaDockRecordingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.record,
  },
  miniMediaDockRecordingDotPaused: {
    backgroundColor: "#a89994",
  },
  miniMediaDockRecordingBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.record,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  miniMediaDockRecordingTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1b1c1a",
  },
  miniMediaDockRecordingMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.record,
  },
  // Recording transport: pause + stop
  miniMediaDockRecordingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  miniMediaDockRecordingBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.recordBorder,
    backgroundColor: colors.recordSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  miniMediaDockRecordingStopBtn: {
    borderColor: colors.record,
    backgroundColor: colors.record,
  },
  miniMediaDockRecordingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  miniMediaDockRecordingTime: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.record,
    fontFamily: "PlusJakartaSans_700Bold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  miniMediaDockHintText: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.record,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  inlinePlayBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "#D7C2BD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginTop: 2,
  },
  inlinePlayBtnText: {
    fontSize: 12,
    color: "#1b1c1a",
    fontFamily: "PlusJakartaSans_700Bold",
    marginLeft: 1,
  },

  inlinePlayerWrap: {
    borderWidth: 1,
    borderColor: "#E8E4DF",
    borderRadius: radii.lg,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: "#ffffff",
  },
  // inlineTimes removed

  waveWrap: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E4DF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 2,
  },
  waveBarsRow: {
    height: 64,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    paddingHorizontal: 2,
  },
  waveBar: { flex: 1, backgroundColor: "#D7C2BD", borderRadius: 6 },
  waveBarPlayed: { backgroundColor: "#1b1c1a" },
  playheadWrap: {
    position: "relative",
    height: 0,
  },
  playhead: {
    position: "absolute",
    top: -62,
    width: 2,
    height: 66,
    backgroundColor: colors.playhead,
    marginLeft: -1,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
