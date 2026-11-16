import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";
import { styles as base } from "../../styles";

/**
 * Standalone Metronome page, "look up, touch down" (2026-11-16): the display
 * (beat dots, the tempo, its marking), the practice pattern, and the pinned deck
 * (− slider +, then Tap · the round transport key · Meter).
 */
export const styles = StyleSheet.create({
  screen: base.screen,
  pageContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  // The display fills the room the pattern leaves and sits centred in it.
  display: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  // The tempo, said once: Lora, large, tabular.
  bpmValue: {
    fontFamily: "Lora_500Medium",
    fontSize: 88,
    lineHeight: 96,
    color: colors.textPrimary,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    minWidth: 150,
    textAlign: "center",
  },
  tempoReadout: {
    alignItems: "center",
  },
  bpmUnit: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  bpmMarking: {
    fontFamily: "Lora_500Medium_Italic",
    fontSize: 17,
    color: colors.textSecondary,
  },
  // Tap · play · Meter: the transport between its two ink keys.
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  // The full player's transport: a round key, solid because it is THE action.
  transport: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: radii.round,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  transportDisabled: {
    opacity: 0.45,
  },
  // Optical centre: a play triangle sits right of the box centre.
  playGlyph: {
    marginStart: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textMuted,
    textAlign: "center",
  },
  pattern: {
    gap: spacing.md,
  },
  patternBody: {
    paddingTop: spacing.xs,
  },
  practiceAccessory: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  // The deck, pinned under the scroll: tempo over the transport, on the page gutter.
  deck: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  tempoDeck: {
    alignSelf: "stretch",
  },
  sliderWrap: {
    flex: 1,
  },
  sheetTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
