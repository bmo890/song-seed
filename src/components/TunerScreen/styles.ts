import { StyleSheet } from "react-native";
import { colors, shadows, spacing, text as textTokens } from "../../design/tokens";
import { styles as base } from "../../styles";

const ARC_STAGE_WIDTH = 300;
const ARC_TRACK_SIZE = 240;
const ARC_TRACK_STROKE = 4;
const ARC_TRACK_TOP = 96;
const ARC_TRACK_LEFT = (ARC_STAGE_WIDTH - ARC_TRACK_SIZE) / 2;
const ARC_CUTOUT_WIDTH = 118;
const ARC_CUTOUT_HEIGHT = 82;
const ARC_CUTOUT_BOTTOM = 22;
const ARC_INDICATOR_SIZE = 16;
const ARC_SIDE_LABEL_TOP = ARC_TRACK_TOP + ARC_TRACK_SIZE / 2 - 16;

export const styles = {
  ...StyleSheet.create({
    screen: base.screen,
    pageContent: {
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl + spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      flexGrow: 1,
      gap: spacing.lg,
    },
    dialSection: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      marginTop: -100,
    },
    arcStage: {
      width: ARC_STAGE_WIDTH,
      height: ARC_STAGE_WIDTH,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    arcTrack: {
      position: "absolute",
      top: ARC_TRACK_TOP,
      left: ARC_TRACK_LEFT,
      width: ARC_TRACK_SIZE,
      height: ARC_TRACK_SIZE,
      borderRadius: ARC_TRACK_SIZE / 2,
      borderWidth: ARC_TRACK_STROKE,
      borderColor: "#e2e8f0",
      backgroundColor: "transparent",
    },
    arcCutout: {
      position: "absolute",
      left: (ARC_STAGE_WIDTH - ARC_CUTOUT_WIDTH) / 2,
      bottom: ARC_CUTOUT_BOTTOM,
      width: ARC_CUTOUT_WIDTH,
      height: ARC_CUTOUT_HEIGHT,
      borderTopLeftRadius: ARC_CUTOUT_WIDTH / 2,
      borderTopRightRadius: ARC_CUTOUT_WIDTH / 2,
      backgroundColor: colors.page,
    },
    arcIndicator: {
      position: "absolute",
      width: ARC_INDICATOR_SIZE,
      height: ARC_INDICATOR_SIZE,
      borderRadius: ARC_INDICATOR_SIZE / 2,
      borderWidth: 0,
    },
    indicatorIdle: { backgroundColor: "#cbd5e1" },
    indicatorActive: { backgroundColor: "#60a5fa" },
    indicatorNear: { backgroundColor: "#f97316" },
    indicatorFar: { backgroundColor: "#ef4444" },
    indicatorInTune: { backgroundColor: "#22c55e" },
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
      fontSize: 24,
      fontWeight: "400",
      color: "#64748b",
    },
    noteBlock: {
      position: "absolute",
      left: ARC_TRACK_LEFT,
      top: ARC_TRACK_TOP,
      width: ARC_TRACK_SIZE,
      height: ARC_TRACK_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    noteRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "center",
    },
    noteText: {
      fontSize: 90,
      lineHeight: 104,
      fontWeight: "600",
      color: "#1e293b",
      letterSpacing: -3,
    },
    octaveText: {
      marginTop: 8,
      marginLeft: 4,
      fontSize: 48,
      lineHeight: 48,
      fontWeight: "500",
      color: "#1e293b",
    },
    hzInlineValue: {
      marginTop: spacing.md,
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "500",
      color: "#1e293b",
    },
    detuneAbsolute: {
      position: "absolute",
      top: ARC_TRACK_TOP + 10,
      right: 0,
      paddingHorizontal: 16,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#ffffff",
      ...shadows.control,
      elevation: 3,
    },
    detuneAbsoluteNear: { borderWidth: 0 },
    detuneAbsoluteFar: { borderWidth: 0 },
    detuneChipValueNear: { color: "#f97316" },
    detuneChipValueFar: { color: "#ef4444" },
    detuneChipValue: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "600",
    },
    helperText: {
      ...textTokens.supporting,
      textAlign: "center",
      maxWidth: 280,
    },
    errorText: {
      ...textTokens.supporting,
      color: "#b91c1c",
      fontWeight: "700",
      textAlign: "center",
      maxWidth: 300,
    },
  }),
};
