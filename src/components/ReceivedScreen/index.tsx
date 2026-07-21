import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { InlineIdeaCard } from "../common/InlineIdeaCard";
import { AppAlert } from "../common/AppAlert";
import { useStore } from "../../state/useStore";
import { useMiniPlayerContext } from "../../hooks/FullPlayerProvider";
import { receivedPackages } from "../../domain/workspaceVisibility";
import { getPlayableClipForIdea } from "../../domain/clipPresentation";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";
import { toast } from "../common/toastStore";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import type { ShareKind, SongIdea, Workspace } from "../../types";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocale } from "../../i18n";

const KIND_LABELS: Record<ShareKind, string> = {
  setlist: "Setlist",
  songbook: "Songbook",
  collection: "Collection",
  workspace: "Workspace",
  clips: "Clips",
  library: "Library",
};

const KIND_ICONS: Record<ShareKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  setlist: "albums-outline",
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
 * apart from your own creative work. One row per package; a package opens to
 * its items, playable in place. Adoption ("Move to my workspaces") or deletion
 * are the exits. Nothing here ever mixes into personal workspaces on its own.
 */
export function ReceivedScreen() {
  const { t } = useTranslation();
  const { formatLocale } = useLocale();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  useBrowseRootBackHandler();

  const workspaces = useStore((s) => s.workspaces);
  const adoptReceivedWorkspace = useStore((s) => s.adoptReceivedWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);
  const inlinePlayer = useMiniPlayerContext();
  const inlineTarget = useStore((s) => s.inlineTarget);
  const isInlinePlaying = useStore((s) => s.inlineIsPlaying);

  const packages = useMemo(() => receivedPackages(workspaces), [workspaces]);

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? null;

  // A package that was adopted or deleted while open falls back to the list.
  useEffect(() => {
    if (selectedPackageId && !selectedPackage) setSelectedPackageId(null);
  }, [selectedPackage, selectedPackageId]);

  const resetInlineRef = useRef(inlinePlayer.resetInlinePlayer);
  useEffect(() => {
    resetInlineRef.current = inlinePlayer.resetInlinePlayer;
  }, [inlinePlayer.resetInlinePlayer]);
  useEffect(() => {
    if (isFocused) return;
    void resetInlineRef.current();
  }, [isFocused]);

  const rootNavigation = navigation.getParent?.() ?? navigation;

  function openIdea(idea: SongIdea) {
    void inlinePlayer.resetInlinePlayer();
    if (idea.kind === "project") {
      rootNavigation.navigate("IdeaDetail", { ideaId: idea.id });
      return;
    }
    const clip = getPlayableClipForIdea(idea);
    if (!clip) return;
    useStore.getState().setPlayerQueueForScreen([{ ideaId: idea.id, clipId: clip.id }], 0);
  }

  function confirmAdopt(pkg: Workspace) {
    AppAlert.confirm(
      t("received.adoptTitle"),
      t("received.adoptBody", { title: pkg.title }),
      () => {
        adoptReceivedWorkspace(pkg.id);
        haptic.success();
        toast(t("received.adopted"), "checkmark-outline");
        setSelectedPackageId(null);
      },
      { confirmLabel: t("received.move") }
    );
  }

  function confirmDelete(pkg: Workspace) {
    AppAlert.destructive(
      t("received.deleteTitle"),
      t("received.deleteBody", { title: pkg.title, items: t("received.items", { count: pkg.ideas.length }) }),
      () => {
        deleteWorkspace(pkg.id);
        haptic.success();
        setSelectedPackageId(null);
      },
      { confirmLabel: t("common.delete") }
    );
  }

  // ── Package detail ────────────────────────────────────────────────────────
  if (selectedPackage) {
    const kind = selectedPackage.received?.shareKind ?? "library";
    return (
      <SafeAreaView style={receivedStyles.screen}>
        <ScreenHeader
          title={t("screens.received")}
          leftIcon="back"
          onLeftPress={() => setSelectedPackageId(null)}
          rightElement={
            <Pressable
              style={({ pressed }) => [receivedStyles.headerBtn, pressed ? { opacity: 0.7 } : null]}
              onPress={() => setMenuVisible(true)}
              hitSlop={6}
              accessibilityLabel={t("received.packageOptions")}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.textStrong} />
            </Pressable>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={receivedStyles.scrollContent}
        >
          <View style={receivedStyles.detailHeader}>
            <View style={receivedStyles.kindChip}>
              <Ionicons name={KIND_ICONS[kind]} size={11} color={colors.primaryDeep} />
              <Text style={receivedStyles.kindChipText}>{t(`received.${kind}`)}</Text>
            </View>
            <Text style={receivedStyles.detailTitle} numberOfLines={2}>
              {selectedPackage.received?.shareTitle ?? selectedPackage.title}
            </Text>
            <Text style={receivedStyles.detailMeta}>{formatReceivedLine(selectedPackage, t, formatLocale)}</Text>
          </View>

          <View style={receivedStyles.list}>
            {selectedPackage.ideas.map((idea) => {
              const clip = getPlayableClipForIdea(idea);
              const isActive = !!clip && inlineTarget?.ideaId === idea.id && inlineTarget.clipId === clip.id;
              return (
                <InlineIdeaCard
                  key={idea.id}
                  title={idea.title}
                  isProject={idea.kind === "project"}
                  status={idea.kind === "project" ? idea.status : null}
                  completionPct={idea.kind === "project" ? idea.completionPct : null}
                  durationMs={clip?.durationMs ?? 0}
                  canPlay={!!clip}
                  isActive={isActive}
                  isPlaying={isActive && isInlinePlaying}
                  onOpen={() => openIdea(idea)}
                  onTogglePlay={() => {
                    if (clip) void inlinePlayer.toggleInlinePlayback(idea.id, clip);
                  }}
                  onStopPlay={() => void inlinePlayer.resetInlinePlayer()}
                  onSeekStart={() => void inlinePlayer.beginInlineScrub()}
                  onSeek={(ms) => void inlinePlayer.endInlineScrub(ms)}
                  onSeekCancel={() => void inlinePlayer.cancelInlineScrub()}
                />
              );
            })}
            {selectedPackage.ideas.length === 0 ? (
              <Text style={receivedStyles.emptyLine}>{t("received.noPlayable")}</Text>
            ) : null}
          </View>
        </ScrollView>

        <SelectionActionSheet
          visible={menuVisible}
          title={t("received.packageOptions")}
          onClose={() => setMenuVisible(false)}
          actions={[
            {
              key: "adopt",
              label: t("received.moveWorkspaces"),
              icon: "arrow-forward-outline",
              onPress: () => confirmAdopt(selectedPackage),
            },
            {
              key: "delete",
              label: t("received.deletePackage"),
              icon: "trash-outline",
              tone: "danger",
              onPress: () => confirmDelete(selectedPackage),
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  // ── Package list ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={receivedStyles.screen}>
      <ScreenHeader title={t("screens.received")} leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={receivedStyles.scrollContent}
      >
        <Text style={receivedStyles.pageDescription}>{t("received.intro")}</Text>

        <View style={receivedStyles.list}>
          {packages.map((pkg) => {
            const kind = pkg.received?.shareKind ?? "library";
            return (
              <Pressable
                key={pkg.id}
                style={({ pressed }) => [receivedStyles.packageRow, pressed ? { opacity: 0.8 } : null]}
                onPress={() => {
                  haptic.tap();
                  setSelectedPackageId(pkg.id);
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
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        {packages.length === 0 ? (
          <View style={receivedStyles.emptyWrap}>
            <Ionicons name="mail-open-outline" size={26} color={colors.textMuted} />
            <Text style={receivedStyles.emptyTitle}>{t("received.empty")}</Text>
            <Text style={receivedStyles.emptyBody}>{t("received.emptyBody")}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const receivedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbf9f5",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  pageDescription: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  list: {
    gap: 8,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  packageIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    alignItems: "center",
    justifyContent: "center",
  },
  packageMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  packageTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  packageMeta: {
    ...textTokens.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailHeader: {
    paddingTop: 6,
    paddingBottom: 16,
    gap: 6,
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    borderRadius: 4,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  kindChipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.primaryDeep,
  },
  detailTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  detailMeta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  emptyWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyLine: {
    ...textTokens.supporting,
    color: colors.textMuted,
    paddingVertical: 12,
  },
});
