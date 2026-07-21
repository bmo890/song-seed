import React from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { styles } from "../../../styles";
import type { RevisitTag } from "../../../domain/revisit";
import { revisitStyles } from "../styles";
import { SourceFilterRow, type SourceFilterOption } from "../../common/SourceFilterRow";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

type WorkspaceGroup = {
  workspace: SourceFilterOption;
  collections: SourceFilterOption[];
};

const TAG_OPTIONS: {
  tag: RevisitTag;
  labelKey: string;
  descKey: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  {
    tag: "unfinished",
    labelKey: "revisit.unfinished",
    descKey: "revisit.unfinishedDesc",
    icon: "hourglass-outline",
  },
  {
    tag: "seed",
    labelKey: "revisit.rawIdeas",
    descKey: "revisit.rawIdeasDesc",
    icon: "leaf-outline",
  },
  {
    tag: "vault",
    labelKey: "revisit.deepCuts",
    descKey: "revisit.deepCutsDesc",
    icon: "albums-outline",
  },
  {
    tag: "anniversary",
    labelKey: "revisit.around",
    descKey: "revisit.aroundDesc",
    icon: "calendar-outline",
  },
];

type RevisitCustomizeSheetProps = {
  visible: boolean;
  onClose: () => void;
  groups: WorkspaceGroup[];
  expandedWorkspaceId: string | null;
  setExpandedWorkspaceId: (updater: (prev: string | null) => string | null) => void;
  setWorkspaceIncluded: (workspaceId: string, included: boolean) => void;
  setCollectionIncluded: (collectionId: string, included: boolean) => void;
  hasSourceOverrides: boolean;
  resetSourceFilters: () => void;
  hasHiddenItems: boolean;
  hiddenCount: number;
  restoreHiddenCandidates: () => void;
  tagPrefs: Record<string, boolean>;
  setTagEnabled: (tag: string, enabled: boolean) => void;
  dailyRefresh: boolean;
  setDailyRefresh: (value: boolean) => void;
};

export function RevisitCustomizeSheet({
  visible,
  onClose,
  groups,
  expandedWorkspaceId,
  setExpandedWorkspaceId,
  setWorkspaceIncluded,
  setCollectionIncluded,
  hasSourceOverrides,
  resetSourceFilters,
  hasHiddenItems,
  hiddenCount,
  restoreHiddenCandidates,
  tagPrefs,
  setTagEnabled,
  dailyRefresh,
  setDailyRefresh,
}: RevisitCustomizeSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={revisitStyles.sheetTitle}>{t("revisit.customize")}</Text>
      <Text style={revisitStyles.cardTagDetail}>
        {t("revisit.intro")}
      </Text>

      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <Text style={revisitStyles.sheetSectionLabel}>{t("revisit.whatToSurface")}</Text>
        {TAG_OPTIONS.map(({ tag, labelKey, descKey, icon }) => (
          <View key={tag} style={revisitStyles.toggleRow}>
            <View style={revisitStyles.toggleIconWrap}>
              <Ionicons name={icon} size={16} color={colors.primary} />
            </View>
            <View style={revisitStyles.toggleRowTextCol}>
              <Text style={revisitStyles.toggleRowText}>{t(labelKey)}</Text>
              <Text style={revisitStyles.toggleRowDesc}>{t(descKey)}</Text>
            </View>
            <Switch
              value={tagPrefs[tag] !== false}
              onValueChange={(next) => setTagEnabled(tag, next)}
              trackColor={{ false: "#E3DCD4", true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        ))}

        <Text style={revisitStyles.sheetSectionLabel}>{t("revisit.refresh")}</Text>
        <Text style={revisitStyles.sheetSectionDesc}>
          {t("revisit.refreshDesc")}
        </Text>
        <View style={revisitStyles.toggleRow}>
          <View style={revisitStyles.toggleIconWrap}>
            <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          </View>
          <View style={revisitStyles.toggleRowTextCol}>
            <Text style={revisitStyles.toggleRowText}>{t("revisit.daily")}</Text>
            <Text style={revisitStyles.toggleRowDesc}>
              {t("revisit.dailyDesc")}
            </Text>
          </View>
          <Switch
            value={dailyRefresh}
            onValueChange={setDailyRefresh}
            trackColor={{ false: "#E3DCD4", true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>

        <View style={revisitStyles.sheetHeader}>
          <Text style={revisitStyles.sheetSectionLabel}>{t("revisit.sources")}</Text>
          {hasSourceOverrides ? (
            <Pressable
              style={({ pressed }) => [revisitStyles.utilityButton, pressed ? styles.pressDown : null]}
              onPress={resetSourceFilters}
            >
              <Text style={revisitStyles.utilityButtonText}>{t("revisit.reset")}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={revisitStyles.sheetSectionDesc}>
          {t("revisit.sourcesDesc")}
        </Text>
        <View style={revisitStyles.sheetList}>
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

        {hasHiddenItems ? (
          <Pressable
            style={({ pressed }) => [
              revisitStyles.hiddenResetRow,
              { marginTop: 16 },
              pressed ? styles.pressDown : null,
            ]}
            onPress={restoreHiddenCandidates}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.primaryDeep} />
            <Text style={revisitStyles.hiddenResetText}>{t("revisit.restoreHidden", { count: hiddenCount })}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
