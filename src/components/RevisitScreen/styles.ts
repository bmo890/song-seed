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
      gap: 14,
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

    // ── Workspace filter rows ─────────────────────────────────────────────
    workspaceFilterList: {
      gap: 8,
    },
    filterWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      maxWidth: "100%",
    },
    filterChipIncluded: {
      backgroundColor: SURFACE,
    },
    filterChipExcluded: {
      backgroundColor: SURFACE_LO,
    },
    filterChipText: {
      maxWidth: 220,
      fontSize: 12,
      color: MUTED,
      fontWeight: "600",
    },
    filterChipTextIncluded: {
      color: INK_LO,
    },
    filterChipCount: {
      minWidth: 22,
      borderRadius: 2,
      backgroundColor: SURFACE_LO,
      paddingHorizontal: 6,
      paddingVertical: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    filterChipCountText: {
      fontSize: 11,
      fontWeight: "700",
      color: MUTED,
    },
    workspaceFilterRow: {
      borderRadius: 6,
      backgroundColor: SURFACE_LO,
      padding: 10,
      gap: 10,
    },
    workspaceFilterRowIncluded: {
      backgroundColor: SURFACE,
    },
    workspaceFilterTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    workspaceIncludeToggle: {
      width: 36,
      height: 36,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE,
    },
    workspaceIncludeToggleIncluded: {
      backgroundColor: SURFACE_LO,
    },
    workspaceFilterMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    workspaceFilterCopy: {
      flex: 1,
      gap: 2,
    },
    workspaceFilterTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: INK,
    },
    workspaceDropdown: {
      marginLeft: 44,
      gap: 8,
    },
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
      gap: 10,
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
    candidateMenuBtn: {
      width: 28,
      height: 28,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: SURFACE_LO,
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
