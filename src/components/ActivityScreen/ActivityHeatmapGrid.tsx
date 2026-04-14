import { useMemo } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SurfaceCard } from "../common/SurfaceCard";
import { startOfActivityDay } from "../../activity";
import { styles } from "../../styles";
import { CELL_SIZE, CELL_STRIDE, getActivityCellBackground } from "./helpers";

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
  const gridWidth = Math.max(0, weeks.length * CELL_STRIDE - 4);
  const displayRangeLabel = selectedRangeLabel?.replace(/, \d{4}/g, "") ?? "Choose a date range";
  const todayTs = useMemo(() => startOfActivityDay(Date.now()), []);

  return (
    <SurfaceCard style={styles.activityCard}>
      <View style={styles.activityHeatmapHeader}>
        <View style={styles.activityHeatmapHeaderCopy}>
          <Text style={styles.activityHeatmapEyebrow}>Date range</Text>
          <Text style={styles.activityHeatmapSelectedLabel} numberOfLines={2}>
            {displayRangeLabel}
          </Text>
          {scopeLabel !== "All workspaces" ? (
            <Text style={styles.activityHeatmapScopeLabel}>{scopeLabel}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.activityControlsRow}>
        <View style={styles.activityLegendRow}>
          <Text style={styles.activityLegendLabel}>Less</Text>
          {legendSwatches.map((backgroundColor, index) => (
            <View key={index} style={[styles.activityLegendSwatch, { backgroundColor }]} />
          ))}
          <Text style={styles.activityLegendLabel}>More</Text>
        </View>

        <View style={styles.activityYearControls}>
          <Pressable
            style={({ pressed }) => [styles.activityTodayBtn, pressed ? styles.pressDown : null]}
            onPress={() => {
              void Haptics.selectionAsync();
              onJumpToToday();
            }}
          >
            <Text style={styles.activityTodayBtnText}>Today</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.activityYearBtn, pressed ? styles.pressDown : null]}
            onPress={() => onChangeYear(year - 1)}
          >
            <Ionicons name="chevron-back" size={14} color="#1b1c1a" />
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
              color={year >= currentYear ? "#d7c2bd" : "#1b1c1a"}
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
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: gridWidth }}
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
                      { left: marker.weekIndex * CELL_STRIDE },
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={() => {
                      void Haptics.selectionAsync();
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
                          void Haptics.selectionAsync();
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
