import { StyleSheet } from "react-native";
import { colors, radii, text } from "../../design/tokens";

export const screenStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  routeTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  routeMeta: {
    ...text.supporting,
    lineHeight: 18,
  },
  routeHint: {
    ...text.supporting,
    lineHeight: 18,
    color: colors.primaryDeep,
  },
  phaseTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  phaseText: {
    ...text.supporting,
    lineHeight: 18,
  },
  progressBlock: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressLabel: {
    ...text.annotation,
  },
  progressPercent: {
    ...text.caption,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  tapSurface: {
    minHeight: 140,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  tapSurfaceLabel: {
    fontSize: 20,
    lineHeight: 24,
    color: colors.textStrong,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  phaseError: {
    ...text.supporting,
    lineHeight: 18,
    color: colors.primaryDeep,
  },
  phaseSummary: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  delayLabel: {
    ...text.caption,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.primarySurface,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.primaryDeep,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    ...text.supporting,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionFlex: {
    flex: 1,
    alignSelf: "auto",
  },
  tweakRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tweakKey: {
    alignSelf: "auto",
    minHeight: 34,
    paddingHorizontal: 12,
  },
  tweakKeyText: {
    fontVariant: ["tabular-nums"],
  },
  savedList: {
    gap: 8,
  },
  savedCopy: {
    gap: 2,
  },
  savedTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  savedMeta: {
    ...text.supporting,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  savedActionCluster: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  removeKeyText: {
    color: colors.danger,
  },
});
