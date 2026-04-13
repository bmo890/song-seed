import { StyleSheet } from "react-native";
import { spacing, text as textTokens } from "../../design/tokens";
import { styles as base } from "../../styles";

// Design system palette
const PAPER      = "#fbf9f5";
const SURFACE    = "#efeeea";
const SURFACE_LO = "#e4deda";
const TERRACOTTA = "#824f3f";
const INK        = "#1b1c1a";
const INK_MID    = "#524440";
const INK_MUTED  = "#84736f";
const DIVIDER    = "#d7c2bd";

export const styles = {
  ...StyleSheet.create({
    screen: { ...base.screen, backgroundColor: PAPER },
    pressDown: base.pressDown,
    pageContent: {
      paddingTop: spacing.lg,
      paddingBottom: 48,
      gap: spacing.xxl,
    },

    // Hero — warm surface, no border, no shadow
    heroSurface: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
      borderRadius: 4,
      backgroundColor: SURFACE,
    },

    // Pulse animation
    pulseStack: {
      width: 100,
      height: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    pulseHalo: {
      position: "absolute",
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "rgba(130, 79, 63, 0.18)",
    },
    pulseCore: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE_LO,
    },
    pulseCoreActive: {
      backgroundColor: TERRACOTTA,
    },
    pulseCoreMuted: {
      backgroundColor: SURFACE_LO,
    },

    // BPM display
    bpmValue: {
      fontSize: 72,
      lineHeight: 76,
      fontWeight: "700",
      color: INK,
      letterSpacing: -2,
    },
    bpmLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },

    // Start / Stop button — architectural, not pill
    primaryAction: {
      marginTop: spacing.sm,
      minWidth: 140,
      minHeight: 46,
      paddingHorizontal: spacing.xl,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: INK,
    },
    primaryActionStop: {
      backgroundColor: SURFACE_LO,
    },
    primaryActionDisabled: {
      opacity: 0.45,
    },
    primaryActionText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#ffffff",
      letterSpacing: 0.2,
    },
    primaryActionTextStop: {
      color: INK,
    },

    // Small status line below button
    statusLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    statusLabelRunning: {
      color: TERRACOTTA,
    },

    // Sections — separated by spacing, not borders
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: INK_MID,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    sectionMeta: {
      fontSize: 11,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.4,
    },

    // BPM nudge buttons — tonal, no border
    bpmStepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    stepButton: {
      minWidth: 62,
      minHeight: 40,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE,
    },
    stepButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: INK,
    },

    // Slider
    sliderLabels: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: -6,
    },
    sliderLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.4,
    },

    // Tap tempo
    tapRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    tapButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE,
    },
    tapButtonActive: {
      backgroundColor: SURFACE_LO,
    },
    tapButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: INK,
    },
    tapResetButton: {
      minWidth: 80,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE,
    },
    tapResetButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: INK_MID,
    },
    tapCountLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      textAlign: "center",
    },

    // Output toggles — tonal, no border
    outputRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    outputToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 40,
      paddingHorizontal: spacing.lg,
      borderRadius: 4,
      backgroundColor: SURFACE,
    },
    outputToggleActive: {
      backgroundColor: INK,
    },
    outputToggleText: {
      fontSize: 14,
      fontWeight: "600",
      color: INK_MID,
    },
    outputToggleTextActive: {
      color: "#ffffff",
    },

    // Level sliders
    levelGroup: {
      gap: spacing.sm,
    },
    levelHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    levelTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: INK_MID,
    },
    levelMeta: {
      fontSize: 11,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.4,
    },
    levelTrackLabels: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: -6,
    },

    // Meter chips — same pattern as output toggles
    divider: {
      height: 0.5,
      backgroundColor: DIVIDER,
      opacity: 0.5,
    },

    helperText: {
      fontSize: 13,
      color: INK_MUTED,
      lineHeight: 20,
    },
  }),
};
