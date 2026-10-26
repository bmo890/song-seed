import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii, text } from "../design/tokens";

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
  // A SECTION LABEL, in the page's own voice. It used to be an 18pt bold heading —
  // the second-loudest thing on the screen after the clock and the title, for a
  // collapsed secondary affordance — and the same panel in the full player already
  // renders it as an uppercase eyebrow. "RECORDING INTO", "READY" and "GUIDE" are all
  // eyebrows here too, so this was the one label speaking in a different register.
  // Findability comes from the row and its chevron, not from type size.
  recordingLyricsTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  // Expanded: the label steps back further still — the lyrics are the content now.
  recordingLyricsTitleExpanded: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.0,
    color: colors.textMuted,
  },
  recordingLyricsMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  recordingLyricsToggleBtn: {
    backgroundColor: "transparent",
    borderWidth: 0,
    width: 28,
    height: 28,
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
    marginEnd: -28,
    paddingEnd: 8,
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
  // BARE GLYPHS. "The record button is the only circle on this page" is this screen's own
  // rule — the header's metronome, sliders, help and overflow are all unringed glyphs, and
  // these three sat in tinted grey circles next to a bare chevron. The touch target stays
  // 34pt; only the fill goes. State is carried by ink (primaryDeep when active), the same
  // way the metronome glyph carries its own on state.
  recordingLyricsZoomBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingLyricsZoomBtnActive: {},
  // Speed readout button — same footprint as the icon buttons beside it.
  recordingLyricsSpeedBtn: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingLyricsSpeedBtnText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textSecondary,
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
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  // Tonal wash + deep terracotta text, not a solid primary fill: a speed option is not
  // the page's highest-stakes commit, and solid `primary` is reserved for that.
  recordingLyricsSpeedRowItemActive: {
    backgroundColor: colors.primarySurface,
  },
  recordingLyricsSpeedRowText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  recordingLyricsSpeedRowTextActive: {
    color: colors.primaryDeep,
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
  // Lora, like the full player's lyrics — the same words should not change typeface
  // depending on which screen you are reading them from. Lora is the editorial face this
  // app uses for content, and lyrics are content whether you are reading them or singing
  // them. (RTL swaps it to Frank Ruhl Libre at load, so Hebrew follows automatically.)
  // Generous leading is kept: this is read at arm's length, mid-take.
  recordingLyricsText: {
    ...text.cardTitle,
    fontSize: 20,
    lineHeight: 36,
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
  // Paper, not a card: the guide is the upper register of one page, not a widget
  // sitting on it. Full-bleed like the tape below so the two read as one scene.
  recordingGuideCard: {
    marginHorizontal: -28,
    paddingHorizontal: 28,
    gap: 6,
  },
  recordingGuideHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 18,
  },
  recordingGuideEyebrow: {
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  recordingGuideTimingText: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
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
    color: colors.textPrimary,
    letterSpacing: -1.1,
    marginTop: 0,
    // Without this the whole clock shuffles sideways every time a digit changes
    // width — at 44pt it's the most visible thing on the page.
    fontVariant: ["tabular-nums"],
    // Digits are direction-neutral, so `auto` leaves the clock stranded on the
    // left under RTL while everything around it mirrors. RN swaps left→right in
    // RTL, so asking for "left" lands it on the reading edge either way.
    textAlign: "left",
  },
  recordingTimerCompact: {
    fontSize: 36,
    marginTop: 0,
  },
  recordingCountInBlock: {
    gap: 10,
    paddingVertical: 10,
  },
  recordingCountInDotsRow: {
    // Beats progress 1→N through TIME, which never mirrors — same rule as
    // MetronomeBeatBar. Without this a Hebrew count-in fills backwards.
    direction: "ltr",
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
  // Quiet metadata, not a headline: the app says this kind of thing in 11pt
  // letterspaced caps everywhere else (SKETCH, TAKES, PRIMARY). A 15pt dot next
  // to 15pt sentence case was the loudest label on a page that isn't doing
  // anything yet.
  recordingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
  },
  recordingStatusDotActive: {
    backgroundColor: colors.record,
  },
  recordingStatusDotIdle: {
    // Was borderMuted — a warm pink that pre-announced recording while idle.
    backgroundColor: colors.textMuted,
  },
  recordingStatusText: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  // Paper, not a display. The reel used to sit on a grey slab, which read as a
  // dead box before you'd recorded anything; the centre rule, the time ticks and
  // the parked playhead are what say "ready".
  liveWaveWrap: {
    marginTop: 0,
    marginBottom: 0,
    marginHorizontal: -28,
    backgroundColor: "transparent",
    borderRadius: 0,
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
  recordingScreenLive: {
    backgroundColor: colors.recordSurface,
  },
  // Discard · Record · Save is the recorder's transport: it stays left to right in
  // Hebrew, like the player's controls (founder, 2026-10-26).
  recordingControlsBar: {
    direction: "ltr",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordingControlsBarCompact: {
    gap: 12,
  },
  recordingOutputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 56,
  },
  recordingOutputCopy: {
    flex: 1,
    gap: 1,
  },
  recordingOutputLabel: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textPrimary,
  },
  recordingOutputValue: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  // Bare glyph + word. The record button is the only circle on this page, so
  // the secondary actions read as ink and can't compete with it. Fixed height
  // so waking them up (once there's a take) never moves the dock.
  circleControlBtn: {
    // A fixed key width so the side columns can space their keys evenly; the
    // dock is edge to edge now, so two keys and their breathing room fit beside
    // the record button in English and Hebrew. Labels stay single-line.
    width: 60,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  circleControlBtnCompact: {
    minHeight: 40,
  },
  controlBtnLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 9.5,
    lineHeight: 12,
    textAlign: "center",
    color: colors.textSecondary,
  },
  controlBtnLabelDanger: {
    color: colors.danger,
  },
  circleControlBtnDisabled: {
    opacity: 0.32,
  },
  recordBtnWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  // One circle, one ring: the 8px grey collar drew a second circle around the
  // only circle on the page. The record red carries it on its own.
  circleRecordBtn: {
    width: 88,
    height: 88,
    borderRadius: radii.round,
    backgroundColor: colors.record,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B5483A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  // A plain smaller circle. It carried `borderWidth: 5` with NO borderColor, which React
  // Native renders BLACK — a hard black ring around the record button, on a page whose
  // rule is that there is no pure black anywhere. Leftover from the 8px collar removed
  // just below; the width outlived the colour.
  circleRecordBtnCompact: {
    width: 60,
    height: 60,
    borderRadius: radii.round,
  },
  // The armed/live state is carried by the glyph (mic → pause) and by the page
  // wash. It used to add an 8px collar, which put a second circle around the
  // one circle the page is allowed.
  circleRecordBtnActive: {},
  circleRecordBtnDisabled: {
    backgroundColor: "#CDA89E",
    opacity: 0.72,
  },
  recordingInputCard: {
    gap: 10,
    marginBottom: 4,
  },
  // Named like every sheet: Jakarta, 15, semibold.
  recordingSettingsTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  recordingInputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recordingInputHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  recordingInputTitle: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  // A bare ink glyph, no disc.
  recordingInputRefreshBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingInputOptionList: {
    gap: 0,
  },
  // Rows on paper: hairlines, the one in use marked by its radio.
  recordingInputOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  recordingInputOptionActive: {},
  recordingInputOptionDisabled: {
    opacity: 0.55,
  },
  // No flex here: it sits in a column (label over its cost line), where flex
  // stretched a lone label to the column's height and set it off centre.
  recordingInputOptionText: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textPrimary,
  },
  recordingInputOptionTextActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
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
  // Edge to edge: the screen shell insets 16 and the dock reaches back out of
  // it, so the transport rests on the page's floor instead of floating as a
  // card inside it.
  recordingBottomDock: {
    marginHorizontal: -16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "rgba(253,251,247,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#E8E4DF",
  },
  /** Fixed row for the beat dots, held from the moment the metronome is armed. The height
   *  matches MetronomeBeatBar's compact row so mounting the dots changes nothing. */
  recordingBeatBarSlot: {
    height: 16,
    justifyContent: "center",
  },
  recordingBottomDockCompact: {
    paddingTop: 4,
    paddingBottom: 6,
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
