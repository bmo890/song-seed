import ReAnimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
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

/**
 * Fixed nav row: back/hamburger, compact workspace identity (fades in as the
 * large identity block slides away beneath it), overflow menu.
 */
export function CollectionHeaderSection() {
  const { screen } = useCollectionScreen();

  const collection = screen.currentCollection;
  const workspace = screen.activeWorkspace;

  // Compact identity fades in across the last stretch of the identity block's
  // slide-out, so one title is always readable — never both, never neither.
  // Locals only: capturing `screen` would serialize the whole context into the worklet.
  const scrollY = screen.scrollY;
  const collapsibleHeaderHeight = screen.collapsibleHeaderHeight;
  const compactTitleStyle = useAnimatedStyle(() => {
    const h = collapsibleHeaderHeight.value;
    if (h <= 0) return { opacity: 0 };
    return {
      opacity: interpolate(
        scrollY.value,
        [h * 0.45, h * 0.95],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
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

      {/* Compact identity: fades in when the identity block scrolls away */}
      <ReAnimated.View style={[collStyles.navCompact, compactTitleStyle]} pointerEvents="none">
        {workspace ? (
          <WorkspaceAvatar
            color={workspace.color}
            name={workspace.title}
            size={16}
            avatarKey={workspace.avatarKey}
          />
        ) : null}
        <Text style={collStyles.navCompactTitle} numberOfLines={1}>
          {collection?.title ?? ""}
        </Text>
      </ReAnimated.View>

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
  );
}

/**
 * The collapsible identity block (workspace eyebrow, large collection title,
 * seeds/edited meta, description). Rendered inside CollapsingHeaderOverlay so
 * it slides up and clips away under the nav on scroll.
 */
export function CollectionCollapsibleIdentity() {
  const { screen } = useCollectionScreen();
  const collection = screen.currentCollection;
  const workspace = screen.activeWorkspace;
  if (!collection) return null;

  const eyebrowText = screen.breadcrumbs.map((b) => b.label).join("  ›  ");
  const seedMeta = screen.ideasHeaderMeta.replace(/\bideas?\b/g, (m) =>
    m === "idea" ? "seed" : "seeds"
  );
  const lastEditedMeta = formatLastEdited(collection.updatedAt);
  const metaLine = [seedMeta, lastEditedMeta].filter(Boolean).join("  ·  ");

  return (
    // Non-interactive: drags on the title fall through to the list beneath.
    <View style={collStyles.identityBlock} pointerEvents="none">
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
  );
}

/** Search field + clipboard/duplicate banners — pinned under the nav. */
export function CollectionSearchSection() {
  const { screen } = useCollectionScreen();
  const cancelClipboard = () => useStore.getState().setClipClipboard(null);

  return (
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
  );
}

const collStyles = StyleSheet.create({
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    marginBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  navCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  navCompactTitle: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    color: "#1C1C19",
  },
  identityBlock: {
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 4,
    backgroundColor: "#FDFBF7",
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
