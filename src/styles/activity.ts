import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { colors, radii } from "../design/tokens";

// Activity view: heatmap, day/month/range breakdowns, filters.
// Raw style objects — merged and registered once via StyleSheet.create in ../styles.ts.
export const activityStyles = {
  activityRangeBanner: {
    marginBottom: 10,
    minHeight: 36,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#E8E4DF",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  activityRangeBannerCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activityRangeBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  activityRangeBannerClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  activityScreenContent: {
    paddingBottom: 24,
    gap: 12,
  },
  activityHeatmapContent: {
    gap: 8,
  },
  activityMonthRow: {
    position: "relative",
    minHeight: 16,
  },
  activityMonthPressable: {
    position: "absolute",
    minHeight: 16,
    justifyContent: "center",
  },
  activityMonthPressableActive: {
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDeep,
  },
  activityMonthLabel: {
    position: "relative",
    fontSize: 10,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  activityMonthLabelActive: {
    color: colors.primaryDeep,
  },
  activityGridRow: {
    // Pinned LTR so the horizontal scroll offset means the same on both platforms.
    // Hebrew still reads as a Hebrew calendar: ActivityHeatmapGrid draws the weeks
    // newest-left and puts the weekday labels on the right.
    direction: "ltr",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  // One letter per row, on its row: the column steps exactly as the cells do
  // (15 + 4) and starts below the month row (16) and its gap (8). It drifted
  // a point a row before (2026-10-16).
  activityWeekdayLabels: {
    width: 16,
    gap: 4,
    paddingTop: 24,
  },
  activityWeekdayLabel: {
    height: 15,
    lineHeight: 15,
    fontSize: 9,
    color: "#84736f",
    textAlign: "center",
    includeFontPadding: false,
  },
  activityWeeksWrap: {
    flexDirection: "row",
    gap: 4,
  },
  activityWeekColumn: {
    gap: 4,
  },
  activityDayCell: {
    borderRadius: 3,
    backgroundColor: "transparent",
    padding: 0,
  },
  activityDayCellFill: {
    flex: 1,
    borderRadius: 2,
  },
  activityDayCellFillSelected: {
    borderRadius: 2,
  },
  activityDayCellRangeSelected: {
    borderColor: colors.primaryDeep,
    borderWidth: 1.25,
    padding: 1.5,
  },
  activityDayCellToday: {
    borderColor: "#1b1c1a",
    borderWidth: 1.5,
  },
  activityDayCellPressed: {
    transform: [{ scale: 0.94 }],
  },
  activityResultsSection: {
    gap: 10,
  },
  activityResultsSummaryText: {
    fontSize: 11,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  activityResultsList: {
    gap: 8,
  },
  activityResultEmptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#84736f",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
} satisfies Record<string, ViewStyle | TextStyle | ImageStyle>;
