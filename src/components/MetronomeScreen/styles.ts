import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";
import { styles as base } from "../../styles";

/**
 * Standalone Metronome page — one-screen layout built on the shared metronome
 * blocks (common/metronome/MetronomeBlocks). Only the hero (pulse + BPM readout
 * + start/stop) is page-specific; everything else uses the shared `ms` styles.
 */
export const styles = StyleSheet.create({
  screen: base.screen,
  pageContent: {
    flexGrow: 1,
    paddingTop: spacing.sm,
    paddingBottom: 24,
    paddingHorizontal: 4,
  },

  // Hero — pulse, BPM readout, beat bar, start/stop
  hero: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: 2,
  },
  pulseStack: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  pulseHalo: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  pulseCore: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    backgroundColor: colors.borderSubtle,
  },
  pulseCoreActive: {
    backgroundColor: colors.primary,
  },
  pulseCoreMuted: {
    backgroundColor: colors.borderSubtle,
  },
  bpmValue: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 64,
    lineHeight: 68,
    color: colors.textPrimary,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  bpmUnit: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textMuted,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  primaryAction: {
    marginTop: spacing.lg,
    minWidth: 168,
    minHeight: 46,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDeep,
  },
  primaryActionStop: {
    backgroundColor: colors.surfaceContainer,
  },
  primaryActionDisabled: {
    opacity: 0.45,
  },
  primaryActionText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  primaryActionTextStop: {
    color: colors.primaryDeep,
  },
  statusLabel: {
    marginTop: spacing.md,
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textMuted,
    letterSpacing: 0.4,
    textAlign: "center",
  },

  // Vertical rhythm between the sheet-vocabulary sections
  sectionGap: {
    marginTop: spacing.lg,
  },
});
