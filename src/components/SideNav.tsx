import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getHierarchyIconColor, getHierarchyIconName, type HierarchyLevel } from "../hierarchy";
import { styles } from "../styles";

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
  return (
    <Ionicons
      name={getHierarchyIconName(level)}
      size={16}
      color={getHierarchyIconColor(level)}
    />
  );
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
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#fff",
        borderTopRightRadius: 26,
        borderBottomRightRadius: 26,
        paddingHorizontal: 14,
        paddingTop: 18,
        paddingBottom: 18,
        gap: 8,
      }}
    >
      <View style={styles.sideNavHeader}>
        <View style={styles.flexFill} />

        <Pressable style={({ pressed }) => [styles.sideNavCloseBtn, pressed ? styles.pressDown : null]} onPress={onClose}>
          <Ionicons name="close" size={18} color="#6b7280" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.sideNavScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={[styles.sideNavItem, currentRoute === "home" ? styles.sideNavItemActive : null]}
          onPress={onGoHome}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {renderNavItemIcon("home")}
            <Text style={styles.sideNavItemLabel}>Home</Text>
          </View>
        </Pressable>

        <View style={styles.drawerDivider} />

        <Text style={styles.sideNavSectionLabel}>Workspace</Text>
        <Pressable
          style={({ pressed }) => [
            styles.sideNavWorkspaceBtn,
            currentRoute === "browse" ? styles.sideNavItemActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onGoWorkspace}
          disabled={!workspaceTitle}
        >
          <Ionicons name={getHierarchyIconName("workspace")} size={18} color={getHierarchyIconColor("workspace")} />
          <View style={styles.sideNavWorkspaceCopy}>
            <Text style={styles.sideNavLabel}>{workspaceTitle ?? "No workspace"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>

        <Text style={styles.sideNavSectionLabel}>Collections</Text>
        {collections.length > 0 ? (
          <>
            <View style={styles.sideNavCollectionList}>
              {collections.map((collection) => (
                <Pressable
                  key={collection.id}
                  style={[
                    styles.sideNavItem,
                    collection.active ? styles.sideNavItemActive : null,
                    collection.nested ? styles.sideNavNestedCollectionRow : null,
                  ]}
                  onPress={() => onOpenCollection(collection.id)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {renderNavItemIcon(collection.level)}
                    <Text style={styles.sideNavItemLabel}>{collection.title}</Text>
                  </View>
                  {collection.active ? (
                    <Text style={styles.sideNavCollectionMeta}>Open</Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  )}
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.sideNavPlaceholderText}>No collections in this workspace yet.</Text>
        )}

        <View style={styles.drawerDivider} />

        <Text style={styles.sideNavSectionLabel}>Global</Text>
        <Pressable
          style={[styles.sideNavItem, currentRoute === "revisit" ? styles.sideNavItemActive : null]}
          onPress={onGoRevisit}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {renderNavItemIcon("revisit")}
            <Text style={styles.sideNavItemLabel}>Revisit</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.sideNavItem, currentRoute === "activity" ? styles.sideNavItemActive : null]}
          onPress={onGoActivity}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {renderNavItemIcon("activity")}
            <Text style={styles.sideNavItemLabel}>Activity</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.sideNavItem, currentRoute === "library" ? styles.sideNavItemActive : null]}
          onPress={onGoLibrary}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {renderNavItemIcon("library")}
            <Text style={styles.sideNavItemLabel}>Library</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.sideNavItem, currentRoute === "settings" ? styles.sideNavItemActive : null]}
          onPress={onGoSettings}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {renderNavItemIcon("settings")}
            <Text style={styles.sideNavItemLabel}>Settings</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
