import { StyleSheet } from "react-native";
import { styles as base } from "../../styles";
import { radii, colors } from "../../design/tokens";

const PAPER = "#fbf9f5";
const SURFACE = "#efeeea";
const SURFACE_LO = "#e4deda";
const TERRACOTTA = colors.primaryDeep;
const INK = colors.textPrimary;
const INK_LO = "#4a3f3b";
const MUTED = colors.textSecondary;

export const revisitStyles = {
  screen: { ...base.screen, backgroundColor: PAPER },

  ...StyleSheet.create({
    scrollContent: {
      paddingBottom: 120,
      gap: 18,
    },

    // A quiet, on-brand rule between sections — sits centered in the generous
    // inter-section gap so the page reads as distinct, unhurried chapters.
    sectionDivider: {
      height: 1,
      backgroundColor: "#EAE3D9",
    },

    // ── Sources filter panel ──────────────────────────────────────────────
    utilityButton: {
      borderRadius: 4,
      backgroundColor: SURFACE_LO,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    utilityButtonText: {
      fontSize: 12,
      fontFamily: "PlusJakartaSans_700Bold",
      color: INK,
    },

    // ── Restore hidden ────────────────────────────────────────────────────
    hiddenResetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      paddingTop: 2,
    },
    hiddenResetText: {
      fontSize: 12,
      fontFamily: "PlusJakartaSans_700Bold",
      color: TERRACOTTA,
    },

    // ── Section blocks ────────────────────────────────────────────────────
    sectionWrap: {
      gap: 10,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 9,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionActionButton: {
      borderRadius: 4,
      backgroundColor: SURFACE_LO,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    sectionActionText: {
      fontSize: 12,
      fontFamily: "PlusJakartaSans_700Bold",
      color: INK,
    },

    // ── Empty states (override styles.card) ──────────────────────────────
    emptyStateCard: {
      backgroundColor: SURFACE,
      borderWidth: 0,
      borderRadius: 6,
      shadowOpacity: 0,
      elevation: 0,
    },

    // ── Header help + sources chip (redesign) ────────────────────────────
    headerHelpBtn: {
      width: 34,
      height: 34,
      borderRadius: radii.round,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE,
    },

    // ── Sources sheet ─────────────────────────────────────────────────────
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sheetTitle: {
      fontFamily: "PlayfairDisplay_600SemiBold",
      fontSize: 19,
      color: INK,
    },
    sheetList: {
      gap: 10,
    },

    // ── Section header (redesign) ─────────────────────────────────────────
    sectionHeaderCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    sectionTitleSerif: {
      fontFamily: "PlayfairDisplay_600SemiBold",
      fontSize: 19,
      color: INK,
    },
    sectionSubShort: {
      fontSize: 12,
      lineHeight: 16,
      color: MUTED,
      paddingLeft: 24,
    },
    sectionGoBtn: {
      marginLeft: "auto",
    },
    sectionGoText: {
      fontSize: 13,
      fontFamily: "PlusJakartaSans_700Bold",
      color: TERRACOTTA,
    },
    sectionEmptyLine: {
      fontSize: 13,
      color: "#b4a79f",
      paddingLeft: 1,
    },

    // ── Feed card detail row ──────────────────────────────────────────────
    cardTagDetail: {
      flex: 1,
      fontSize: 12,
      color: "#9a8b83",
    },

    // ── "Today" hook ──────────────────────────────────────────────────────
    pageHeader: {
      gap: 6,
    },
    pageDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: MUTED,
    },
    todayRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    todayEyebrow: {
      fontFamily: "PlusJakartaSans_600SemiBold",
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: TERRACOTTA,
    },
    todayCount: {
      fontSize: 12,
      color: MUTED,
      fontVariant: ["tabular-nums"],
    },
    feedList: {
      gap: 14,
    },

    // ── Customize sheet extras ────────────────────────────────────────────
    sheetSectionLabel: {
      fontSize: 11,
      fontFamily: "PlusJakartaSans_700Bold",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: MUTED,
      marginTop: 18,
      marginBottom: 10,
    },
    sheetSectionDesc: {
      marginTop: -6,
      marginBottom: 12,
      fontSize: 12,
      lineHeight: 16,
      color: "#9a8b83",
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 8,
    },
    toggleIconWrap: {
      width: 20,
      alignItems: "flex-start",
    },
    toggleRowTextCol: {
      flex: 1,
      gap: 2,
    },
    toggleRowText: {
      fontSize: 15,
      color: INK,
      fontFamily: "PlusJakartaSans_600SemiBold",
    },
    toggleRowDesc: {
      fontSize: 12,
      lineHeight: 16,
      color: MUTED,
    },

    // ── Around snapshot view ──────────────────────────────────────────────
    snapshotHeaderCard: {
      gap: 8,
      backgroundColor: SURFACE,
      borderWidth: 0,
      borderRadius: 6,
      shadowOpacity: 0,
      elevation: 0,
    },
    snapshotHeaderTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    snapshotWindowText: {
      fontSize: 12,
      fontFamily: "PlusJakartaSans_700Bold",
      color: TERRACOTTA,
    },
    snapshotList: {
      gap: 12,
    },
  }),
};
