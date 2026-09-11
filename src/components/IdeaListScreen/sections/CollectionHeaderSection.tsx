import ReAnimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { IdeaListHeaderSection } from "../components/IdeaListHeaderSection";
import { WorkspaceAvatar } from "../../common/WorkspaceAvatar";
import { IconButton } from "../../common/IconButton";
import { PickerEyebrow } from "../../common/PickerEyebrow";
import { getLibraryCollectorIcon } from "../../../domain/libraryCollectorPresentation";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";
import { radii, colors } from "../../../design/tokens";
import { formatLastEdited } from "../../../utils";
import { getCollectionLastWorkedAt } from "../../../domain/libraryNavigation";
import { UserText } from "../../../i18n";
import { useTranslation } from "react-i18next";

/**
 * Fixed nav row: back/hamburger, compact workspace identity (fades in as the
 * large identity block slides away beneath it), overflow menu.
 */
export function CollectionHeaderSection() {
  const { t } = useTranslation();
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
  // The WHERE · WHAT eyebrow owns the same slot and yields it to the compact
  // title over the same window.
  const eyebrowStyle = useAnimatedStyle(() => {
    const h = collapsibleHeaderHeight.value;
    if (h <= 0) return { opacity: 1 };
    return {
      opacity: interpolate(
        scrollY.value,
        [h * 0.45, h * 0.95],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  });
  // The container this collection sits in — the workspace's own mark + name, no
  // type word (the page's type is the page you are on) and no chevron next to the
  // hamburger. The avatar is the affordance: the same mark the hub and the drawer
  // wear, so it reads as "inside My Songs" and taps through to it.
  const upLink = screen.upLink;
  const eyebrowText = upLink?.label ?? "";

  return (
    <View style={collStyles.navRow}>
      <Pressable
        testID={screen.showBack ? "header-back" : "header-menu"}
        style={({ pressed }) => [collStyles.navBtn, pressed ? styles.pressDown : null]}
        onPress={screen.showBack ? screen.onBack : screen.openDrawer}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={screen.showBack ? t("common.back") : t("workspaceBrowse.openMenu")}
      >
        {screen.showBack ? (
          <Ionicons name={dirIcon("chevron-back")} size={20} color="#84736f" />
        ) : (
          <Ionicons name="menu-outline" size={22} color="#84736f" />
        )}
      </Pressable>

      {/* One slot, two occupants: the "‹ MY SONGS · COLLECTION" up-link while the
          identity block is on screen; the compact title once it has scrolled away. */}
      <View style={collStyles.navSlot}>
        <ReAnimated.View style={[collStyles.navEyebrowRow, eyebrowStyle]}>
          <Pressable
            testID="collection-up-link"
            accessibilityRole="button"
            accessibilityLabel={upLink ? t("common.backTo", { label: upLink.label }) : eyebrowText}
            disabled={!upLink || screen.showBack}
            onPress={upLink?.onPress}
            hitSlop={8}
            style={({ pressed }) => [collStyles.navEyebrowPress, pressed ? styles.pressDown : null]}
          >
            {workspace ? (
              <WorkspaceAvatar
                color={workspace.color}
                name={workspace.title}
                size={16}
                avatarKey={workspace.avatarKey}
              />
            ) : null}
            <Text style={collStyles.navEyebrow} numberOfLines={1}>{eyebrowText}</Text>
          </Pressable>
        </ReAnimated.View>
        <ReAnimated.View style={[collStyles.navCompact, collStyles.navSlotOverlay, compactTitleStyle]} pointerEvents="none">
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
      </View>

      {/* Hidden while selecting AND while the page is a picker — a picker has
          exactly one chrome (the footer), so the overflow never flickers in
          and out as the first card is picked. */}
      {!screen.listSelectionMode && !screen.pickerMode ? (
        <IconButton
          testID="collection-overflow"
          icon="ellipsis-horizontal"
          tone="muted"
          size={20}
          onPress={() => (screen.headerMenuOpen ? screen.closeHeaderMenu() : screen.openHeaderMenu())}
          accessibilityLabel={t("collection.options")}
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
  const { t } = useTranslation();
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
        accessibilityLabel={t("common.backTo", { label: contextualReturn.label })}
      >
        <Ionicons name={dirIcon("arrow-back")} size={13} color={colors.primaryDeep} />
        <Text style={collStyles.returnChipText} numberOfLines={1}>
          {t("common.backTo", { label: contextualReturn.label })}
        </Text>
        <Pressable
          onPress={contextualReturn.onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("collection.dismiss")}
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
  const { t } = useTranslation();
  const { screen } = useCollectionScreen();
  const collection = screen.currentCollection;
  const workspace = screen.activeWorkspace;
  const libraryCollector = useStore((s) => s.libraryCollector);
  const pickingSongTarget = useStore((s) => s.songTargetPicker != null);
  if (!collection) return null;

  const ideaMeta = screen.ideasHeaderMeta;
  // "Edited" means the newest work anywhere in the collection's scope — saving a
  // clip doesn't touch the collection object itself, so its own updatedAt alone
  // goes stale the moment recording is the only activity (2026-08-26 audit B12).
  const lastEditedMeta = formatLastEdited(
    workspace
      ? Math.max(collection.updatedAt, getCollectionLastWorkedAt(workspace, collection.id))
      : collection.updatedAt
  );
  const metaLine = [ideaMeta, lastEditedMeta].filter(Boolean).join("  ·  ");

  return (
    // Non-interactive: drags on the title fall through to the list beneath.
    <View style={collStyles.identityBlock} pointerEvents="none">
      {/* The WHERE eyebrow rides in the nav row as the up-link (2026-09-07). The
          picker eyebrow (2026-09-11) sits here, above the title: this page is
          the place you are picking FROM, and the line says what for. */}
      {libraryCollector ? (
        <PickerEyebrow
          testID="picker-eyebrow"
          icon={getLibraryCollectorIcon(libraryCollector.kind)}
          label={t("selection.addingTo", { title: libraryCollector.targetTitle })}
          userValue={libraryCollector.targetTitle}
        />
      ) : pickingSongTarget ? (
        <PickerEyebrow testID="picker-eyebrow" icon="document-text-outline" label={t("selection.pickingSongFor")} />
      ) : null}
      <UserText value={collection.title} style={collStyles.collectionTitle} numberOfLines={2}>
        {collection.title}
      </UserText>
      <Text style={collStyles.meta}>{metaLine}</Text>
      {collection.description ? (
        <UserText value={collection.description} style={collStyles.description} numberOfLines={2}>
          {collection.description}
        </UserText>
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
      hasActivityRangeFilter={screen.hasActivityRangeFilter}
      activityLabel={screen.activityLabel}
      collectionId={screen.collectionId!}
      clipClipboard={screen.clipClipboard}
      duplicateWarningText={screen.duplicateWarningText}
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
  navSlot: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    justifyContent: "center",
  },
  navSlotOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  navEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  navEyebrowPress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: 4,
  },
  navEyebrow: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
    color: colors.eyebrow,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    flexShrink: 1,
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
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: "#1C1C19",
  },
  identityBlock: {
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 4,
    backgroundColor: "#FDFBF7",
  },
  collectionTitle: {
    fontFamily: "Lora_500Medium",
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
