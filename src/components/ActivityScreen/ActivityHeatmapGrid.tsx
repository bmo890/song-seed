import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../common/SurfaceCard";
import { startOfActivityDay } from "../../domain/activity";
import { styles } from "../../styles";
import { CELL_SIZE, CELL_STRIDE, getActivityCellBackground } from "./helpers";
import { haptic } from "../../design/haptics";
import { colors } from "../../design/tokens";
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

  useEffect(() => {
    if (gridViewportWidth <= 0 || focusedWeekIndex < 0) return;

    const maxOffset = Math.max(0, gridWidth - gridViewportWidth);
    const focusedWeekX = focusedWeekIndex * CELL_STRIDE;
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
    <SurfaceCard style={styles.activityCard}>
      <View style={styles.activityHeatmapHeader}>
        <View style={styles.activityHeatmapHeaderCopy}>
          <Text style={styles.activityHeatmapEyebrow}>{t("activity.dateRange")}</Text>
          <Text style={styles.activityHeatmapSelectedLabel} numberOfLines={2}>
            {displayRangeLabel}
          </Text>
          {scopeLabel !== t("activity.allWorkspaces") ? (
            <Text style={styles.activityHeatmapScopeLabel}>{scopeLabel}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.activityControlsRow}>
        <View style={styles.activityLegendRow}>
          <Text style={styles.activityLegendLabel}>{t("activity.less")}</Text>
          {legendSwatches.map((backgroundColor, index) => (
            <View key={index} style={[styles.activityLegendSwatch, { backgroundColor }]} />
          ))}
          <Text style={styles.activityLegendLabel}>{t("activity.more")}</Text>
        </View>

        <View style={styles.activityYearControls}>
          <Pressable
            style={({ pressed }) => [styles.activityTodayBtn, pressed ? styles.pressDown : null]}
            onPress={() => {
              haptic.tap();
              onJumpToToday();
            }}
          >
            <Text style={styles.activityTodayBtnText}>{t("activity.today")}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.activityYearBtn, pressed ? styles.pressDown : null]}
            onPress={() => onChangeYear(year - 1)}
          >
            <Ionicons name="chevron-back" size={14} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.activityYearText}>{year}</Text>
          <Pressable
            style={({ pressed }) => [styles.activityYearBtn, pressed ? styles.pressDown : null]}
            onPress={() => onChangeYear(year + 1)}
            disabled={year >= currentYear}
          >
            <Ionicons
              name="chevron-forward"
              size={14}
              color={year >= currentYear ? colors.borderMuted : colors.textPrimary}
            />
          </Pressable>
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
        >
          <View style={styles.activityHeatmapContent}>
            <View style={[styles.activityMonthRow, { width: gridWidth }]}>
              {monthMarkers.map((marker) => {
                const monthSelected =
                  selectedRange != null &&
                  new Date(selectedRange.startTs).getMonth() === marker.month &&
                  new Date(selectedRange.endTs).getMonth() === marker.month &&
                  new Date(selectedRange.startTs).getFullYear() === year &&
                  new Date(selectedRange.endTs).getFullYear() === year;

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

                    return (
                      <Pressable
                        key={dayTs}
                        style={({ pressed }) => [
                          styles.activityDayCell,
                          { width: CELL_SIZE, height: CELL_SIZE },
                          isToday ? styles.activityDayCellToday : null,
                          inSelectedRange ? styles.activityDayCellRangeSelected : null,
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
                            inSelectedRange ? styles.activityDayCellFillSelected : null,
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
    </SurfaceCard>
  );
}
