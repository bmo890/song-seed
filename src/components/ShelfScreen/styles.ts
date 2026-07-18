import { StyleSheet } from "react-native";
import { styles as base } from "../../styles";
import { colors, radii } from "../../design/tokens";

const PAPER = "#fbf9f5";
/** Blush chrome for the "leaving soon" decision card — the same warm tint the
 *  app uses for active/selected states. */
const BLUSH = "#FDF5F2";
const BLUSH_LINE = "#EBD3CE";

export const shelfStyles = {
  screen: { ...base.screen, backgroundColor: PAPER },

  ...StyleSheet.create({
    scrollContent: {
      paddingBottom: 120,
      gap: 4,
    },

    pageDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 14,
    },

    sectionLabel: {
      fontSize: 11,
      fontFamily: "PlusJakartaSans_700Bold",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.textSecondary,
      marginTop: 18,
      marginBottom: 10,
    },
    sectionLabelCount: {
      color: colors.textMuted,
      letterSpacing: 0,
    },

    feedList: {
      gap: 10,
    },

    emptyLine: {
      fontSize: 13,
      lineHeight: 19,
      color: "#b4a79f",
      paddingTop: 4,
    },

    // ── Item footer (source · countdown) ─────────────────────────────────
    itemFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      minHeight: 16,
    },
    itemSource: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      flexShrink: 1,
      minWidth: 0,
    },
    itemSourceText: {
      fontSize: 10,
      fontFamily: "PlusJakartaSans_500Medium",
      color: colors.textMuted,
      flexShrink: 1,
    },
    itemCountdown: {
      fontSize: 10,
      fontFamily: "PlusJakartaSans_600SemiBold",
      color: colors.textMuted,
      fontVariant: ["tabular-nums"],
    },
    itemCountdownSoon: {
      color: colors.primaryDeep,
    },

    // ── "Leaving shelf" decision card ────────────────────────────────────
    decisionCard: {
      backgroundColor: BLUSH,
      borderWidth: 1,
      borderColor: BLUSH_LINE,
      borderRadius: radii.lg,
      padding: 12,
    },
    decisionEyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 4,
    },
    decisionEyebrow: {
      fontSize: 9,
      fontFamily: "PlusJakartaSans_700Bold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.primaryDeep,
    },
    decisionCardBody: {
      backgroundColor: "transparent",
      borderWidth: 0,
      shadowOpacity: 0,
      elevation: 0,
      paddingHorizontal: 0,
      marginBottom: 0,
    },
    decisionActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
    },
    decisionKeepBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.round,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    decisionKeepText: {
      fontSize: 12,
      fontFamily: "PlusJakartaSans_600SemiBold",
      color: colors.onPrimary,
    },
    decisionLeaveBtn: {
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: radii.round,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    decisionLeaveText: {
      fontSize: 12,
      fontFamily: "PlusJakartaSans_600SemiBold",
      color: colors.textStrong,
    },

    // ── "Recently left the shelf" rows ───────────────────────────────────
    departedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surfaceContainer,
      borderRadius: radii.lg,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    departedTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontFamily: "PlusJakartaSans_500Medium",
      color: colors.textSecondary,
    },
    departedWhen: {
      fontSize: 10,
      fontFamily: "PlusJakartaSans_500Medium",
      color: colors.textMuted,
      fontVariant: ["tabular-nums"],
    },
    departedReshelve: {
      fontSize: 11,
      fontFamily: "PlusJakartaSans_700Bold",
      color: colors.primaryDeep,
    },
    departedCaption: {
      fontSize: 10,
      lineHeight: 15,
      color: colors.textMuted,
      marginTop: 8,
      paddingHorizontal: 2,
    },
  }),
};
