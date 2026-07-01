import { StyleSheet } from "react-native";
import { styles as base } from "../../styles";

const PAPER = "#fbf9f5";
const SURFACE = "#efeeea";
const SURFACE_LO = "#e4deda";
const TERRACOTTA = "#824f3f";
const INK = "#1b1c1a";
const INK_LO = "#4a3f3b";
const MUTED = "#84736f";

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
    filterPanel: {
      gap: 12,
      backgroundColor: SURFACE,
      borderWidth: 0,
      borderRadius: 6,
      shadowOpacity: 0,
      elevation: 0,
    },
    filterPanelHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    filterPanelTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: INK,
    },
    utilityButton: {
      borderRadius: 4,
      backgroundColor: SURFACE_LO,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    utilityButtonText: {
      fontSize: 12,
      fontWeight: "700",
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
      fontWeight: "700",
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
    sectionHeaderCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    sectionHeaderMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionTitle: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "700",
      color: INK,
    },
    sectionSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: MUTED,
      fontWeight: "500",
    },
    sectionActionButton: {
      borderRadius: 4,
      backgroundColor: SURFACE_LO,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    sectionIconButton: {
      width: 28,
      height: 28,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE_LO,
    },
    sectionActionText: {
      fontSize: 12,
      fontWeight: "700",
      color: INK,
    },
    sectionCountPill: {
      minWidth: 32,
      borderRadius: 4,
      backgroundColor: SURFACE_LO,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionCountPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: MUTED,
    },

    // ── Empty states (override styles.card) ──────────────────────────────
    emptyCard: {
      backgroundColor: SURFACE,
      borderWidth: 0,
      borderRadius: 6,
      shadowOpacity: 0,
      elevation: 0,
    },
    emptyStateCard: {
      backgroundColor: SURFACE,
      borderWidth: 0,
      borderRadius: 6,
      shadowOpacity: 0,
      elevation: 0,
    },

    // ── Candidate card ────────────────────────────────────────────────────
    candidateWrap: {
      gap: 0,
    },
    reasonText: {
      fontSize: 12,
      fontWeight: "700",
      color: TERRACOTTA,
    },
    candidateCard: {
      gap: 8,
      backgroundColor: SURFACE,
      borderWidth: 0,
      borderRadius: 6,
      shadowOpacity: 0,
      elevation: 0,
    },
    candidateTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    candidateLeadCol: {
      width: 36,
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
    },
    candidatePlayBtn: {
      width: 36,
      height: 36,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE_LO,
    },
    candidateStopBtn: {
      width: 24,
      height: 24,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE_LO,
    },
    candidateMain: {
      flex: 1,
      gap: 6,
    },
    candidateTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    candidateTitleBlock: {
      flex: 1,
      gap: 4,
    },
    candidateTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: INK,
    },
    candidateContext: {
      fontSize: 13,
      color: MUTED,
      fontWeight: "500",
    },
    candidateTopActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    candidateKindPill: {
      borderRadius: 2,
      backgroundColor: SURFACE_LO,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    candidateKindPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: MUTED,
    },
    candidateProgressWrap: {
      minHeight: 18,
      justifyContent: "center",
    },
    candidateDurationLabel: {
      fontSize: 12,
      color: MUTED,
      fontWeight: "600",
    },

    // ── Header help + sources chip (redesign) ────────────────────────────
    headerHelpBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE,
    },
    sourcesChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "flex-start",
      paddingVertical: 9,
      paddingHorizontal: 13,
      borderRadius: 999,
      backgroundColor: "#F1EAE2",
    },
    sourcesChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#6f5d57",
    },
    sourcesChipCount: {
      fontSize: 12,
      color: "#a89994",
      fontVariant: ["tabular-nums"],
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
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
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
    sectionCount: {
      fontSize: 12,
      fontWeight: "700",
      color: "#c0b3aa",
      fontVariant: ["tabular-nums"],
    },
    sectionGoBtn: {
      marginLeft: "auto",
    },
    sectionGoText: {
      fontSize: 13,
      fontWeight: "700",
      color: TERRACOTTA,
    },
    sectionEmptyLine: {
      fontSize: 13,
      color: "#b4a79f",
      paddingLeft: 1,
    },

    // ── Candidate card trailing (IdeaCard slot) ───────────────────────────
    cardTrailing: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    // ── Why-tag + detail row on each feed card ────────────────────────────
    cardTagRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginTop: 3,
    },
    cardTagChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: "#EFE8E1",
    },
    cardTagChipPrimary: {
      backgroundColor: "#F2E4DF",
    },
    cardTagChipText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: "#7a6a63",
    },
    cardTagChipTextPrimary: {
      color: "#824f3f",
    },
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
    feedFooterLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingVertical: 6,
    },
    feedFooterLinkText: {
      fontSize: 13,
      fontWeight: "700",
      color: TERRACOTTA,
    },

    // ── Customize sheet extras ────────────────────────────────────────────
    sheetSectionLabel: {
      fontSize: 11,
      fontWeight: "700",
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
      fontWeight: "600",
    },
    toggleRowDesc: {
      fontSize: 12,
      lineHeight: 16,
      color: MUTED,
    },
    // ── Sources rows (redesign: workspace avatar + switch) ────────────────
    sourceRow: {
      backgroundColor: "#F8F4EE",
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 10,
    },
    sourceRowExcluded: {
      backgroundColor: "#F4F1EC",
    },
    sourceTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sourceAvatarMuted: {
      opacity: 0.4,
    },
    sourceCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    sourceTitle: {
      fontFamily: "PlusJakartaSans_600SemiBold",
      fontSize: 15,
      color: INK,
    },
    sourceMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    sourceMeta: {
      flexShrink: 1,
      fontSize: 12,
      color: MUTED,
    },
    // Collections as a quiet indented sub-list under a hairline, not chips.
    sourceCollections: {
      marginLeft: 48,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "#EBE3D8",
    },
    sourceCollectionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 7,
    },
    sourceCollectionName: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: "600",
      color: INK_LO,
    },
    sourceCollectionNameOff: {
      color: "#b3a49c",
      fontWeight: "500",
    },
    sourceCollectionCount: {
      fontSize: 12,
      color: "#a89994",
      fontVariant: ["tabular-nums"],
    },
    sourceHint: {
      marginLeft: 48,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "#EBE3D8",
      fontSize: 12,
      color: "#a89994",
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
      fontWeight: "700",
      color: TERRACOTTA,
    },
    snapshotList: {
      gap: 12,
    },
  }),
};
