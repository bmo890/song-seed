import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "../../common/BottomSheet";
import { Press } from "../../common/Press";
import { SourceFilterRow, type SourceFilterOption } from "../../common/SourceFilterRow";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

type WorkspaceGroup = {
  workspace: SourceFilterOption;
  collections: SourceFilterOption[];
};

type ActivityCustomizeSheetProps = {
  visible: boolean;
  onClose: () => void;
  groups: WorkspaceGroup[];
  expandedWorkspaceId: string | null;
  setExpandedWorkspaceId: (updater: (prev: string | null) => string | null) => void;
  setWorkspaceIncluded: (workspaceId: string, included: boolean) => void;
  setCollectionIncluded: (collectionId: string, included: boolean) => void;
  hasSourceOverrides: boolean;
  resetSourceFilters: () => void;
};

export function ActivityCustomizeSheet({
  visible,
  onClose,
  groups,
  expandedWorkspaceId,
  setExpandedWorkspaceId,
  setWorkspaceIncluded,
  setCollectionIncluded,
  hasSourceOverrides,
  resetSourceFilters,
}: ActivityCustomizeSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t("activity.customize")}</Text>

      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.sectionLabel}>{t("activity.sources")}</Text>
          {hasSourceOverrides ? (
            <Press
              // Haptics vocabulary: tap, an acknowledged press.
              haptic="tap"
              feel="glyph"
              onPress={resetSourceFilters}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.resetText}>{t("activity.reset")}</Text>
            </Press>
          ) : null}
        </View>
        <View style={styles.rule} />

        <View style={styles.list}>
          {groups.map(({ workspace, collections }) => (
            <SourceFilterRow
              key={workspace.id}
              option={workspace}
              collections={collections}
              expanded={expandedWorkspaceId === workspace.id}
              onToggleWorkspace={() => setWorkspaceIncluded(workspace.id, !workspace.included)}
              onToggleExpand={() =>
                setExpandedWorkspaceId((prev) => (prev === workspace.id ? null : workspace.id))
              }
              onToggleCollection={(collectionId, included) =>
                setCollectionIncluded(collectionId, included)
              }
            />
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// Rows on paper, as Revisit's Customize (2026-10-16): a Jakarta title, the
// label on a hairline, Reset an ink word; no paragraph explaining the rows.
const styles = StyleSheet.create({
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  resetText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
  // Rows on paper: hairlines do the separating.
  list: {
    paddingBottom: 8,
  },
});
