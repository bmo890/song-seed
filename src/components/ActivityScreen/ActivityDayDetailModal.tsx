import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { ActivityDayEntry, getActivityCollectionPath, startOfActivityDay } from "../../activity";
import { Workspace } from "../../types";
import { ActivityDayWorkspaceGroup, formatDayRangeLabel, formatEntryMetrics } from "./helpers";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";

type ActivityDayDetailModalProps = {
  visible: boolean;
  dayLabel: string;
  selectedDayTs: number | null;
  metricFilter: "created" | "updated" | "both";
  selectedDayEntries: ActivityDayEntry[];
  effectiveWorkspaceId: string | null;
  selectedDayWorkspaceGroups: ActivityDayWorkspaceGroup[];
  workspaces: Workspace[];
  showScopedIdeasAction: boolean;
  onClose: () => void;
  onOpenIdea: (entry: ActivityDayEntry) => void;
  onShowScopedIdeas: (startTs: number, endTs: number, label: string) => void;
};

function renderEntryCard(
  entry: ActivityDayEntry,
  workspaces: Workspace[],
  onOpenIdea: (entry: ActivityDayEntry) => void
) {
  return (
    <Pressable
      key={`${entry.workspaceId}:${entry.ideaId}`}
      style={({ pressed }) => [styles.activityDayEntryCard, pressed ? styles.pressDown : null]}
      onPress={() => onOpenIdea(entry)}
    >
      <View style={styles.activityDayEntryTop}>
        <View style={styles.activityDayEntryTitleWrap}>
          <Ionicons
            name={getHierarchyIconName(entry.ideaKind === "song" ? "song" : "clip")}
            size={15}
            color={getHierarchyIconColor(entry.ideaKind === "song" ? "song" : "clip")}
          />
          <Text style={styles.activityDayEntryTitle} numberOfLines={2}>
            {entry.ideaTitle}
          </Text>
        </View>
        <Text style={styles.activityDayEntryMetric}>{formatEntryMetrics(entry)}</Text>
      </View>
      <Text style={styles.activityDayEntryMeta} numberOfLines={2}>
        {getActivityCollectionPath(workspaces, entry.workspaceId, entry.collectionId)}
      </Text>
    </Pressable>
  );
}

export function ActivityDayDetailModal({
  visible,
  dayLabel,
  selectedDayTs,
  metricFilter,
  selectedDayEntries,
  effectiveWorkspaceId,
  selectedDayWorkspaceGroups,
  workspaces,
  showScopedIdeasAction,
  onClose,
  onOpenIdea,
  onShowScopedIdeas,
}: ActivityDayDetailModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalCard, styles.activityDayModalCard]} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>{dayLabel}</Text>
          <Text style={styles.subtitle}>
            {selectedDayEntries.length} {selectedDayEntries.length === 1 ? "item" : "items"}
          </Text>

          <ScrollView style={styles.activityDayEntryScroll} showsVerticalScrollIndicator={false}>
            {!effectiveWorkspaceId ? (
              <View style={styles.activityDayWorkspaceGroupList}>
                {selectedDayWorkspaceGroups.map((group) => (
                  <View key={group.workspaceId} style={styles.activityDayWorkspaceGroup}>
                    <Text style={styles.activityDayWorkspaceTitle}>{group.workspaceTitle}</Text>
                    <View style={styles.activityDayEntryList}>
                      {group.entries.map((entry) => renderEntryCard(entry, workspaces, onOpenIdea))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.activityDayEntryList}>
                {selectedDayEntries.map((entry) => renderEntryCard(entry, workspaces, onOpenIdea))}
              </View>
            )}
          </ScrollView>

          <View style={styles.activityDayModalActions}>
            {showScopedIdeasAction && selectedDayTs != null ? (
              <Pressable
                style={({ pressed }) => [styles.ideasHeaderSelectBtn, styles.activityDayOpenBtn, pressed ? styles.pressDown : null]}
                onPress={() => {
                  const dayStart = startOfActivityDay(selectedDayTs);
                  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
                  onShowScopedIdeas(dayStart, dayEnd, formatDayRangeLabel(dayStart, metricFilter));
                }}
              >
                <Text style={styles.ideasHeaderSelectBtnText}>Show in ideas</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, styles.activityDayCloseBtn, pressed ? styles.pressDown : null]}
              onPress={onClose}
            >
              <Text style={styles.primaryBtnText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
