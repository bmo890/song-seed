import React from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { styles } from "../../../styles";
import type { RevisitTag } from "../../../revisit";
import { revisitStyles } from "../styles";
import { SourceFilterRow, type SourceFilterOption } from "../../common/SourceFilterRow";
import { colors } from "../../../design/tokens";

type WorkspaceGroup = {
  workspace: SourceFilterOption;
  collections: SourceFilterOption[];
};

const TAG_OPTIONS: {
  tag: RevisitTag;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  {
    tag: "unfinished",
    label: "Unfinished",
    desc: "Ideas you actively worked on, then left untouched for a while.",
    icon: "hourglass-outline",
  },
  {
    tag: "seed",
    label: "Loose seeds",
    desc: "Raw clips you recorded once and never came back to develop.",
    icon: "leaf-outline",
  },
  {
    tag: "vault",
    label: "Deep cuts",
    desc: "Older, more developed work shuffled back into view at random.",
    icon: "albums-outline",
  },
  {
    tag: "anniversary",
    label: "Around this time",
    desc: "Ideas made around this date in previous years.",
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
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={revisitStyles.sheetTitle}>Customize Revisit</Text>
      <Text style={revisitStyles.cardTagDetail}>
        Older ideas resurface here so good work doesn't get lost.
      </Text>

      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <Text style={revisitStyles.sheetSectionLabel}>What to surface</Text>
        {TAG_OPTIONS.map(({ tag, label, desc, icon }) => (
          <View key={tag} style={revisitStyles.toggleRow}>
            <View style={revisitStyles.toggleIconWrap}>
              <Ionicons name={icon} size={16} color="#B87D6B" />
            </View>
            <View style={revisitStyles.toggleRowTextCol}>
              <Text style={revisitStyles.toggleRowText}>{label}</Text>
              <Text style={revisitStyles.toggleRowDesc}>{desc}</Text>
            </View>
            <Switch
              value={tagPrefs[tag] !== false}
              onValueChange={(next) => setTagEnabled(tag, next)}
              trackColor={{ false: "#E3DCD4", true: "#B87D6B" }}
              thumbColor="#ffffff"
            />
          </View>
        ))}

        <Text style={revisitStyles.sheetSectionLabel}>Refresh</Text>
        <Text style={revisitStyles.sheetSectionDesc}>
          How often Revisit reshuffles the daily set.
        </Text>
        <View style={revisitStyles.toggleRow}>
          <View style={revisitStyles.toggleIconWrap}>
            <Ionicons name="refresh-outline" size={16} color="#B87D6B" />
          </View>
          <View style={revisitStyles.toggleRowTextCol}>
            <Text style={revisitStyles.toggleRowText}>New set each day</Text>
            <Text style={revisitStyles.toggleRowDesc}>
              A fresh selection every day. Turn this off to keep today's set on screen until you add
              or change work.
            </Text>
          </View>
          <Switch
            value={dailyRefresh}
            onValueChange={setDailyRefresh}
            trackColor={{ false: "#E3DCD4", true: "#B87D6B" }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={revisitStyles.sheetHeader}>
          <Text style={revisitStyles.sheetSectionLabel}>Sources</Text>
          {hasSourceOverrides ? (
            <Pressable
              style={({ pressed }) => [revisitStyles.utilityButton, pressed ? styles.pressDown : null]}
              onPress={resetSourceFilters}
            >
              <Text style={revisitStyles.utilityButtonText}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={revisitStyles.sheetSectionDesc}>
          Which workspaces and collections Revisit can draw from.
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
            <Text style={revisitStyles.hiddenResetText}>Restore hidden ({hiddenCount})</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
