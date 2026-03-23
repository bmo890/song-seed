import React, { useRef } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { BottomSheet, type BottomSheetRef } from "../common/BottomSheet";
import { type ClipLineage } from "../../clipGraph";
import { fmtDuration } from "../../utils";

type AssignLineageSheetProps = {
  visible: boolean;
  orphanTitle: string;
  lineages: ClipLineage[];
  onAssign: (targetLatestClipId: string) => void;
  onCancel: () => void;
};

export function AssignLineageSheet({
  visible,
  orphanTitle,
  lineages,
  onAssign,
  onCancel,
}: AssignLineageSheetProps) {
  const sheetRef = useRef<BottomSheetRef>(null);

  return (
    <BottomSheet ref={sheetRef} visible={visible} onClose={onCancel}>
      <View style={styles.clipActionsTitleBlock}>
        <Text style={styles.modalTitle}>Assign to lineage</Text>
        <Text style={styles.clipActionsSubtitle}>
          Choose where to place "{orphanTitle}"
        </Text>
      </View>
      <View style={[styles.collectionActionsOptionList, styles.clipActionsOptionList]}>
        {lineages.map((lineage) => {
          const clipCount = lineage.clipsOldestToNewest.length;
          return (
            <Pressable
              key={lineage.root.id}
              style={({ pressed }) => [
                styles.collectionActionsOption,
                styles.clipActionsOption,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => {
                onAssign(lineage.latestClip.id);
                sheetRef.current?.close();
              }}
            >
              <View style={localStyles.lineageRow}>
                <Ionicons name="git-branch-outline" size={16} color="#334155" />
                <View style={localStyles.lineageInfo}>
                  <Text style={styles.collectionActionsOptionText} numberOfLines={1}>
                    {lineage.root.title || "Untitled"}
                  </Text>
                  <Text style={localStyles.lineageMeta}>
                    {clipCount} {clipCount === 1 ? "take" : "takes"}
                    {lineage.latestClip.durationMs
                      ? ` · latest ${fmtDuration(lineage.latestClip.durationMs)}`
                      : ""}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
            </Pressable>
          );
        })}
        <Pressable
          style={({ pressed }) => [
            styles.collectionActionsOption,
            styles.clipActionsOption,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => sheetRef.current?.close()}
        >
          <View style={styles.collectionActionsOptionLead}>
            <Ionicons name="close-outline" size={16} color="#334155" />
            <Text style={styles.collectionActionsOptionText}>Cancel</Text>
          </View>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const localStyles = StyleSheet.create({
  lineageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  lineageInfo: {
    flex: 1,
    minWidth: 0,
  },
  lineageMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 1,
  },
});
