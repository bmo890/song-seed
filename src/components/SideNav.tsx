import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getHierarchyIconColor, getHierarchyIconName, type HierarchyLevel } from "../hierarchy";
import { styles } from "../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../design/tokens";
import { NavRow } from "./common/NavRow";

type RecentCollectionLite = {
  id: string;
  title: string;
  level: "collection";
  meta?: string;
  active?: boolean;
};

type Props = {
  currentRoute:
    | "home"
    | "browse"
    | "search"
    | "revisit"
    | "activity"
    | "tuner"
    | "metronome"
    | "library"
    | "settings"
    | "notepad"
    | null;
  workspaceTitle: string | null;
  recentCollections: RecentCollectionLite[];
  onGoHome: () => void;
  onGoWorkspace: () => void;
  onGoSearch: () => void;
  onGoRevisit: () => void;
  onGoActivity: () => void;
  onGoTuner: () => void;
  onGoMetronome: () => void;
  onGoLibrary: () => void;
  onGoSettings: () => void;
  onGoNotepad: () => void;
  onOpenCollection: (collectionId: string) => void;
  onClose: () => void;
};

function renderNavItemIcon(level: HierarchyLevel) {
  return {
    icon: getHierarchyIconName(level),
    color: getHierarchyIconColor(level),
  };
}

export function SideNav({
  currentRoute,
  workspaceTitle,
  recentCollections,
  onGoHome,
  onGoWorkspace,
  onGoSearch,
  onGoRevisit,
  onGoActivity,
  onGoTuner,
  onGoMetronome,
  onGoLibrary,
  onGoSettings,
  onGoNotepad,
  onOpenCollection,
  onClose,
}: Props) {
  const [recentExpanded, setRecentExpanded] = useState(true);

  return (
    <SafeAreaView style={sideNavStyles.shell}>
      <View style={sideNavStyles.header}>
        <View style={styles.flexFill} />

        <Pressable
          style={({ pressed }) => [sideNavStyles.closeBtn, pressed ? styles.pressDown : null]}
          onPress={onClose}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={sideNavStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <NavRow
          icon={renderNavItemIcon("home").icon}
          iconColor={renderNavItemIcon("home").color}
          label="Home"
          active={currentRoute === "home"}
          onPress={onGoHome}
        />

        <View style={sideNavStyles.divider} />

        <Text style={sideNavStyles.sectionLabel}>Current Workspace</Text>
        <NavRow
          icon={renderNavItemIcon("workspace").icon}
          iconColor={renderNavItemIcon("workspace").color}
          label={workspaceTitle ?? "No workspace"}
          eyebrow="Browse"
          active={currentRoute === "browse"}
          disabled={!workspaceTitle}
          accessory={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
          onPress={onGoWorkspace}
        />

        <Pressable
          style={({ pressed }) => [
            sideNavStyles.sectionToggle,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => setRecentExpanded((prev) => !prev)}
          disabled={!workspaceTitle}
        >
          <Text style={sideNavStyles.sectionLabel}>Recent</Text>
          <Ionicons
            name={recentExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.textMuted}
          />
        </Pressable>
        {recentExpanded ? (
          recentCollections.length > 0 ? (
            <View style={sideNavStyles.collectionList}>
              {recentCollections.map((collection) => (
                <Pressable
                  key={collection.id}
                  style={({ pressed }) => [
                    sideNavStyles.recentItem,
                    collection.active ? sideNavStyles.recentItemActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => onOpenCollection(collection.id)}
                >
                  <View style={sideNavStyles.recentItemCopy}>
                    <View style={sideNavStyles.recentItemTitleRow}>
                      <Ionicons
                        name={renderNavItemIcon(collection.level).icon}
                        size={16}
                        color={renderNavItemIcon(collection.level).color}
                      />
                      <Text style={sideNavStyles.recentItemTitle}>{collection.title}</Text>
                    </View>
                    {collection.meta ? (
                      <Text style={sideNavStyles.recentItemMeta} numberOfLines={1}>
                        {collection.meta}
                      </Text>
                    ) : null}
                  </View>
                  {collection.active ? (
                    <Text style={sideNavStyles.collectionMeta}>Open</Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={sideNavStyles.placeholderText}>
              Recently opened collection paths from this workspace will appear here.
            </Text>
          )
        ) : null}

        <View style={sideNavStyles.divider} />

        <Text style={sideNavStyles.sectionLabel}>Global</Text>
        <NavRow
          icon="search"
          iconColor={colors.textSecondary}
          label="Search"
          active={currentRoute === "search"}
          onPress={onGoSearch}
        />
        <NavRow
          icon={renderNavItemIcon("revisit").icon}
          iconColor={renderNavItemIcon("revisit").color}
          label="Revisit"
          active={currentRoute === "revisit"}
          onPress={onGoRevisit}
        />
        <NavRow
          icon={renderNavItemIcon("activity").icon}
          iconColor={renderNavItemIcon("activity").color}
          label="Activity"
          active={currentRoute === "activity"}
          onPress={onGoActivity}
        />
        <NavRow
          icon={renderNavItemIcon("tuner").icon}
          iconColor={renderNavItemIcon("tuner").color}
          label="Tuner"
          active={currentRoute === "tuner"}
          onPress={onGoTuner}
        />
        <NavRow
          icon={renderNavItemIcon("metronome").icon}
          iconColor={renderNavItemIcon("metronome").color}
          label="Metronome"
          active={currentRoute === "metronome"}
          onPress={onGoMetronome}
        />
        <NavRow
          icon={renderNavItemIcon("notepad").icon}
          iconColor={renderNavItemIcon("notepad").color}
          label="Notepad"
          active={currentRoute === "notepad"}
          onPress={onGoNotepad}
        />
        <NavRow
          icon={renderNavItemIcon("library").icon}
          iconColor={renderNavItemIcon("library").color}
          label="Library"
          active={currentRoute === "library"}
          onPress={onGoLibrary}
        />
        <NavRow
          icon={renderNavItemIcon("settings").icon}
          iconColor={renderNavItemIcon("settings").color}
          label="Settings"
          active={currentRoute === "settings"}
          onPress={onGoSettings}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const sideNavStyles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopRightRadius: radii.drawer,
    borderBottomRightRadius: radii.drawer,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 18,
    gap: spacing.sm,
    ...shadows.drawer,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    marginVertical: 4,
  },
  sectionLabel: {
    ...textTokens.caption,
    color: colors.textSecondary,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  sectionToggle: {
    minHeight: 32,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  collectionList: {
    gap: 4,
    paddingLeft: 10,
  },
  recentItem: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  recentItemActive: {
    backgroundColor: colors.surfaceSelected,
  },
  recentItemCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  recentItemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  recentItemTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  recentItemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  collectionMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
  },
  placeholderText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
