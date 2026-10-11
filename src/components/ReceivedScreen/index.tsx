import React, { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { EmptyState } from "../common/EmptyState";
import { useStore } from "../../state/useStore";
import { receivedPackages, unopenedReceivedCount } from "../../domain/workspaceVisibility";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";
import { visitCollection } from "../../navigation";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import type { ShareKind, Workspace } from "../../types";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocale } from "../../i18n";

const KIND_ICONS: Record<ShareKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  setlist: "albums-outline",
  playlist: "musical-notes-outline",
  songbook: "book-outline",
  collection: "folder-outline",
  workspace: "file-tray-stacked-outline",
  clips: "musical-notes-outline",
  library: "library-outline",
};

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
 * THE REAL COLLECTION PAGE (a visit, labelled Received), with every card,
 * play, select and search a collection has — and "Move to my workspaces" /
 * "Delete package" in that page's overflow (2026-10-11). Nothing here ever
 * mixes into personal workspaces on its own.
 */
export function ReceivedScreen() {
  const { t } = useTranslation();
  const { formatLocale } = useLocale();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  useBrowseRootBackHandler();

  const workspaces = useStore((s) => s.workspaces);
  const markReceivedPackageOpened = useStore((s) => s.markReceivedPackageOpened);
  const updateCollection = useStore((s) => s.updateCollection);

  const packages = useMemo(() => receivedPackages(workspaces), [workspaces]);
  const unopenedCount = useMemo(() => unopenedReceivedCount(workspaces), [workspaces]);

  const openPackage = (pkg: Workspace) => {
    const collection = pkg.collections[0];
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
    if (pkg) openPackage(pkg);
    navigation.setParams({ packageId: undefined, openToken: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePackageId, routeOpenToken]);

  return (
    <SafeAreaView style={receivedStyles.screen}>
      <ScreenHeader title={t("screens.received")} leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={receivedStyles.scrollContent}
      >
        {packages.length > 0 ? (
          <Text style={receivedStyles.countLine}>
            {t("received.packages", { count: packages.length })}
            {unopenedCount > 0 ? ` · ${t("received.newCount", { count: unopenedCount })}` : ""}
          </Text>
        ) : null}
        <View style={receivedStyles.list}>
          {packages.map((pkg) => {
            const kind = pkg.received?.shareKind ?? "library";
            const unopened = pkg.received?.openedAt == null;
            return (
              <Pressable
                key={pkg.id}
                style={({ pressed }) => [receivedStyles.packageRow, pressed ? { opacity: 0.8 } : null]}
                onPress={() => {
                  haptic.tap();
                  openPackage(pkg);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("received.openPackage", { title: pkg.received?.shareTitle ?? pkg.title })}
              >
                <View style={receivedStyles.packageIcon}>
                  <Ionicons name={KIND_ICONS[kind]} size={18} color={colors.primaryDeep} />
                </View>
                <View style={receivedStyles.packageMain}>
                  <Text style={receivedStyles.packageTitle} numberOfLines={1}>
                    {pkg.received?.shareTitle ?? pkg.title}
                  </Text>
                  <Text style={receivedStyles.packageMeta} numberOfLines={1}>
                    {t(`received.${kind}`)} · {formatReceivedLine(pkg, t, formatLocale)}
                  </Text>
                </View>
                {unopened ? (
                  <View
                    style={receivedStyles.unopenedDot}
                    accessibilityLabel={t("received.unopened")}
                  />
                ) : null}
                <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
              </Pressable>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const receivedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  list: {
    gap: spacing.sm,
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
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  packageIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
  },
  packageMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  packageTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  packageMeta: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
});
