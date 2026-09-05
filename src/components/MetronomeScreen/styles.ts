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
    fontFamily: "Lora_600SemiBold",
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
  },
  // Metadata under the readout, not a title: Jakarta, muted, one word.
  tempoMarking: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textMuted,
    letterSpacing: 0.4,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  // Soft key like every other text button; it keeps its size and solid fill
  // because it is genuinely THE action on this page.
  primaryAction: {
    marginTop: spacing.lg,
    minWidth: 168,
    minHeight: 46,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDeep,
  },
  /** The disclosure chevron sits beside the value pill, not out at the edge. */
  disclosureRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  primaryActionDisabled: {
    opacity: 0.45,
  },
  primaryActionText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
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
