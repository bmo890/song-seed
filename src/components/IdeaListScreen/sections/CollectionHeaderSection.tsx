import ReAnimated from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IdeaListHeaderSection } from "../components/IdeaListHeaderSection";
import { WorkspaceAvatar } from "../../common/WorkspaceAvatar";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";

function formatLastEdited(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `Edited ${days} days ago`;
  if (days < 14) return "Edited last week";
  return `Edited ${new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function CollectionHeaderSection() {
  const { screen } = useCollectionScreen();
  const cancelClipboard = () => useStore.getState().setClipClipboard(null);

  const collection = screen.currentCollection;
  const workspace = screen.activeWorkspace;

  // Eyebrow: workspace › parent collections
  const eyebrowText = screen.breadcrumbs.map((b) => b.label).join("  ›  ");

  // Meta line: seed count + last edited
  const seedMeta = screen.ideasHeaderMeta.replace(/\bideas?\b/g, (m) =>
    m === "idea" ? "seed" : "seeds"
  );
  const lastEditedMeta = collection ? formatLastEdited(collection.updatedAt) : null;
  const metaLine = [seedMeta, lastEditedMeta].filter(Boolean).join("  ·  ");

  return (
    <>
      {/* ── Top nav row ─────────────────────────────────────────────────── */}
      <View style={collStyles.navRow}>
        <Pressable
          style={({ pressed }) => [collStyles.navBtn, pressed ? styles.pressDown : null]}
          onPress={screen.onBack}
          hitSlop={8}
        >
          {screen.showBack ? (
            <Ionicons name="chevron-back" size={20} color="#84736f" />
          ) : (
            <Ionicons name="menu-outline" size={22} color="#84736f" />
          )}
        </Pressable>

        {!screen.listSelectionMode ? (
          <Pressable
            style={({ pressed }) => [styles.ideasHeaderMenuBtn, pressed ? styles.pressDown : null]}
            onPress={() => screen.setHeaderMenuOpen((prev) => !prev)}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color="#84736f" />
          </Pressable>
        ) : (
          <View style={styles.ideasHeaderMenuBtnPlaceholder} />
        )}
      </View>

      {/* ── Collection identity block ────────────────────────────────────── */}
      {collection ? (
        <View style={collStyles.identityBlock}>
          {eyebrowText ? (
            <View style={collStyles.eyebrowRow}>
              {workspace ? (
                <WorkspaceAvatar
                  color={workspace.color}
                  name={workspace.title}
                  size={18}
                  avatarKey={workspace.avatarKey}
                />
              ) : null}
              <Text style={collStyles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>
            </View>
          ) : null}
          <Text style={collStyles.collectionTitle} numberOfLines={2}>
            {collection.title}
          </Text>
          <Text style={collStyles.meta}>{metaLine}</Text>
          {collection.description ? (
            <Text style={collStyles.description} numberOfLines={2}>
              {collection.description}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Collapsible search + banners ────────────────────────────────── */}
      <ReAnimated.View style={screen.headerCollapseAnimStyle}>
        <IdeaListHeaderSection
          searchQuery={screen.searchQuery}
          hasActivityRangeFilter={screen.hasActivityRangeFilter}
          activityLabel={screen.activityLabel}
          collectionId={screen.collectionId!}
          clipClipboard={screen.clipClipboard}
          duplicateWarningText={screen.duplicateWarningText}
          onSearchQueryChange={screen.setSearchQuery}
          onClearActivityRange={() => {
            (screen.navigation as any).setParams({
              activityRangeStartTs: undefined,
              activityRangeEndTs: undefined,
              activityMetricFilter: undefined,
              activityLabel: undefined,
            });
          }}
          onPasteClipboard={() => {
            void appActions.pasteClipboardToCollection(screen.collectionId!);
          }}
          onCancelClipboard={cancelClipboard}
        />
      </ReAnimated.View>
    </>
  );
}

const collStyles = StyleSheet.create({
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    marginBottom: 20,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  identityBlock: {
    marginBottom: 20,
    gap: 4,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
    color: "#526351",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  collectionTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 36,
    lineHeight: 44,
    color: "#1C1C19",
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#84736f",
    marginTop: 2,
  },
  description: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#524440",
    marginTop: 2,
  },
});
