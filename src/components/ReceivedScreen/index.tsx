import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { getHierarchyIconName } from "../../domain/hierarchy";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { EmptyState } from "../common/EmptyState";
import { SelectionTopBar } from "../common/SelectionTopBar";
import { SelectionDock } from "../common/SelectionDock";
import { AppAlert } from "../common/AppAlert";
import { ReceivedPackageMoveModal } from "../common/ReceivedPackageMoveModal";
import { openReceivedParcel } from "../../state/useReceivedParcelStore";
import { useStore } from "../../state/useStore";
import { receivedPackages, unopenedReceivedCount } from "../../domain/workspaceVisibility";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";
import { visitCollection } from "../../navigation";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import type { ShareKind, Workspace } from "../../types";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { UserText, useLocale } from "../../i18n";
import { styles } from "../../styles";

const KIND_ICONS: Record<ShareKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  setlist: "albums-outline",
  playlist: "musical-notes-outline",
  songbook: "book-outline",
  sketch: getHierarchyIconName("song"),
  collection: "folder-outline",
  workspace: "file-tray-stacked-outline",
  clips: "musical-notes-outline",
  library: "library-outline",
};

/** The collections a package shows as rows: top-level only, in stored order. */
function topLevelCollections(pkg: Workspace) {
  return pkg.collections.filter((collection) => !collection.parentCollectionId);
}

function formatReceivedLine(pkg: Workspace, t: TFunction, locale: string): string {
  const meta = pkg.received;
  const parts: string[] = [];
  if (meta?.senderName) parts.push(t("received.from", { name: meta.senderName }));
  if (meta?.receivedAt) {
    parts.push(
      new Date(meta.receivedAt).toLocaleDateString(locale, { month: "short", day: "numeric" })
    );
  }
  const count = pkg.ideas.length;
  parts.push(t("received.items", { count }));
  return parts.join(" · ");
}

/**
 * The Received page — snapshots people sent you (or you sent yourself), kept
 * apart from your own creative work. One row per package; a package OPENS AS
 * THE REAL COLLECTION PAGE (a visit, labelled Received). Long-press selects:
 * several packages can be kept (moved somewhere) or deleted at once. Nothing
 * here ever mixes into personal workspaces on its own.
 */
export function ReceivedScreen() {
  const { t } = useTranslation();
  const { formatLocale } = useLocale();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const workspaces = useStore((s) => s.workspaces);
  const markReceivedPackageOpened = useStore((s) => s.markReceivedPackageOpened);
  const updateCollection = useStore((s) => s.updateCollection);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);

  const packages = useMemo(() => receivedPackages(workspaces), [workspaces]);
  const unopenedCount = useMemo(() => unopenedReceivedCount(workspaces), [workspaces]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const selecting = selectedIds.length > 0;
  const clearSelection = () => setSelectedIds([]);
  useBrowseRootBackHandler(selecting ? { onBack: clearSelection } : true);

  // Packages deleted or moved out from under a selection drop out of it.
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => packages.some((pkg) => pkg.id === id)));
  }, [packages]);

  // A package opens on one of its collections: the one tapped, else its first.
  // A workspace package with several top-level collections lists them under
  // its row (below), so every collection it carries stays one tap away.
  const openPackage = (pkg: Workspace, collectionId?: string) => {
    const collection = collectionId
      ? pkg.collections.find((candidate) => candidate.id === collectionId)
      : topLevelCollections(pkg)[0] ?? pkg.collections[0];
    if (!collection) return;
    // Opening is what clears it from the drawer's "new" count.
    markReceivedPackageOpened(pkg.id);
    // Packages saved before 2026-10-11 named their one collection "Files";
    // it opens as a real page now, so it wears the parcel's name.
    const parcelTitle = pkg.received?.shareTitle ?? pkg.title;
    if (collection.title === "Files" && pkg.collections.length === 1 && parcelTitle) {
      updateCollection(pkg.id, collection.id, { title: parcelTitle });
    }
    visitCollection(navigation, { collectionId: collection.id, workspaceId: pkg.id });
  };

  // The workspace switcher's "From others" cards and a just-saved parcel land
  // straight inside their package; the drawer row (no packageId) lands here.
  const routePackageId = route.params?.packageId as string | undefined;
  const routeOpenToken = route.params?.openToken as number | undefined;
  useEffect(() => {
    if (!routePackageId) return;
    const pkg = packages.find((candidate) => candidate.id === routePackageId);
    // The parcel's front door, not the collection: a just-saved parcel and a
    // "From others" card both arrive here (2026-10-14).
    if (pkg) {
      markReceivedPackageOpened(pkg.id);
      openReceivedParcel(pkg.id);
    }
    navigation.setParams({ packageId: undefined, openToken: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePackageId, routeOpenToken]);

  const confirmDeleteSelected = () => {
    const targets = packages.filter((pkg) => selectedIds.includes(pkg.id));
    if (targets.length === 0) return;
    const one = targets.length === 1 ? targets[0] : null;
    AppAlert.destructive(
      one ? t("received.deleteTitle") : t("received.deleteManyTitle", { count: targets.length }),
      one
        ? t("received.deleteBody", { title: one.title, items: t("received.items", { count: one.ideas.length }) })
        : t("received.deleteManyBody"),
      () => {
        for (const pkg of targets) deleteWorkspace(pkg.id);
        haptic.success();
        clearSelection();
      },
      { confirmLabel: t("common.delete") }
    );
  };

  return (
    <SafeAreaView style={receivedStyles.screen}>
      <View style={receivedStyles.header}>
        <ScreenHeader title={t("screens.received")} variant="place" leftIcon="hamburger" />
      </View>

      {selecting ? (
        <View style={receivedStyles.topBar}>
          <SelectionTopBar
            inline
            count={selectedIds.length}
            allSelected={selectedIds.length === packages.length}
            onSelectAll={() => setSelectedIds(packages.map((pkg) => pkg.id))}
            onCancel={clearSelection}
          />
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[receivedStyles.scrollContent, selecting ? receivedStyles.scrollContentSelecting : null]}
      >
        {packages.length > 0 && !selecting ? (
          <Text style={receivedStyles.countLine}>
            {t("received.packages", { count: packages.length })}
            {unopenedCount > 0 ? ` · ${t("received.newCount", { count: unopenedCount })}` : ""}
          </Text>
        ) : null}
        <View style={receivedStyles.list}>
          {packages.map((pkg) => {
            const kind = pkg.received?.shareKind ?? "library";
            const unopened = pkg.received?.openedAt == null;
            const selected = selectedIds.includes(pkg.id);
            const toggle = () =>
              setSelectedIds((prev) => (prev.includes(pkg.id) ? prev.filter((id) => id !== pkg.id) : [...prev, pkg.id]));
            const collections = topLevelCollections(pkg);
            const showCollections = collections.length > 1 && !selecting;
            return (
              <View key={pkg.id} style={receivedStyles.packageGroup}>
              <Pressable
                style={({ pressed }) => [
                  receivedStyles.packageRow,
                  selected ? receivedStyles.packageRowSelected : null,
                  pressed ? { opacity: 0.8 } : null,
                ]}
                onPress={() => {
                  haptic.tap();
                  if (selecting) {
                    toggle();
                    return;
                  }
                  // The row opens the parcel's front door; its collection rows
                  // beneath (a workspace parcel) still open straight in.
                  markReceivedPackageOpened(pkg.id);
                  openReceivedParcel(pkg.id);
                }}
                onLongPress={() => {
                  // haptics vocabulary: `grab` — entering selection mode.
                  haptic.grab();
                  if (!selecting) setSelectedIds([pkg.id]);
                  else toggle();
                }}
                delayLongPress={450}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t("received.openPackage", { title: pkg.received?.shareTitle ?? pkg.title })}
              >
                <View style={receivedStyles.packageIcon}>
                  <Ionicons
                    name={selected ? "checkmark" : KIND_ICONS[kind]}
                    size={19}
                    color={selected ? colors.primaryDeep : colors.textStrong}
                  />
                </View>
                <View style={receivedStyles.packageMain}>
                  <Text style={receivedStyles.packageTitle} numberOfLines={1}>
                    {pkg.received?.shareTitle ?? pkg.title}
                  </Text>
                  <Text style={receivedStyles.packageMeta} numberOfLines={1}>
                    {t(`received.${kind}`)} · {formatReceivedLine(pkg, t, formatLocale)}
                  </Text>
                </View>
                {unopened && !selecting ? (
                  <View
                    style={receivedStyles.unopenedDot}
                    accessibilityLabel={t("received.unopened")}
                  />
                ) : null}
                {!selecting ? (
                  <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
                ) : null}
              </Pressable>
              {showCollections
                ? collections.map((collection) => {
                    const count = pkg.ideas.filter((idea) => idea.collectionId === collection.id).length;
                    return (
                      <Pressable
                        key={collection.id}
                        style={({ pressed }) => [receivedStyles.collectionRow, pressed ? styles.pressDown : null]}
                        onPress={() => {
                          // haptics vocabulary: `tap` — an acknowledged press.
                          haptic.tap();
                          openPackage(pkg, collection.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t("received.openCollection", { title: collection.title })}
                      >
                        <Ionicons name="folder-outline" size={14} color={colors.textSecondary} />
                        <UserText value={collection.title} style={receivedStyles.collectionTitle} numberOfLines={1}>
                          {collection.title}
                        </UserText>
                        <Text style={receivedStyles.collectionMeta}>{t("received.items", { count })}</Text>
                      </Pressable>
                    );
                  })
                : null}
              </View>
            );
          })}
        </View>

        {packages.length === 0 ? (
          <EmptyState
            icon="mail-open-outline"
            title={t("received.empty")}
            body={t("received.emptyBody")}
            testID="received-empty"
          />
        ) : null}
        {/* The outbox lives in Settings; a quiet ink link so inbox and outbox
            point at each other. */}
        {!selecting ? (
          <Pressable
            style={({ pressed }) => [receivedStyles.sentLink, pressed ? { opacity: 0.6 } : null]}
            onPress={() =>
              navigation.navigate("SettingsHome", { initialView: "sharing", openToken: Date.now() })
            }
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel={t("received.linksYouSent")}
          >
            <Ionicons name="link-outline" size={14} color={colors.primaryDeep} />
            <Text style={receivedStyles.sentLinkText}>{t("received.linksYouSent")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {selecting ? (
        <SelectionDock
          actions={[
            {
              key: "keep",
              label: t("received.moveSelected"),
              icon: "arrow-forward-outline",
              onPress: () => setMoveOpen(true),
              opens: true,
            },
            {
              key: "delete",
              label: t("common.delete"),
              icon: "trash-outline",
              tone: "danger",
              onPress: confirmDeleteSelected,
            },
          ]}
        />
      ) : null}

      <ReceivedPackageMoveModal
        packageIds={selectedIds}
        visible={moveOpen}
        onClose={() => setMoveOpen(false)}
        onDone={(result) => {
          clearSelection();
          if (result.kind === "moved" && result.collectionIds.length === 1) {
            visitCollection(navigation, { collectionId: result.collectionIds[0]!, workspaceId: result.workspaceId });
          }
        }}
      />
    </SafeAreaView>
  );
}

const receivedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  // The list rows carry their own inset; the header takes the page gutter so
  // its glyph lines up with every other page's.
  header: {
    paddingHorizontal: spacing.lg,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  scrollContentSelecting: {
    paddingBottom: 160,
  },
  // Structure is rows on paper (2026-10-15): parcels sit on hairlines, no
  // boxes, no icon tiles.
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  countLine: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontVariant: ["tabular-nums"],
  },
  unopenedDot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  sentLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: spacing.xl,
  },
  sentLinkText: {
    ...textTokens.supporting,
    color: colors.primaryDeep,
  },
  packageGroup: {
    gap: 2,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  // A package's collections: quiet rows tucked under the package, indented to
  // read as its contents, not as more packages.
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginStart: 22 + spacing.md,
    paddingVertical: 8,
    paddingEnd: 14,
  },
  collectionTitle: {
    ...textTokens.supporting,
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
  },
  collectionMeta: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  packageRowSelected: {
    backgroundColor: colors.primarySurface,
  },
  packageIcon: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  packageMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  // A parcel's title is a name its sender typed: it earns the serif.
  packageTitle: {
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: colors.textPrimary,
  },
  packageMeta: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
});
