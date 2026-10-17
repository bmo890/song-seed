import { StyleSheet } from "react-native";
import { styles as base } from "../../styles";
import { radii, colors } from "../../design/tokens";

const PAPER = "#fbf9f5";
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
    // Reset is an ink word, not a grey key (2026-10-16).
    utilityButton: {
      paddingVertical: 4,
    },
    utilityButtonText: {
      fontSize: 13,
      fontFamily: "PlusJakartaSans_600SemiBold",
      color: TERRACOTTA,
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
      fontSize: 14,
      fontFamily: "PlusJakartaSans_600SemiBold",
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

    // ── Header help + sources chip (redesign) ────────────────────────────
    // A bare ink glyph: the header's right slot never wears a fill.
    headerHelpBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },

    // ── Sources sheet ─────────────────────────────────────────────────────
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    // A sheet names what it acts on in Jakarta, like every menu (2026-10-16).
    sheetTitle: {
      fontFamily: "PlusJakartaSans_600SemiBold",
      fontSize: 15,
      color: INK,
      marginBottom: 2,
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
    // Sections are labels, so only the ideas wear Lora (2026-10-16, A).
    sectionLabel: {
      fontFamily: "PlusJakartaSans_700Bold",
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.textStrong,
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

    // ── Feed card detail row ──────────────────────────────────────────────

    // ── "Today" hook ──────────────────────────────────────────────────────
    pageHeader: {
      gap: 6,
    },
    todayRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    // The day in quiet ink: colour is for actions, not dates (2026-10-16).
    todayLine: {
      fontFamily: "PlusJakartaSans_400Regular",
      fontSize: 13,
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
    // Rows on paper: hairline under each, no tinted glyph.
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      minHeight: 58,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderMuted,
    },
    sheetRule: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderMuted,
    },
    toggleIconWrap: {
      width: 22,
      alignItems: "center",
    },
    toggleRowTextCol: {
      flex: 1,
      gap: 2,
    },
    toggleRowText: {
      fontSize: 15,
      color: INK,
      fontFamily: "PlusJakartaSans_500Medium",
    },
    toggleRowDesc: {
      fontSize: 12,
      lineHeight: 16,
      color: MUTED,
    },

    // ── Around snapshot view ──────────────────────────────────────────────
    // One meta line on a hairline, the way onward an ink link (2026-10-16;
    // was a boxed header card with a filled key).
    snapshotMetaRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 10,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderMuted,
    },
    snapshotMetaText: {
      flex: 1,
      fontFamily: "PlusJakartaSans_400Regular",
      fontSize: 13,
      color: MUTED,
      fontVariant: ["tabular-nums"],
    },
    snapshotLink: {
      fontFamily: "PlusJakartaSans_600SemiBold",
      fontSize: 13,
      color: TERRACOTTA,
    },
    snapshotList: {
      gap: 12,
    },
  }),
};
