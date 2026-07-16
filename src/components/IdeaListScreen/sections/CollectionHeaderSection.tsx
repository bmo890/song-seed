import ReAnimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IdeaListHeaderSection } from "../components/IdeaListHeaderSection";
import { WorkspaceAvatar } from "../../common/WorkspaceAvatar";
import { IconButton } from "../../common/IconButton";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";
import { radii, colors } from "../../../design/tokens";
import { formatLastEdited } from "../../../utils";

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
        testID={screen.showBack ? "header-back" : "header-menu"}
        style={({ pressed }) => [collStyles.navBtn, pressed ? styles.pressDown : null]}
        onPress={screen.showBack ? screen.onBack : screen.openDrawer}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={screen.showBack ? "Back" : "Open menu"}
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
        <IconButton
          testID="collection-overflow"
          icon="ellipsis-horizontal"
          tone="muted"
          size={20}
          onPress={() => screen.setHeaderMenuOpen((prev) => !prev)}
          accessibilityLabel="Collection options"
        />
      ) : (
        <View style={styles.ideasHeaderMenuBtnPlaceholder} />
      )}
    </View>
  );
}

/**
 * Dismissible "‹ Back to {origin}" chip for a contextual open (from Search,
 * Activity, or Revisit). Tapping the chip jumps back to that origin; ✕ dismisses
 * it. The system back button is left alone — it always steps up the hierarchy.
 */
export function CollectionContextReturnChip() {
  const { screen } = useCollectionScreen();
  const contextualReturn = screen.contextualReturn;
  if (!contextualReturn) return null;

  return (
    <View style={collStyles.returnChipRow} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [collStyles.returnChip, pressed ? styles.pressDown : null]}
        onPress={contextualReturn.onReturn}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${contextualReturn.label}`}
      >
        <Ionicons name="arrow-back" size={13} color={colors.primaryDeep} />
        <Text style={collStyles.returnChipText} numberOfLines={1}>
          Back to {contextualReturn.label}
        </Text>
        <Pressable
          onPress={contextualReturn.onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={({ pressed }) => [collStyles.returnChipClose, pressed ? styles.pressDown : null]}
        >
          <Ionicons name="close" size={13} color="#a89994" />
        </Pressable>
      </Pressable>
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

  const eyebrowText = screen.breadcrumbs.join("  ›  ");
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
  returnChipRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  returnChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "#F4ECE9",
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  returnChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.primaryDeep,
    flexShrink: 1,
  },
  returnChipClose: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
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
