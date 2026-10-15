import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";
import { styles as base } from "../../styles";

/**
 * Standalone Metronome page (2026-10-15, "the instrument"): the hero (beat
 * dots, the tempo between − / +, its marking), the tempo slider, Tap, one
 * round transport key, then two rows (Meter, Sound) that open sheets.
 */
export const styles = StyleSheet.create({
  screen: base.screen,
  pageContent: {
    flexGrow: 1,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  tempoStepper: {
    gap: spacing.xl,
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
  bpmCaption: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
  },
  bpmUnit: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  tapRow: {
    alignItems: "center",
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
    marginTop: spacing.sm,
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
  // Pushes the two rows to the foot of the screen.
  spacer: {
    flexGrow: 1,
    minHeight: spacing.xl,
  },
  rowValue: {
    maxWidth: 190,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
  },
  sheetTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
