import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getHierarchyIconColor, getHierarchyIconName, type HierarchyLevel } from "../hierarchy";
import { styles } from "../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../design/tokens";
import { NavRow } from "./common/NavRow";

type CollectionLite = {
  id: string;
  title: string;
  level: "collection" | "subcollection";
  active?: boolean;
  nested?: boolean;
};

type Props = {
  currentRoute: "home" | "browse" | "revisit" | "activity" | "library" | "settings" | null;
  workspaceTitle: string | null;
  collections: CollectionLite[];
  onGoHome: () => void;
  onGoWorkspace: () => void;
  onGoRevisit: () => void;
  onGoActivity: () => void;
  onGoLibrary: () => void;
  onGoSettings: () => void;
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
  collections,
  onGoHome,
  onGoWorkspace,
  onGoRevisit,
  onGoActivity,
  onGoLibrary,
  onGoSettings,
  onOpenCollection,
  onClose,
}: Props) {
  return (
    <SafeAreaView style={sideNavStyles.shell}>
      <View style={sideNavStyles.header}>
        <View style={styles.flexFill} />

        <Pressable style={({ pressed }) => [sideNavStyles.closeBtn, pressed ? styles.pressDown : null]} onPress={onClose}>
          <Ionicons name="close" size={18} color="#6b7280" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        <Text style={sideNavStyles.sectionLabel}>Collections In Workspace</Text>
        {collections.length > 0 ? (
          <View style={sideNavStyles.collectionList}>
            {collections.map((collection) => (
              <NavRow
                key={collection.id}
                icon={renderNavItemIcon(collection.level).icon}
                iconColor={renderNavItemIcon(collection.level).color}
                label={collection.title}
                active={!!collection.active}
                nested={!!collection.nested}
                accessory={
                  collection.active ? (
                    <Text style={sideNavStyles.collectionMeta}>Open</Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  )
                }
                onPress={() => onOpenCollection(collection.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={sideNavStyles.placeholderText}>No collections in this workspace yet.</Text>
        )}

        <View style={sideNavStyles.divider} />

        <Text style={sideNavStyles.sectionLabel}>Global</Text>
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
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  sectionLabel: {
    ...textTokens.sectionTitle,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  collectionList: {
    gap: 4,
  },
  collectionMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  placeholderText: {
    ...textTokens.supporting,
    paddingHorizontal: 12,
  },
});
