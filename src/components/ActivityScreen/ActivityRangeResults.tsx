import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { ActivityCollectionGroup, ActivityRangeWorkspaceGroup } from "./helpers";

type ActivityRangeResultsProps = {
  selectedMonthLabel: string | null;
  selectedMonthEventCount: number;
  normalizedRange: { startTs: number; endTs: number } | null;
  selectedRangeLabel: string | null;
  selectedRangeEntryCount: number;
  selectedRangeEventCount: number;
  collectionScopeActive: boolean;
  selectedRangeWorkspaceGroups: ActivityRangeWorkspaceGroup[];
  selectedRangeCollectionGroups: ActivityCollectionGroup[];
  onClearRange: () => void;
  onOpenScopedRange: () => void;
  onOpenWorkspaceCollectionRange: (
    workspaceId: string,
    collectionId: string,
    label: string
  ) => void;
  onOpenCollectionRange: (collectionId: string, label: string) => void;
};

function renderCollectionList(
  collections: ActivityCollectionGroup[],
  onOpen: (collectionId: string) => void
) {
  return (
    <View style={styles.activityRangeCollectionList}>
      {collections.map((collectionGroup) => (
        <View key={collectionGroup.collectionId} style={styles.activityRangeCollectionCard}>
          <View style={styles.activityRangeCollectionCopy}>
            <Text style={styles.activityRangeCollectionTitle}>{collectionGroup.collectionTitle}</Text>
            <Text style={styles.activityRangeCollectionMeta} numberOfLines={2}>
              {collectionGroup.pathLabel}
            </Text>
          </View>
          <View style={styles.activityRangeCollectionActions}>
            <Text style={styles.activityRangeCollectionCount}>
              {collectionGroup.itemCount} {collectionGroup.itemCount === 1 ? "item" : "items"}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.activityRangeOpenBtn, pressed ? styles.pressDown : null]}
              onPress={() => onOpen(collectionGroup.collectionId)}
            >
              <Text style={styles.activityRangeOpenBtnText}>Open ideas</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ActivityRangeResults({
  selectedMonthLabel,
  selectedMonthEventCount,
  normalizedRange,
  selectedRangeLabel,
  selectedRangeEntryCount,
  selectedRangeEventCount,
  collectionScopeActive,
  selectedRangeWorkspaceGroups,
  selectedRangeCollectionGroups,
  onClearRange,
  onOpenScopedRange,
  onOpenWorkspaceCollectionRange,
  onOpenCollectionRange,
}: ActivityRangeResultsProps) {
  return (
    <>
      {selectedMonthLabel ? (
        <View style={styles.activityMonthSummaryCard}>
          <View style={styles.activityMonthSummaryCopy}>
            <Ionicons name="calendar-outline" size={15} color="#475569" />
            <Text style={styles.activityMonthSummaryTitle}>{selectedMonthLabel}</Text>
          </View>
          <Text style={styles.activityMonthSummaryMeta}>
            {selectedMonthEventCount} {selectedMonthEventCount === 1 ? "event" : "events"}
          </Text>
        </View>
      ) : null}

      {normalizedRange && selectedRangeLabel ? (
        <View style={styles.activityRangeSummaryCard}>
          <View style={styles.activityRangeSummaryHeader}>
            <View style={styles.activityRangeSummaryCopy}>
              <Ionicons name="calendar-outline" size={15} color="#475569" />
              <Text style={styles.activityRangeSummaryTitle}>{selectedRangeLabel}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.activityRangeSummaryClear, pressed ? styles.pressDown : null]}
              onPress={onClearRange}
            >
              <Ionicons name="close" size={14} color="#64748b" />
            </Pressable>
          </View>
          <Text style={styles.activityRangeSummaryMeta}>
            {selectedRangeEntryCount} {selectedRangeEntryCount === 1 ? "item" : "items"} •{" "}
            {selectedRangeEventCount} {selectedRangeEventCount === 1 ? "event" : "events"}
          </Text>

          {collectionScopeActive ? (
            <View style={styles.activityRangeScopedActions}>
              <Pressable
                style={({ pressed }) => [styles.ideasHeaderSelectBtn, styles.activityDayOpenBtn, pressed ? styles.pressDown : null]}
                onPress={onOpenScopedRange}
              >
                <Text style={styles.ideasHeaderSelectBtnText}>Show in ideas</Text>
              </Pressable>
            </View>
          ) : selectedRangeWorkspaceGroups.length > 0 ? (
            <View style={styles.activityRangeWorkspaceGroupList}>
              {selectedRangeWorkspaceGroups.map((workspaceGroup) => (
                <View key={workspaceGroup.workspaceId} style={styles.activityDayWorkspaceGroup}>
                  <Text style={styles.activityDayWorkspaceTitle}>{workspaceGroup.workspaceTitle}</Text>
                  <View style={styles.activityRangeCollectionList}>
                    {workspaceGroup.collections.map((collectionGroup) => (
                      <View
                        key={`${workspaceGroup.workspaceId}:${collectionGroup.collectionId}`}
                        style={styles.activityRangeCollectionCard}
                      >
                        <View style={styles.activityRangeCollectionCopy}>
                          <Text style={styles.activityRangeCollectionTitle}>{collectionGroup.collectionTitle}</Text>
                          <Text style={styles.activityRangeCollectionMeta} numberOfLines={2}>
                            {collectionGroup.pathLabel}
                          </Text>
                        </View>
                        <View style={styles.activityRangeCollectionActions}>
                          <Text style={styles.activityRangeCollectionCount}>
                            {collectionGroup.itemCount} {collectionGroup.itemCount === 1 ? "item" : "items"}
                          </Text>
                          <Pressable
                            style={({ pressed }) => [styles.activityRangeOpenBtn, pressed ? styles.pressDown : null]}
                            onPress={() =>
                              onOpenWorkspaceCollectionRange(
                                workspaceGroup.workspaceId,
                                collectionGroup.collectionId,
                                selectedRangeLabel
                              )
                            }
                          >
                            <Text style={styles.activityRangeOpenBtnText}>Open ideas</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            renderCollectionList(selectedRangeCollectionGroups, (collectionId) =>
              onOpenCollectionRange(collectionId, selectedRangeLabel)
            )
          )}
        </View>
      ) : null}
    </>
  );
}
