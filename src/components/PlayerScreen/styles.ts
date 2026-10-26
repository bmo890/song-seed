import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";

export const playerScreenStyles = StyleSheet.create({
  screen: {
    backgroundColor: colors.page,
  },
  headerBlock: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Generic "pressed" dim, borrowed by several reel-toolbar controls below.
  overflowButtonPressed: {
    opacity: 0.7,
  },
  // Ink, not record-red: nothing is recording yet (colour is scarce).
  // Record-red: Layer records (founder, 2026-10-20), the recorder's own colour.
  layerKeyDot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
    backgroundColor: colors.record,
  },
  titleBlock: {
    gap: 6,
  },
  // Title + overflow share the first content row; ⋯ hangs on the title's
  // first line even when the title wraps.
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  titleFlex: {
    flex: 1,
    marginEnd: 8,
  },
  title: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 23,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  // Clip title sits inline in the nav row (between back and the right controls).
  navTitle: {
    flex: 1,
    marginHorizontal: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  // Row under the reel that holds the Tools toggle (and leaves room for reel-side controls).
  // Sits close under the tape it acts on (founder, 2026-10-20).
  reelToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  // Ink keys (Layer, Tools) stand apart by space, not by boxes.
  reelToolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
  },
  // The reading bar holds more keys than the listening bar, so they sit closer.
  readingToolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reelToolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stickyReel: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 6,
    backgroundColor: colors.page,
  },
  // The reading bar is ink (2026-10-18, aligned with the songbook reader):
  // glyph + word, no fill, no box, like every toolbar key beside others.
  reelExpandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  reelExpandText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
  },
  readingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
  },
  readingChipActive: {},
  readingChipText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
  },
  readingChipTextActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
  readingIconButton: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  readingAaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
  },
  readingAaGlyph: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 18,
    letterSpacing: -0.5,
    color: colors.textStrong,
  },
  readingAaKey: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.primaryDeep,
    fontVariant: ["tabular-nums"],
  },
  // The take's-page row above the reader: one whispered line naming which
  // version holds the page, one quiet action to flip.
  lyricsVersionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 6,
  },
  lyricsVersionText: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textMuted,
  },
  lyricsVersionAction: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.primaryDeep,
    marginStart: "auto",
  },
  // Full view's hairline stand-in for the reel: position as a quiet thread.
  // The thread IS the footer's top border (the zone's own hairline stands down
  // via footerDivider={false}): full-bleed, flush with the zone's top edge,
  // unfilled track in the border's grey. The row below it is the touch target.
  // Time: the fill and the seek point both run left to right in Hebrew too. It
  // mirrored before, so the fill grew from the right while a tap seeked from the left.
  progressThreadRow: {
    direction: "ltr",
    marginHorizontal: -16,
    marginTop: -6,
    paddingBottom: 12,
    justifyContent: "flex-start",
  },
  progressThreadTrack: {
    height: 2,
    backgroundColor: colors.borderSubtle,
    overflow: "hidden",
  },
  progressThreadFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
  reelTimingRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 2,
  },
  reelTimingText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  metaDot: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  metaSpacer: {
    flexGrow: 1,
  },
  timingText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  content: {
    flexGrow: 1, // fills the sheet so the dismiss spacer below the doors has height
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  // Reading fills the body so the lyrics get every spare pixel.
  followContent: {
    flex: 1,
  },
  footerStack: {
    gap: 8,
  },
  waveformSection: {
    gap: 6,
    marginHorizontal: -14,
  },
  waveformShell: {
    position: "relative",
  },
  // The listening page under the toolbar: note, air, then the pages on the
  // floor of the body, just above the transport.
  listenStack: {
    flex: 1,
  },
  // ─── Practice tools (console: tool selector + inspector) ────────────────────
  toolList: {
    gap: 8,
    marginTop: 2,
  },
  // A section kind to pick is a word in ink led by its section-ink dot
  // (2026-10-20, the multi-select ink language): no chip fill, no stadium.
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 40,
    paddingEnd: spacing.md,
  },
  sectionChipText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  sectionSwatch: {
    width: 9,
    height: 9,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
  },
  sectionEditInput: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pinNameCount: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  pinNameCountOver: {
    color: colors.danger,
  },
  pinDetailNoteInput: {
    marginTop: 8,
    minHeight: 64,
    textAlignVertical: "top",
    paddingTop: 9,
  },
  sectionModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(27, 28, 26, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  sectionModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
  },
  sectionModalTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  sectionModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.sm,
  },
  // The quiet ink link beside Cancel: a word, no outline.
  sectionModalNewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 38,
    alignSelf: "flex-start",
  },
  sectionModalNewText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primaryDeep,
  },
  sectionModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  sectionModalCancel: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionModalCancelText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  sectionModalConfirm: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionModalConfirmDisabled: {
    opacity: 0.4,
  },
  sectionModalConfirmText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primaryDeep,
  },
  sectionPickerFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionModalDelete: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: colors.dangerSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionDetailPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sectionDetailSwatch: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
  },
  sectionInkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  sectionInkSwatch: {
    width: 38,
    height: 30,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionInkSwatchActive: {
    borderColor: colors.primaryDeep,
    backgroundColor: colors.primarySurface,
  },
  sectionInkFill: {
    width: 22,
    height: 4,
    borderRadius: 2,
  },
  sectionDetailPreviewText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
});
