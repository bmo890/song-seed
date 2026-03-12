import { Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "../../styles";
import { startOfActivityDay } from "../../activity";
import { CELL_SIZE, CELL_STRIDE, getActivityCellBackground } from "./helpers";

type ActivityHeatmapGridProps = {
  year: number;
  monthMarkers: Array<{ month: number; label: string; weekIndex: number }>;
  weeks: number[][];
  countsByDay: Map<number, number>;
  maxDailyCount: number;
  rangeMode: boolean;
  normalizedRange: { startTs: number; endTs: number } | null;
  onPressMonth: (month: number) => void;
  onPressDay: (dayTs: number) => void;
};

export function ActivityHeatmapGrid({
  year,
  monthMarkers,
  weeks,
  countsByDay,
  maxDailyCount,
  rangeMode,
  normalizedRange,
  onPressMonth,
  onPressDay,
}: ActivityHeatmapGridProps) {
  return (
    <View style={styles.activityCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.activityHeatmapContent}>
          <View style={styles.activityMonthRow}>
            {monthMarkers.map((marker) => (
              <Pressable
                key={`${marker.month}-${marker.weekIndex}`}
                style={({ pressed }) => [
                  styles.activityMonthPressable,
                  { marginLeft: marker.weekIndex === 0 ? 0 : marker.weekIndex * CELL_STRIDE - 24 },
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => onPressMonth(marker.month)}
              >
                <Text style={styles.activityMonthLabel}>{marker.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.activityGridRow}>
            <View style={styles.activityWeekdayLabels}>
              {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.activityWeekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.activityWeeksWrap}>
              {weeks.map((week, weekIndex) => (
                <View key={`${year}-week-${weekIndex}`} style={styles.activityWeekColumn}>
                  {week.map((dayTs) => {
                    const normalizedDayTs = startOfActivityDay(dayTs);
                    const inYear = new Date(dayTs).getFullYear() === year;
                    const count = countsByDay.get(normalizedDayTs) ?? 0;
                    const backgroundColor = getActivityCellBackground(count, maxDailyCount, inYear);
                    const inSelectedRange =
                      normalizedRange &&
                      normalizedDayTs >= normalizedRange.startTs &&
                      normalizedDayTs <= normalizedRange.endTs;

                    return (
                      <Pressable
                        key={dayTs}
                        style={({ pressed }) => [
                          styles.activityDayCell,
                          { backgroundColor, width: CELL_SIZE, height: CELL_SIZE },
                          inSelectedRange ? styles.activityDayCellRangeSelected : null,
                          pressed && inYear ? styles.activityDayCellPressed : null,
                        ]}
                        onPress={() => {
                          if (!inYear) return;
                          onPressDay(dayTs);
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
