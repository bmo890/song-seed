import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getHierarchyIconColor, getHierarchyIconName, type HierarchyLevel } from "../hierarchy";
import { styles } from "../styles";
import { radii, shadows } from "../design/tokens";
import { NavRow } from "./common/NavRow";
import { WorkspaceAvatar } from "./common/WorkspaceAvatar";
import { getWorkspaceTheme } from "../workspaceTheme";

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
  workspaceColor?: string;
  recentCollections: RecentCollectionLite[];
  onGoHome: () => void;       // Switch workspace (home = workspace picker)
  onGoWorkspace: () => void;  // Collections for current workspace
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

function navIcon(level: HierarchyLevel) {
  return {
    icon: getHierarchyIconName(level),
    color: getHierarchyIconColor(level),
  };
}

export function SideNav({
  currentRoute,
  workspaceTitle,
  workspaceColor,
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
  const mostRecent = recentCollections[0] ?? null;
  const workspaceTheme = getWorkspaceTheme(workspaceColor);

  return (
    <SafeAreaView style={sideNavStyles.shell}>

      {/* ── Close ─────────────────────────────────────────────────────── */}
      <View style={sideNavStyles.header}>
        <Pressable
          style={({ pressed }) => [sideNavStyles.closeBtn, pressed ? styles.pressDown : null]}
          onPress={onClose}
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color="#84736f" />
        </Pressable>
      </View>

      {/* ── Workspace context block ────────────────────────────────────── */}
      <View style={sideNavStyles.workspaceBlock}>

        {/* Workspace identity card */}
        <View style={[sideNavStyles.workspaceCard, { backgroundColor: workspaceTheme.tint }]}>
          {/* Label row with dot */}
          <View style={sideNavStyles.workspaceLabelRow}>
            <View style={sideNavStyles.contextDot} />
            <Text style={sideNavStyles.sectionLabel}>Workspace</Text>
          </View>

          {/* Workspace name + swap icon inline */}
          <View style={sideNavStyles.workspaceNameRow}>
            <WorkspaceAvatar
              color={workspaceColor}
              name={workspaceTitle ?? "?"}
              size={32}
            />
            <Text style={sideNavStyles.workspaceName} numberOfLines={1}>
              {workspaceTitle ?? "No workspace"}
            </Text>
            <Pressable
              style={({ pressed }) => [sideNavStyles.switchBtn, pressed ? styles.pressDown : null]}
              onPress={onGoHome}
              hitSlop={10}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color="#84736f" />
            </Pressable>
          </View>

          {/* Collections chip */}
          {workspaceTitle ? (
            <View style={sideNavStyles.actionRow}>
              <Pressable
                style={({ pressed }) => [sideNavStyles.actionChip, pressed ? styles.pressDown : null]}
                onPress={onGoWorkspace}
              >
                <Text style={sideNavStyles.actionChipLabel}>Collections</Text>
                <Ionicons name="chevron-forward" size={13} color="#524440" />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Search — workspace-scoped */}
        <NavRow
          icon="search-outline"
          iconColor="#84736f"
          label="Search"
          active={currentRoute === "search"}
          onPress={onGoSearch}
        />

        {/* Most recent collection */}
        {mostRecent ? (
          <>
            <View style={sideNavStyles.recentLabelRow}>
              <Text style={sideNavStyles.sectionLabel}>Recent</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                sideNavStyles.recentItem,
                mostRecent.active ? sideNavStyles.recentItemActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onOpenCollection(mostRecent.id)}
            >
              <Ionicons
                name={navIcon(mostRecent.level).icon}
                size={14}
                color={navIcon(mostRecent.level).color}
              />
              <View style={sideNavStyles.recentItemCopy}>
                <Text style={sideNavStyles.recentItemTitle} numberOfLines={1}>
                  {mostRecent.title}
                </Text>
                {mostRecent.meta ? (
                  <Text style={sideNavStyles.recentItemMeta} numberOfLines={1}>
                    {mostRecent.meta}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color="#c4b5b2" />
            </Pressable>
          </>
        ) : null}
      </View>

      {/* ── Scrollable lower sections ──────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Explore */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabel}>Explore</Text>
        <NavRow
          icon={navIcon("revisit").icon}
          iconColor={navIcon("revisit").color}
          label="Revisit"
          active={currentRoute === "revisit"}
          onPress={onGoRevisit}
        />
        <NavRow
          icon={navIcon("activity").icon}
          iconColor={navIcon("activity").color}
          label="Activity"
          active={currentRoute === "activity"}
          onPress={onGoActivity}
        />
        <NavRow
          icon={navIcon("library").icon}
          iconColor={navIcon("library").color}
          label="Library"
          active={currentRoute === "library"}
          onPress={onGoLibrary}
        />

        {/* Tools */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabel}>Tools</Text>
        <NavRow
          icon={navIcon("notepad").icon}
          iconColor={navIcon("notepad").color}
          label="Notepad"
          active={currentRoute === "notepad"}
          onPress={onGoNotepad}
        />
        <NavRow
          icon={navIcon("tuner").icon}
          iconColor={navIcon("tuner").color}
          label="Tuner"
          active={currentRoute === "tuner"}
          onPress={onGoTuner}
        />
        <NavRow
          icon={navIcon("metronome").icon}
          iconColor={navIcon("metronome").color}
          label="Metronome"
          active={currentRoute === "metronome"}
          onPress={onGoMetronome}
        />
      </ScrollView>

      {/* ── Settings pinned footer ─────────────────────────────────────── */}
      <View style={sideNavStyles.footer}>
        <View style={sideNavStyles.footerDivider} />
        <NavRow
          icon={navIcon("settings").icon}
          iconColor={navIcon("settings").color}
          label="Settings"
          active={currentRoute === "settings"}
          onPress={onGoSettings}
        />
      </View>

    </SafeAreaView>
  );
}

const sideNavStyles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#fbf9f5",
    borderTopRightRadius: radii.drawer,
    borderBottomRightRadius: radii.drawer,
    ...shadows.drawer,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  // Workspace block
  workspaceBlock: {
    paddingHorizontal: 10,
    gap: 6,
  },
  workspaceCard: {
    backgroundColor: "#efeeea",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
    marginHorizontal: 2,
  },
  workspaceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contextDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#824f3f",
  },
  workspaceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  workspaceName: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#1b1c1a",
    letterSpacing: 0.1,
  },
  switchBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#524440",
  },

  // Recent
  recentLabelRow: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
  },
  recentItemActive: {
    backgroundColor: "#efeeea",
  },
  recentItemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recentItemTitle: {
    fontSize: 14,
    color: "#1b1c1a",
    fontWeight: "500",
  },
  recentItemMeta: {
    fontSize: 11,
    color: "#84736f",
  },

  // Scrollable sections
  scrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#84736f",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  divider: {
    height: 0.5,
    backgroundColor: "#d7c2bd",
    opacity: 0.5,
    marginVertical: 8,
    marginHorizontal: 12,
  },

  // Footer
  footer: {
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  footerDivider: {
    height: 0.5,
    backgroundColor: "#d7c2bd",
    opacity: 0.5,
    marginBottom: 6,
    marginHorizontal: 12,
  },
});
