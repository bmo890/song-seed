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
  playerLyricsText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1b1c1a",
  },
  progressTrack: {
    width: "100%",
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
  transportLayout: {
    flex: 1,
  },
  transportHeaderZone: {
    gap: 12,
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
    // Lets a trailing spacer take exactly the leftover height on a short page.
    flexGrow: 1,
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
  // Full view: the progress thread IS the divider — no second hairline.
  transportFooterZoneNoDivider: {
    borderTopWidth: 0,
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
    // A playback progress hairline flows left→right — pinned LTR so the fill
    // doesn't grow from the right under a Hebrew UI.
    direction: "ltr",
    height: 3,
    backgroundColor: "#6f3d2d",
    marginHorizontal: -16,
  },
  miniMediaDockProgressFill: {
    height: 3,
    backgroundColor: "#E8B865",
  },
  // The single dock row: [ ≡ / n·n ] [ title/context …flex… ] [ ◀ ▶ ▶▶ ] [ ✕ ].
  // Queue at the start edge, the title absorbs the slack, transport and ✕ at
  // the end. A touch of extra vertical room lets the title carry both the clip
  // title and its context line when present.
  miniMediaDockRow: {
    // The dock mirrors with the language like Apple Music's mini player in
    // Hebrew (founder, 2026-10-26): queue and title at the start edge. Only
    // prev/play/next (miniMediaDockTransport) and the progress hairline stay
    // left to right.
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
    direction: "ltr",
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


  // inlineTimes removed

  playhead: {
    position: "absolute",
    top: -62,
    width: 2,
    height: 66,
    backgroundColor: colors.playhead,
    marginLeft: -1,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
