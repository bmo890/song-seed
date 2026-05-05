import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getHierarchyIconColor, getHierarchyIconName, type HierarchyLevel } from "../hierarchy";
import { styles } from "../styles";
import { radii, shadows } from "../design/tokens";
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
  onGoHome: () => void;        // used by ⇄ to switch workspace
  onGoWorkspace: () => void;   // tapping the workspace name → collections
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
  return (
    <SafeAreaView style={sideNavStyles.shell}>

      {/* ── Header row: close + workspace context ─────────────────────── */}
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
        {/* Workspace name → collections  |  ⇄ → switch workspace */}
        <Pressable
          style={({ pressed }) => [
            sideNavStyles.workspaceRow,
            currentRoute === "browse" ? sideNavStyles.workspaceRowActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onGoWorkspace}
          disabled={!workspaceTitle}
        >
          <Ionicons
            name={navIcon("workspace").icon}
            size={16}
            color={workspaceTitle ? navIcon("workspace").color : "#c4b5b2"}
          />
          <Text
            style={[sideNavStyles.workspaceName, !workspaceTitle && sideNavStyles.workspaceNameEmpty]}
            numberOfLines={1}
          >
            {workspaceTitle ?? "No workspace"}
          </Text>
          <Pressable
            style={({ pressed }) => [sideNavStyles.switchBtn, pressed ? styles.pressDown : null]}
            onPress={onGoHome}
            hitSlop={8}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#84736f" />
          </Pressable>
        </Pressable>

        {/* Search — scoped to workspace context */}
        <NavRow
          icon="search-outline"
          iconColor="#84736f"
          label="Search"
          active={currentRoute === "search"}
          onPress={onGoSearch}
        />

        {/* Recent collections */}
        {recentCollections.length > 0 ? (
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
                <Ionicons
                  name={navIcon(collection.level).icon}
                  size={14}
                  color={navIcon(collection.level).color}
                />
                <View style={sideNavStyles.recentItemCopy}>
                  <Text style={sideNavStyles.recentItemTitle} numberOfLines={1}>
                    {collection.title}
                  </Text>
                  {collection.meta ? (
                    <Text style={sideNavStyles.recentItemMeta} numberOfLines={1}>
                      {collection.meta}
                    </Text>
                  ) : null}
                </View>
                {collection.active ? (
                  <Text style={sideNavStyles.recentItemOpenLabel}>Open</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={14} color="#c4b5b2" />
                )}
              </Pressable>
            ))}
          </View>
        ) : workspaceTitle ? (
          <Text style={sideNavStyles.placeholderText}>
            Recently opened collections will appear here.
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Explore ───────────────────────────────────────────────────── */}
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

        {/* ── Tools ─────────────────────────────────────────────────────── */}
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

      {/* ── Settings — pinned footer ───────────────────────────────────── */}
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

  // Workspace context block (above the scroll)
  workspaceBlock: {
    paddingHorizontal: 10,
    gap: 2,
  },
  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  workspaceRowActive: {
    backgroundColor: "#efeeea",
  },
  workspaceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#1b1c1a",
    letterSpacing: 0.1,
  },
  workspaceNameEmpty: {
    color: "#84736f",
    fontWeight: "500",
  },
  switchBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },

  // Recent collections
  collectionList: {
    gap: 2,
    paddingLeft: 4,
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
  recentItemOpenLabel: {
    fontSize: 10,
    color: "#824f3f",
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  placeholderText: {
    fontSize: 12,
    color: "#84736f",
    paddingHorizontal: 12,
    paddingVertical: 6,
    lineHeight: 18,
  },

  // Scrollable section
  scrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 2,
  },
  divider: {
    height: 0.5,
    backgroundColor: "#d7c2bd",
    opacity: 0.5,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#84736f",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    marginBottom: 2,
  },

  // Pinned footer
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
