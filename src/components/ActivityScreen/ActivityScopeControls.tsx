import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { Collection, Workspace } from "../../types";
import { ActivityMetricFilter } from "../../activity";

type ActivityScopeControlsProps = {
  collectionScopeActive: boolean;
  workspaces: Workspace[];
  workspaceFilterId: string | null;
  topLevelCollections: Collection[];
  collectionFilterId: string | null;
  metricFilter: ActivityMetricFilter;
  rangeMode: boolean;
  year: number;
  filteredEventCount: number;
  legendSwatches: string[];
  hintText: string;
  onSelectWorkspace: (workspaceId: string | null) => void;
  onSelectCollection: (collectionId: string | null) => void;
  onSelectMetric: (metric: ActivityMetricFilter) => void;
  onToggleRangeMode: () => void;
  onChangeYear: (nextYear: number) => void;
};

export function ActivityScopeControls({
  collectionScopeActive,
  workspaces,
  workspaceFilterId,
  topLevelCollections,
  collectionFilterId,
  metricFilter,
  rangeMode,
  year,
  filteredEventCount,
  legendSwatches,
  hintText,
  onSelectWorkspace,
  onSelectCollection,
  onSelectMetric,
  onToggleRangeMode,
  onChangeYear,
}: ActivityScopeControlsProps) {
  return (
    <>
      {!collectionScopeActive ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activityChipScroll}
            style={styles.activityChipRow}
          >
            <Pressable
              style={({ pressed }) => [
                styles.activityFilterChip,
                workspaceFilterId == null ? styles.activityFilterChipActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onSelectWorkspace(null)}
            >
              <Text
                style={[
                  styles.activityFilterChipText,
                  workspaceFilterId == null ? styles.activityFilterChipTextActive : null,
                ]}
              >
                All workspaces
              </Text>
            </Pressable>
            {workspaces.map((workspace) => (
              <Pressable
                key={workspace.id}
                style={({ pressed }) => [
                  styles.activityFilterChip,
                  workspaceFilterId === workspace.id ? styles.activityFilterChipActive : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => onSelectWorkspace(workspace.id)}
              >
                <Text
                  style={[
                    styles.activityFilterChipText,
                    workspaceFilterId === workspace.id ? styles.activityFilterChipTextActive : null,
                  ]}
                >
                  {workspace.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {workspaceFilterId && topLevelCollections.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activityChipScroll}
              style={styles.activityChipRow}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.activityFilterChip,
                  collectionFilterId == null ? styles.activityFilterChipActive : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => onSelectCollection(null)}
              >
                <Text
                  style={[
                    styles.activityFilterChipText,
                    collectionFilterId == null ? styles.activityFilterChipTextActive : null,
                  ]}
                >
                  All collections
                </Text>
              </Pressable>
              {topLevelCollections.map((collection) => (
                <Pressable
                  key={collection.id}
                  style={({ pressed }) => [
                    styles.activityFilterChip,
                    collectionFilterId === collection.id ? styles.activityFilterChipActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => onSelectCollection(collection.id)}
                >
                  <Text
                    style={[
                      styles.activityFilterChipText,
                      collectionFilterId === collection.id ? styles.activityFilterChipTextActive : null,
                    ]}
                  >
                    {collection.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      <View style={styles.activityControlsRow}>
        <View style={styles.activitySegmentWrap}>
          {(["created", "updated", "both"] as const).map((metric) => (
            <Pressable
              key={metric}
              style={({ pressed }) => [
                styles.activitySegmentBtn,
                metricFilter === metric ? styles.activitySegmentBtnActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onSelectMetric(metric)}
            >
              <Text
                style={[
                  styles.activitySegmentText,
                  metricFilter === metric ? styles.activitySegmentTextActive : null,
                ]}
              >
                {metric === "both" ? "Both" : metric === "created" ? "Created" : "Updated"}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.activitySegmentBtn,
              rangeMode ? styles.activitySegmentBtnActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={onToggleRangeMode}
          >
            <Text
              style={[
                styles.activitySegmentText,
                rangeMode ? styles.activitySegmentTextActive : null,
              ]}
            >
              Range
            </Text>
          </Pressable>
        </View>

        <View style={styles.activityYearControls}>
          <Pressable
            style={({ pressed }) => [styles.activityYearBtn, pressed ? styles.pressDown : null]}
            onPress={() => onChangeYear(year - 1)}
          >
            <Ionicons name="chevron-back" size={14} color="#334155" />
          </Pressable>
          <Text style={styles.activityYearText}>{year}</Text>
          <Pressable
            style={({ pressed }) => [styles.activityYearBtn, pressed ? styles.pressDown : null]}
            onPress={() => onChangeYear(year + 1)}
          >
            <Ionicons name="chevron-forward" size={14} color="#334155" />
          </Pressable>
        </View>
      </View>

      <View style={styles.activitySummaryRow}>
        <Text style={styles.activitySummaryText}>
          {filteredEventCount} {filteredEventCount === 1 ? "event" : "events"} in {year}
        </Text>
        <View style={styles.activityLegendRow}>
          <Text style={styles.activityLegendLabel}>Less</Text>
          {legendSwatches.map((backgroundColor, index) => (
            <View
              key={index}
              style={[styles.activityLegendSwatch, { backgroundColor }]}
            />
          ))}
          <Text style={styles.activityLegendLabel}>More</Text>
        </View>
      </View>

      <Text style={styles.activityHintText}>{hintText}</Text>
    </>
  );
}
