import { StyleSheet } from "react-native";
import { colors, radii, shadows, spacing, text as textTokens } from "../../design/tokens";
import { styles as base } from "../../styles";

export const styles = {
  ...StyleSheet.create({
    screen: base.screen,
    pressDown: base.pressDown,
    pageContent: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl + spacing.lg,
      gap: spacing.xl,
    },
    titleBlock: {
      gap: spacing.xs,
    },
    title: textTokens.pageTitle,
    subtitle: {
      ...textTokens.supporting,
      maxWidth: 420,
    },
    heroSurface: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl,
      borderRadius: radii.xl,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
    },
    pulseStack: {
      width: 120,
      height: 120,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    pulseHalo: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "rgba(84, 142, 201, 0.24)",
    },
    pulseCore: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#e7edf4",
      borderWidth: 1,
      borderColor: "#d8e0ea",
    },
    pulseCoreActive: {
      backgroundColor: "#d7e8f8",
      borderColor: "#c3d7eb",
    },
    pulseCoreMuted: {
      backgroundColor: colors.surface,
    },
    bpmValue: {
      fontSize: 58,
      lineHeight: 62,
      fontWeight: "700",
      color: colors.textPrimary,
      letterSpacing: -1.5,
    },
    bpmLabel: {
      ...textTokens.caption,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    intervalLabel: {
      ...textTokens.supporting,
    },
    primaryAction: {
      marginTop: spacing.sm,
      minWidth: 140,
      minHeight: 48,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.round,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#111827",
    },
    primaryActionStop: {
      backgroundColor: "#dbe6f1",
    },
    primaryActionDisabled: {
      opacity: 0.6,
    },
    primaryActionText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#f8fafc",
    },
    primaryActionTextStop: {
      color: "#1e293b",
    },
    statusLabel: {
      ...textTokens.supporting,
    },
    section: {
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    sectionTitle: {
      ...textTokens.sectionTitle,
    },
    sectionMeta: {
      ...textTokens.caption,
    },
    bpmStepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    stepButton: {
      minWidth: 62,
      minHeight: 42,
      borderRadius: radii.round,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    stepButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    sliderLabels: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: -4,
    },
    sliderLabel: {
      ...textTokens.caption,
    },
    tapRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    tapButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.round,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#d9e6f5",
    },
    tapButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#244b78",
    },
    tapResetButton: {
      minWidth: 90,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.round,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    tapResetButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textStrong,
    },
    outputRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    outputToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.round,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    outputToggleActive: {
      backgroundColor: "#e8f1fb",
      borderColor: "#bfd3ea",
    },
    outputToggleText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textStrong,
    },
    outputToggleTextActive: {
      color: "#244b78",
    },
    helperText: {
      ...textTokens.supporting,
      maxWidth: 480,
    },
    levelGroup: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    levelHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    levelTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    levelMeta: {
      ...textTokens.caption,
    },
    levelTrackLabels: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: -4,
    },
  }),
};
