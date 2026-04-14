import { StyleSheet } from "react-native";
import { spacing, text as textTokens } from "../../design/tokens";
import { styles as base } from "../../styles";

const ARC_STAGE_WIDTH = 300;
const ARC_STAGE_HEIGHT = 280;
const ARC_TRACK_SIZE = 240;
const ARC_TRACK_STROKE = 4;
const ARC_TRACK_TOP = 20;
const ARC_TRACK_LEFT = (ARC_STAGE_WIDTH - ARC_TRACK_SIZE) / 2;
const ARC_SEMI_HEIGHT = ARC_TRACK_SIZE / 2;
const ARC_INDICATOR_SIZE = 16;
const ARC_SIDE_LABEL_TOP = ARC_TRACK_TOP + ARC_SEMI_HEIGHT - 16;

// Design system palette
const PAPER      = "#fbf9f5"; // surface
const SURFACE    = "#efeeea"; // surface-container
const TERRACOTTA = "#824f3f"; // primary accent
const INK        = "#1b1c1a"; // on-surface (warm charcoal, not pure black)
const INK_MID    = "#524440"; // on-surface-variant
const INK_MUTED  = "#84736f"; // outline
const DIVIDER    = "#d7c2bd"; // outline-variant

export const styles = {
  ...StyleSheet.create({
    screen: { ...base.screen, backgroundColor: PAPER },
    pageContent: {
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl + spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      flexGrow: 1,
      gap: spacing.xxl,
    },

    // Arc layout
    dialSection: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    arcStage: {
      width: ARC_STAGE_WIDTH,
      height: ARC_STAGE_HEIGHT,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    arcTrack: {
      position: "absolute",
      top: ARC_TRACK_TOP,
      left: ARC_TRACK_LEFT,
      width: ARC_TRACK_SIZE,
      height: ARC_SEMI_HEIGHT,
      borderTopLeftRadius: ARC_TRACK_SIZE / 2,
      borderTopRightRadius: ARC_TRACK_SIZE / 2,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopWidth: ARC_TRACK_STROKE,
      borderLeftWidth: ARC_TRACK_STROKE,
      borderRightWidth: ARC_TRACK_STROKE,
      borderBottomWidth: 0,
      borderColor: DIVIDER,
      backgroundColor: "transparent",
    },
    arcTrackInTune: {
      borderColor: "#4a7c5e",
    },
    arcIndicator: {
      position: "absolute",
      width: ARC_INDICATOR_SIZE,
      height: ARC_INDICATOR_SIZE,
      borderRadius: ARC_INDICATOR_SIZE / 2,
    },

    // Indicator states — warm palette, no bright saturated colors
    indicatorIdle:   { backgroundColor: DIVIDER },
    indicatorActive: { backgroundColor: "#b5968d" },   // warm taupe: signal present, no note yet
    indicatorNear:   { backgroundColor: "#c07840" },   // earthy amber: close but not there
    indicatorFar:    { backgroundColor: "#a04545" },   // muted earthy red: far off
    indicatorInTune: { backgroundColor: "#4a7c5e" },   // muted sage green: universal "in tune" signal

    // ± side markers
    flatMarker: {
      position: "absolute",
      left: -20,
      top: ARC_SIDE_LABEL_TOP,
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    sharpMarker: {
      position: "absolute",
      right: -20,
      top: ARC_SIDE_LABEL_TOP,
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    markerText: {
      fontSize: 22,
      fontWeight: "300",
      color: DIVIDER,
    },

    // Note display — below the semicircle
    noteBlock: {
      position: "absolute",
      left: ARC_TRACK_LEFT,
      top: ARC_TRACK_TOP + ARC_SEMI_HEIGHT,
      width: ARC_TRACK_SIZE,
      height: ARC_STAGE_HEIGHT - (ARC_TRACK_TOP + ARC_SEMI_HEIGHT),
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 12,
    },
    noteRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "center",
    },
    noteText: {
      fontSize: 90,
      lineHeight: 104,
      fontWeight: "700",
      color: INK,
      letterSpacing: -3,
    },
    octaveText: {
      marginTop: 10,
      marginLeft: 4,
      fontSize: 44,
      lineHeight: 48,
      fontWeight: "400",
      color: INK_MID,
    },
    hzInlineValue: {
      marginTop: spacing.md,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },

    // Detune badge — tonal surface, no shadow
    detuneAbsolute: {
      position: "absolute",
      top: ARC_TRACK_TOP + ARC_SEMI_HEIGHT / 2 - 18,
      paddingHorizontal: 14,
      height: 36,
      borderRadius: 2,              // nearly square — architectural
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE,    // surface-container — tonal layering, no shadow
    },
    detuneAbsoluteFlat:  { left: 0 },
    detuneAbsoluteSharp: { right: 0 },
    detuneAbsoluteNear: {},
    detuneAbsoluteFar: {},
    detuneChipValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "600",
    },
    detuneChipValueNear: { color: "#c07840" },
    detuneChipValueFar:  { color: "#a04545" },

    // Status row below the dial
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: DIVIDER,
    },
    statusDotActive: {
      backgroundColor: TERRACOTTA,
    },
    statusDotInTune: {
      backgroundColor: "#4a7c5e",
    },
    statusLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: INK_MUTED,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    statusLabelInTune: {
      color: "#4a7c5e",
    },

    // Helper + error text
    helperText: {
      ...textTokens.supporting,
      color: INK_MUTED,
      textAlign: "center",
      maxWidth: 260,
      lineHeight: 22,
    },
    errorText: {
      ...textTokens.supporting,
      color: "#a04545",
      fontWeight: "600",
      textAlign: "center",
      maxWidth: 300,
    },
  }),
};
