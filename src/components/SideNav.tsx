import { useState } from "react";
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
  const [recentExpanded, setRecentExpanded] = useState(true);

  return (
    <SafeAreaView style={sideNavStyles.shell}>
      {/* Close button — right-aligned, no border */}
      <View style={sideNavStyles.header}>
        <Pressable
          style={({ pressed }) => [sideNavStyles.closeBtn, pressed ? styles.pressDown : null]}
          onPress={onClose}
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color="#84736f" />
        </Pressable>
      </View>

      {/* Scrollable nav content */}
      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Home */}
        <NavRow
          icon={navIcon("home").icon}
          iconColor={navIcon("home").color}
          label="Home"
          active={currentRoute === "home"}
          onPress={onGoHome}
        />

        {/* Workspace section */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabel}>Workspace</Text>
        <NavRow
          icon={navIcon("workspace").icon}
          iconColor={navIcon("workspace").color}
          label={workspaceTitle ?? "No workspace"}
          eyebrow="Browse"
          active={currentRoute === "browse"}
          disabled={!workspaceTitle}
          accessory={<Ionicons name="chevron-forward" size={14} color="#84736f" />}
          onPress={onGoWorkspace}
        />

        {/* Recent collections — collapsible */}
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
            size={12}
            color="#84736f"
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
                        name={navIcon(collection.level).icon}
                        size={14}
                        color={navIcon(collection.level).color}
                      />
                      <Text style={sideNavStyles.recentItemTitle} numberOfLines={1}>
                        {collection.title}
                      </Text>
                    </View>
                    {collection.meta ? (
                      <Text style={sideNavStyles.recentItemMeta} numberOfLines={1}>
                        {collection.meta}
                      </Text>
                    ) : null}
                  </View>
                  {collection.active ? (
                    <Text style={sideNavStyles.recentItemOpenLabel}>Open</Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={14} color="#84736f" />
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={sideNavStyles.placeholderText}>
              Recently opened collections will appear here.
            </Text>
          )
        ) : null}

        {/* Tools section */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabel}>Tools</Text>
        <NavRow
          icon="search"
          iconColor="#84736f"
          label="Search"
          active={currentRoute === "search"}
          onPress={onGoSearch}
        />
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
        <NavRow
          icon={navIcon("notepad").icon}
          iconColor={navIcon("notepad").color}
          label="Notepad"
          active={currentRoute === "notepad"}
          onPress={onGoNotepad}
        />
        <NavRow
          icon={navIcon("library").icon}
          iconColor={navIcon("library").color}
          label="Library"
          active={currentRoute === "library"}
          onPress={onGoLibrary}
        />
      </ScrollView>

      {/* Settings — pinned footer, always visible without scrolling */}
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
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  collectionList: {
    gap: 2,
    paddingLeft: 8,
  },
  recentItem: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  recentItemActive: {
    backgroundColor: "#efeeea",
  },
  recentItemCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  recentItemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  recentItemTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: "#1b1c1a",
    fontWeight: "500",
  },
  recentItemMeta: {
    fontSize: 11,
    color: "#84736f",
    fontWeight: "500",
    paddingLeft: 22,
  },
  recentItemOpenLabel: {
    fontSize: 10,
    color: "#84736f",
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
