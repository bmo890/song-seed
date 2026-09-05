import { StyleSheet } from "react-native";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { styles as base } from "../../styles";

/**
 * Tuner face geometry. Everything hangs off the arc: a 240 pt semicircle whose
 * feet sit on a baseline; the ♭/♯ symbols and the cents boxes stack beneath
 * each foot, mirrored about the centre line, and the note reads between them.
 *
 *   y  20 ┌───────── arc top
 *   y 140 ├─ baseline (arc feet at x 30 / 270)
 *   y 154 │  ♭ / ♯ markers (centred on the feet)
 *   y 186 │  cents boxes  (centred on the feet, 60 wide)
 *   y 148 │  note letter + octave (centre)
 *   y 252 └─ Hz line
 */
const ARC_STAGE_WIDTH = 300;
const ARC_STAGE_HEIGHT = 276;
const ARC_TRACK_SIZE = 240;
const ARC_TRACK_STROKE = 4;
const ARC_TRACK_TOP = 20;
const ARC_TRACK_LEFT = (ARC_STAGE_WIDTH - ARC_TRACK_SIZE) / 2;
const ARC_SEMI_HEIGHT = ARC_TRACK_SIZE / 2;
const ARC_BASELINE = ARC_TRACK_TOP + ARC_SEMI_HEIGHT;
const ARC_INDICATOR_SIZE = 16;

/** x of the arc's left foot; the right foot mirrors at STAGE_WIDTH − this. */
const FOOT_X = ARC_TRACK_LEFT;
const MARKER_SIZE = 28;
const MARKER_TOP = ARC_BASELINE + 14;
const DETUNE_WIDTH = 60;
const DETUNE_HEIGHT = 30;
const DETUNE_TOP = MARKER_TOP + MARKER_SIZE + spacing.xs;

// Design system palette
const PAPER = "#fbf9f5"; // surface (legacy literal — matches base.screen paper)
const INK = colors.textPrimary;
const INK_MID = colors.textStrong;
const INK_MUTED = colors.textSecondary;
const DIVIDER = colors.borderMuted;

export type MeterTone = "idle" | "active" | "far" | "near" | "in_tune";

/**
 * The single colour for a meter state. Needle, cents box, ♭/♯ marker, status
 * dot and status label all read from here so the screen never disagrees with
 * itself about how far off the string is.
 */
export function toneColor(tone: MeterTone): string {
  switch (tone) {
    case "in_tune": return colors.tuneIn;
    case "near":    return colors.tuneNear;
    case "far":     return colors.tuneFar;
    case "active":  return colors.primary;
    default:        return DIVIDER;
  }
}

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
      // A tuner is a fixed instrument face: ♭ on the left, ♯ on the right, the
      // needle swinging flat→sharp. Pinned LTR (with logical insets below) so it
      // never mirrors under a Hebrew UI.
      direction: "ltr",
      width: ARC_STAGE_WIDTH,
      height: ARC_STAGE_HEIGHT,
      position: "relative",
    },
    arcTrack: {
      position: "absolute",
      top: ARC_TRACK_TOP,
      start: ARC_TRACK_LEFT,
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
    // Hairline centre tick at the top of the arc: the target the needle aims at.
    arcCenterTick: {
      position: "absolute",
      top: ARC_TRACK_TOP - 6,
      start: ARC_STAGE_WIDTH / 2 - 1,
      width: 2,
      height: 6,
      borderRadius: 1,
      backgroundColor: DIVIDER,
    },
    // Needle: an invisible pivot square centred on the arc, rotated by the
    // cents reading; the dot sits on its left edge so 0°→♭ end, 180°→♯ end.
    needlePivot: {
      position: "absolute",
      start: ARC_TRACK_LEFT + ARC_TRACK_STROKE / 2,
      top: ARC_TRACK_TOP + ARC_TRACK_STROKE / 2,
      width: ARC_TRACK_SIZE - ARC_TRACK_STROKE,
      height: ARC_TRACK_SIZE - ARC_TRACK_STROKE,
      pointerEvents: "none",
    },
    arcIndicator: {
      position: "absolute",
      start: -ARC_INDICATOR_SIZE / 2,
      top: (ARC_TRACK_SIZE - ARC_TRACK_STROKE) / 2 - ARC_INDICATOR_SIZE / 2,
      width: ARC_INDICATOR_SIZE,
      height: ARC_INDICATOR_SIZE,
      borderRadius: ARC_INDICATOR_SIZE / 2,
    },

    // ♭ / ♯ markers — centred under the arc's feet, mirrored.
    marker: {
      position: "absolute",
      top: MARKER_TOP,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    markerFlat:  { start: FOOT_X - MARKER_SIZE / 2 },
    markerSharp: { end: FOOT_X - MARKER_SIZE / 2 },
    markerText: {
      fontSize: 22,
      lineHeight: 26,
      fontFamily: "PlusJakartaSans_400Regular",
      color: DIVIDER,
    },

    // Cents boxes — fixed width, centred under the same feet as the markers so
    // "−12" and "+7" occupy identical footprints on either side.
    detuneBox: {
      position: "absolute",
      top: DETUNE_TOP,
      width: DETUNE_WIDTH,
      height: DETUNE_HEIGHT,
      borderRadius: radii.xs,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceHigh,
    },
    detuneBoxFlat:  { start: FOOT_X - DETUNE_WIDTH / 2 },
    detuneBoxSharp: { end: FOOT_X - DETUNE_WIDTH / 2 },
    detuneValue: {
      fontSize: 16,
      lineHeight: 20,
      fontFamily: "PlusJakartaSans_600SemiBold",
      fontVariant: ["tabular-nums"],
    },

    // Note display — below the baseline, between the two feet
    noteBlock: {
      position: "absolute",
      start: ARC_TRACK_LEFT + DETUNE_WIDTH / 2,
      top: ARC_BASELINE,
      width: ARC_TRACK_SIZE - DETUNE_WIDTH,
      height: ARC_STAGE_HEIGHT - ARC_BASELINE,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: spacing.sm,
    },
    noteRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "center",
    },
    noteText: {
      fontSize: 84,
      lineHeight: 96,
      fontFamily: "PlusJakartaSans_700Bold",
      color: INK,
      letterSpacing: -3,
    },
    octaveText: {
      marginTop: 10,
      marginStart: 4,
      fontSize: 40,
      lineHeight: 44,
      fontFamily: "PlusJakartaSans_400Regular",
      color: INK_MID,
    },
    hzInlineValue: {
      marginTop: spacing.sm,
      fontSize: 11,
      lineHeight: 14,
      fontFamily: "PlusJakartaSans_600SemiBold",
      fontVariant: ["tabular-nums"],
      color: INK_MUTED,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },

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
    },
    statusLabel: {
      fontSize: 11,
      fontFamily: "PlusJakartaSans_600SemiBold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
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
      color: colors.danger,
      fontFamily: "PlusJakartaSans_600SemiBold",
      textAlign: "center",
      maxWidth: 300,
    },
  }),
};
