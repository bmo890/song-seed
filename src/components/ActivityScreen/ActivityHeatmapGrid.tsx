import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { Press } from "../common/Press";
import { startOfActivityDay } from "../../domain/activity";
import { styles } from "../../styles";
import { CELL_SIZE, CELL_STRIDE, getActivityCellBackground } from "./helpers";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing } from "../../design/tokens";
import { useTranslation } from "react-i18next";

type ActivityHeatmapGridProps = {
  year: number;
  currentYear: number;
  scopeLabel: string;
  selectedRange: { startTs: number; endTs: number } | null;
  selectedRangeLabel: string | null;
  monthMarkers: Array<{ month: number; label: string; weekIndex: number }>;
  weeks: number[][];
  countsByDay: Map<number, number>;
  maxDailyCount: number;
  legendSwatches: string[];
  onChangeYear: (nextYear: number) => void;
  onJumpToToday: () => void;
  onPressMonth: (month: number) => void;
  onPressDay: (dayTs: number) => void;
};

export function ActivityHeatmapGrid({
  year,
  currentYear,
  scopeLabel,
  selectedRange,
  selectedRangeLabel,
  monthMarkers,
  weeks,
  countsByDay,
  maxDailyCount,
  legendSwatches,
  onChangeYear,
  onJumpToToday,
  onPressMonth,
  onPressDay,
}: ActivityHeatmapGridProps) {
  const { t } = useTranslation();
  const gridScrollRef = useRef<ScrollView>(null);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const gridWidth = Math.max(0, weeks.length * CELL_STRIDE - 4);
  const displayRangeLabel = selectedRangeLabel?.replace(/, \d{4}/g, "") ?? t("activity.chooseRange");
  const todayTs = useMemo(() => startOfActivityDay(Date.now()), []);
  const isSpan = selectedRange != null && selectedRange.endTs > selectedRange.startTs;
  const focusedDayTs = selectedRange?.endTs ?? (year === currentYear ? todayTs : null);
  const focusedWeekIndex = useMemo(
    () =>
      focusedDayTs == null
        ? -1
        : weeks.findIndex((week) =>
            week.some((dayTs) => startOfActivityDay(dayTs) === focusedDayTs)
          ),
    [focusedDayTs, weeks]
  );

  // Where the grid is scrolled, so a tap on a day you can see never moves the
  // grid under your finger; it only scrolls to bring an off-screen day in.
  const scrollXRef = useRef(0);

  useEffect(() => {
    if (gridViewportWidth <= 0 || focusedWeekIndex < 0) return;

    const maxOffset = Math.max(0, gridWidth - gridViewportWidth);
    const focusedWeekX = focusedWeekIndex * CELL_STRIDE;
    const visibleStart = scrollXRef.current;
    const visibleEnd = visibleStart + gridViewportWidth;
    if (focusedWeekX >= visibleStart && focusedWeekX + CELL_SIZE <= visibleEnd) return;
    const targetOffset = Math.min(
      maxOffset,
      Math.max(0, focusedWeekX - gridViewportWidth + CELL_STRIDE * 3)
    );
    const frame = requestAnimationFrame(() => {
      gridScrollRef.current?.scrollTo({ x: targetOffset, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [focusedWeekIndex, gridViewportWidth, gridWidth]);

  return (
    // The heatmap on paper (2026-10-16, founder picked A): the chosen date is
    // the page's line, Today and the year are ink beside it, the key sits under
    // the grid. Shared by the drawer page and a collection's scoped Activity.
    <View>
      <View style={local.headRow}>
        <View style={local.headCopy}>
          <Text style={local.date} numberOfLines={2}>
            {displayRangeLabel}
          </Text>
          {scopeLabel !== t("activity.allWorkspaces") ? (
            <Text style={local.scope} numberOfLines={1}>
              {scopeLabel}
            </Text>
          ) : null}
        </View>
        <View style={local.controls}>
          <Press
            // Haptics vocabulary: tap, an acknowledged press.
            haptic="tap"
            feel="glyph"
            style={local.key}
            onPress={onJumpToToday}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={local.today}>{t("activity.today")}</Text>
          </Press>
          <View style={local.year}>
            <Press
              haptic="tap"
              feel="glyph"
              style={local.key}
              onPress={() => onChangeYear(year - 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("activity.previousYear")}
            >
              <Ionicons name={dirIcon("chevron-back")} size={16} color={colors.textStrong} />
            </Press>
            <Text style={local.yearText}>{year}</Text>
            <Press
              haptic="tap"
              feel="glyph"
              style={local.key}
              onPress={() => onChangeYear(year + 1)}
              disabled={year >= currentYear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("activity.nextYear")}
              accessibilityState={{ disabled: year >= currentYear }}
            >
              <Ionicons
                name={dirIcon("chevron-forward")}
                size={16}
                color={year >= currentYear ? colors.borderMuted : colors.textStrong}
              />
            </Press>
          </View>
        </View>
      </View>

      <View style={styles.activityGridRow}>
        <View style={styles.activityWeekdayLabels}>
          {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.activityWeekdayLabel}>
              {label}
            </Text>
          ))}
        </View>

        <ScrollView
          ref={gridScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: gridWidth }}
          onLayout={(event) => setGridViewportWidth(event.nativeEvent.layout.width)}
          onScroll={(event) => {
            scrollXRef.current = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={32}
        >
          <View style={styles.activityHeatmapContent}>
            <View style={[styles.activityMonthRow, { width: gridWidth }]}>
              {monthMarkers.map((marker) => {
                // Underlined only when the whole month is the selection, not
                // whenever the chosen day happens to fall inside it.
                const rangeStart = selectedRange ? new Date(selectedRange.startTs) : null;
                const rangeEnd = selectedRange ? new Date(selectedRange.endTs) : null;
                const monthSelected =
                  rangeStart != null &&
                  rangeEnd != null &&
                  rangeStart.getFullYear() === year &&
                  rangeStart.getMonth() === marker.month &&
                  rangeStart.getDate() === 1 &&
                  rangeEnd.getFullYear() === year &&
                  rangeEnd.getMonth() === marker.month &&
                  rangeEnd.getDate() === new Date(year, marker.month + 1, 0).getDate();

                return (
                  <Pressable
                    key={`${marker.month}-${marker.weekIndex}`}
                    style={({ pressed }) => [
                      styles.activityMonthPressable,
                      monthSelected ? styles.activityMonthPressableActive : null,
                      { start: marker.weekIndex * CELL_STRIDE },
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={() => {
                      haptic.tap();
                      onPressMonth(marker.month);
                    }}
                  >
                    <Text
                      style={[
                        styles.activityMonthLabel,
                        monthSelected ? styles.activityMonthLabelActive : null,
                      ]}
                    >
                      {marker.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.activityWeeksWrap, { width: gridWidth }]}>
              {weeks.map((week, weekIndex) => (
                <View key={`${year}-week-${weekIndex}`} style={styles.activityWeekColumn}>
                  {week.map((dayTs) => {
                    const normalizedDayTs = startOfActivityDay(dayTs);
                    const inYear = new Date(dayTs).getFullYear() === year;
                    const count = countsByDay.get(normalizedDayTs) ?? 0;
                    const backgroundColor = getActivityCellBackground(count, maxDailyCount, inYear);
                    const isToday = normalizedDayTs === todayTs;
                    const inSelectedRange =
                      selectedRange != null &&
                      normalizedDayTs >= selectedRange.startTs &&
                      normalizedDayTs <= selectedRange.endTs;
                    // One day wears an outline; a span (two taps, or a month)
                    // instead lets the days outside it recede, so a month never
                    // turns into thirty outlined squares (2026-10-16).
                    const spanSelected = isSpan && inSelectedRange;
                    const outsideSpan = isSpan && !inSelectedRange;

                    return (
                      <Pressable
                        key={dayTs}
                        style={({ pressed }) => [
                          styles.activityDayCell,
                          { width: CELL_SIZE, height: CELL_SIZE },
                          isToday ? styles.activityDayCellToday : null,
                          inSelectedRange && !spanSelected ? styles.activityDayCellRangeSelected : null,
                          outsideSpan ? local.outsideSpan : null,
                          pressed && inYear ? styles.activityDayCellPressed : null,
                        ]}
                        onPress={() => {
                          if (!inYear) return;
                          haptic.tap();
                          onPressDay(dayTs);
                        }}
                      >
                        <View
                          style={[
                            styles.activityDayCellFill,
                            { backgroundColor },
                            inSelectedRange && !spanSelected ? styles.activityDayCellFillSelected : null,
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={local.legendRow}>
        <Text style={local.legendLabel}>{t("activity.less")}</Text>
        {legendSwatches.map((backgroundColor, index) => (
          <View key={index} style={[local.swatch, { backgroundColor }]} />
        ))}
        <Text style={local.legendLabel}>{t("activity.more")}</Text>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  date: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  scope: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  key: {
    minHeight: 32,
    justifyContent: "center",
  },
  today: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primaryDeep,
  },
  year: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  yearText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  legendLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: colors.textMuted,
  },
  outsideSpan: {
    opacity: 0.35,
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: radii.xs,
  },
});
