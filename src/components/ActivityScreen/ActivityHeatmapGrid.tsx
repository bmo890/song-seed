import { useEffect, useMemo, useRef, useState } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { Press } from "../common/Press";
import { startOfActivityDay } from "../../domain/activity";
import { styles } from "../../styles";
import { CELL_SIZE, CELL_STRIDE, getActivityCellBackground } from "./helpers";
import { haptic } from "../../design/haptics";
import { durations } from "../../design/motion";
import { colors, radii, spacing } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import { useLocale } from "../../i18n";
import { getWeekdayName } from "../../domain/dateNames";

/** Hebrew calendars run right to left (founder, 2026-10-26: mirror the heatmap like
 *  Apple's and Google's Hebrew calendars): the newest week sits at the left, the
 *  weekday labels at the right. The scroll view itself stays physically left to
 *  right (RTL horizontal scrolling differs by platform), so the order is drawn
 *  mirrored instead: week i lands at weekX(i). */
const RTL = I18nManager.isRTL;

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
  /** Changes when the selection should be scrolled into view (year, Today). */
  revealToken: number;
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
  revealToken,
}: ActivityHeatmapGridProps) {
  const { t } = useTranslation();
  const gridScrollRef = useRef<ScrollView>(null);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const gridWidth = Math.max(0, weeks.length * CELL_STRIDE - 4);
  const weekX = (weekIndex: number) => (RTL ? weeks.length - 1 - weekIndex : weekIndex) * CELL_STRIDE;
  const { formatLocale } = useLocale();
  // One line, always (founder, 2026-10-16: the row was one line or two by the
  // length of the weekday): a day reads "Wed, Sep 16", the span's own style.
  const displayRangeLabel =
    selectedRange == null
      ? t("activity.chooseRange")
      : selectedRange.startTs === selectedRange.endTs
        ? new Date(selectedRange.startTs).toLocaleDateString(formatLocale, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : selectedRangeLabel?.replace(/, \d{4}/g, "") ?? t("activity.chooseRange");
  const todayTs = useMemo(() => startOfActivityDay(Date.now()), []);
  const isSpan = selectedRange != null && selectedRange.endTs > selectedRange.startTs;
  // The weeks the selection covers, for the rule beneath the grid.
  const selectedWeeks = useMemo(() => {
    if (!selectedRange) return null;
    let start = -1;
    let end = -1;
    weeks.forEach((week, weekIndex) => {
      const covered = week.some((dayTs) => {
        const day = startOfActivityDay(dayTs);
        return (
          new Date(day).getFullYear() === year && day >= selectedRange.startTs && day <= selectedRange.endTs
        );
      });
      if (!covered) return;
      if (start < 0) start = weekIndex;
      end = weekIndex;
    });
    return start < 0 ? null : { start, end };
  }, [selectedRange, weeks, year]);
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

  // The grid scrolls only to bring the selection in when the page opens, the
  // year changes or Today is pressed. A tap on the grid never moves it: a grid
  // that slid under each tap made the next tap land on another day (founder,
  // 2026-10-16). The focused week is read at reveal time, not a dependency.
  const focusedWeekRef = useRef(focusedWeekIndex);
  focusedWeekRef.current = focusedWeekIndex;

  useEffect(() => {
    const weekIndex = focusedWeekRef.current;
    if (gridViewportWidth <= 0 || weekIndex < 0) return;

    const maxOffset = Math.max(0, gridWidth - gridViewportWidth);
    const focusedWeekX = (RTL ? weeks.length - 1 - weekIndex : weekIndex) * CELL_STRIDE;
    // The focused week rides near the edge time is heading to, with the weeks before
    // it in view: the right edge in English, the left in Hebrew.
    const targetOffset = Math.min(
      maxOffset,
      Math.max(0, RTL ? focusedWeekX - CELL_STRIDE * 3 : focusedWeekX - gridViewportWidth + CELL_STRIDE * 3)
    );
    const frame = requestAnimationFrame(() => {
      gridScrollRef.current?.scrollTo({ x: targetOffset, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [gridViewportWidth, gridWidth, year, revealToken, weeks.length]);

  return (
    // The heatmap on paper (2026-10-16, founder picked A): the chosen date is
    // the page's line, Today and the year are ink beside it, the key sits under
    // the grid. Shared by the drawer page and a collection's scoped Activity.
    <View>
      <View style={local.headRow}>
        <View style={local.headCopy}>
          <Text style={local.date} numberOfLines={1}>
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

      <View style={[styles.activityGridRow, RTL ? { flexDirection: "row-reverse" } : null]}>
        <View style={styles.activityWeekdayLabels}>
          {[0, 1, 2, 3, 4, 5, 6].map((day) => getWeekdayName(formatLocale, day, "narrow")).map((label, index) => (
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
                      // A month's label starts at its first week: that week's left
                      // edge, or its right edge in Hebrew (the subtree is pinned LTR).
                      RTL ? { right: marker.weekIndex * CELL_STRIDE } : { left: marker.weekIndex * CELL_STRIDE },
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
              {(RTL ? weeks.map((week, weekIndex) => ({ week, weekIndex })).reverse() : weeks.map((week, weekIndex) => ({ week, weekIndex }))).map(({ week, weekIndex }) => (
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
                        // The gaps belong to the nearest day: a 15 pt square is a
                        // small target, so its touch reaches halfway to each neighbour.
                        hitSlop={CELL_HIT_SLOP}
                        onPress={() => {
                          if (!inYear) return;
                          // Haptics vocabulary: tap, an acknowledged press.
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

            <SelectionRule
              startWeek={selectedWeeks?.start ?? -1}
              endWeek={selectedWeeks?.end ?? -1}
              weekCount={weeks.length}
            />
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

const CELL_HIT_SLOP = { top: 2, bottom: 2, left: 2, right: 2 };

/**
 * A 2 pt rule under the weeks the selection covers (2026-10-16, founder: "some
 * subtle line around the selected block"). The ink tabs' mark for "chosen",
 * so the heatmap speaks the same language; it glides between selections.
 */
function SelectionRule({ startWeek, endWeek, weekCount }: { startWeek: number; endWeek: number; weekCount: number }) {
  const visible = startWeek >= 0;
  // The span's left edge: its first week in English, its last in Hebrew (mirrored order).
  const leftWeek = RTL ? weekCount - 1 - endWeek : startWeek;
  const left = useSharedValue(Math.max(0, leftWeek) * CELL_STRIDE);
  const width = useSharedValue(visible ? (endWeek - startWeek) * CELL_STRIDE + CELL_SIZE : 0);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (startWeek < 0) {
      opacity.value = withTiming(0, { duration: durations.fast });
      return;
    }
    // The ink tabs' own timing: the rule moves exactly as their rule does.
    const timing = { duration: durations.base };
    left.value = withTiming(leftWeek * CELL_STRIDE, timing);
    width.value = withTiming((endWeek - startWeek) * CELL_STRIDE + CELL_SIZE, timing);
    opacity.value = withTiming(1, { duration: durations.fast });
  }, [endWeek, left, leftWeek, opacity, startWeek, width]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    width: width.value,
    transform: [{ translateX: left.value }],
  }));

  return (
    <View style={local.ruleTrack} pointerEvents="none">
      <Animated.View style={[local.rule, style]} />
    </View>
  );
}

const local = StyleSheet.create({
  // The controls sit on the date's centre line, not its foot.
  headRow: {
    flexDirection: "row",
    alignItems: "center",
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
  ruleTrack: {
    height: 2,
    marginTop: 6,
  },
  rule: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primaryDeep,
  },
  // Strong enough that the span reads at a glance (founder: "hard to tell
  // which is selected" at 0.35); empty days inside keep their own grey, so
  // nothing outside the scale is mistaken for activity.
  outsideSpan: {
    opacity: 0.2,
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: radii.xs,
  },
});
