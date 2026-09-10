import { useMemo, type ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../design/directionalIcons";
import { styles } from "../styles";
import { radii, shadows, colors } from "../design/tokens";
import { NavRow } from "./common/NavRow";
import { WorkspaceAvatar } from "./common/WorkspaceAvatar";
import { getWorkspaceTheme } from "../domain/workspaceTheme";
import { useShelfStore } from "../state/useShelfStore";
import { useStore } from "../state/useStore";
import { isEntryInDecisionWindow, isEntryExpired } from "../domain/shelf";
import { useTranslation } from "react-i18next";
import { UserText } from "../i18n";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// Nav icons are monochrome by design: color in the drawer is reserved for
// meaning — the workspace tint, the active row, a pending-decision count — so a
// glyph's hue never competes with a signal. One muted tone for every row.
const NAV_ICON_COLOR = colors.textSecondary;
const NAV_ICONS = {
  collection: "folder-outline",
  notepad: "journal-outline",
  shelf: "file-tray-outline",
  compilations: "library-outline",
  revisit: "time-outline",
  activity: "analytics-outline",
  sparks: "sparkles-outline",
  tuner: "speedometer-outline",
  metronome: "pulse-outline",
  settings: "settings-outline",
} satisfies Record<string, IoniconName>;

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
    | "shelf"
    | "activity"
    | "tuner"
    | "metronome"
    | "library"
    | "settings"
    | "notepad"
    | "sparks"
    | null;
  workspaceTitle: string | null;
  workspaceColor?: string;
  workspaceAvatarKey?: number;
  collectionsCount: number;
  recentCollections: RecentCollectionLite[];
  onGoHome: () => void;       // Switch workspace (home = workspace picker)
  onGoWorkspace: () => void;  // Collections for current workspace
  onGoSearch: () => void;
  onGoRevisit: () => void;
  onGoShelf: () => void;
  onGoActivity: () => void;
  onGoTuner: () => void;
  onGoMetronome: () => void;
  onGoLibrary: () => void;
  onGoSettings: () => void;
  onGoNotepad: () => void;
  onGoSparks: () => void;
  onOpenCollection: (collectionId: string) => void;
};

export function SideNav({
  currentRoute,
  workspaceTitle,
  workspaceColor,
  workspaceAvatarKey,
  collectionsCount,
  recentCollections,
  onGoHome,
  onGoWorkspace,
  onGoSearch,
  onGoRevisit,
  onGoShelf,
  onGoActivity,
  onGoTuner,
  onGoMetronome,
  onGoLibrary,
  onGoSettings,
  onGoNotepad,
  onGoSparks,
  onOpenCollection,
}: Props) {
  const { t } = useTranslation();
  const workspaceTheme = getWorkspaceTheme(workspaceColor);

  // The Shelf's one honest signal: a small count of items in their final stretch,
  // waiting on a keep-or-leave answer. Finite and clearable — most days it's zero.
  // Entries whose idea was deleted from the library are excluded: the Shelf screen
  // can't show them, so counting them would light a badge with no way to clear it.
  const shelfEntries = useShelfStore((state) => state.entries);
  const shelfWorkspaces = useStore((state) => state.workspaces);
  const shelfDecisionCount = useMemo(() => {
    const existingIdeaIds = new Set<string>();
    for (const workspace of shelfWorkspaces) {
      for (const idea of workspace.ideas) existingIdeaIds.add(idea.id);
    }
    const now = Date.now();
    return shelfEntries.filter(
      (entry) =>
        existingIdeaIds.has(entry.id) &&
        (isEntryInDecisionWindow(entry, now) || isEntryExpired(entry, now))
    ).length;
  }, [shelfEntries, shelfWorkspaces]);

  return (
    <SafeAreaView style={sideNavStyles.shell}>

      {/* ── Brand + global search ─────────────────────────────────────── */}
      {/* Left: the wordmark alone — the workspace avatar below is the drawer's
          only mark, since the workspace is the thing you switch (2026-09-08). Right: a
          global search action. It's a NEUTRAL icon on purpose — untinted, it
          reads as app-level, signalling it searches your whole library and not
          just the current workspace. */}
      <View style={sideNavStyles.header}>
        <View style={sideNavStyles.brand}>
          <Text style={sideNavStyles.brandName}>SongNook</Text>
        </View>
        <Pressable
          testID="global-search"
          style={({ pressed }) => [
            sideNavStyles.searchBtn,
            currentRoute === "search" ? sideNavStyles.searchBtnActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onGoSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("navigation.searchLibrary")}
        >
          <Ionicons
            name="search"
            size={19}
            color={currentRoute === "search" ? colors.textPrimary : colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* ── Workspace card — the one tinted island ─────────────────────── */}
      {/* Everything below it is global; this block alone is "here". The tint is
          washed to half strength on purpose: the card is a context reminder, not
          a destination, so it should murmur rather than dominate the drawer. */}
      <View style={sideNavStyles.workspaceBlock}>
        <View style={[sideNavStyles.workspaceCard, { backgroundColor: `${workspaceTheme.tint}80` }]}>

          {/* Identity + switcher. The swap glyph reads as "change workspace" —
              the old chevron-down promised a dropdown that never came. */}
          <View style={sideNavStyles.workspaceNameRow}>
            {/* A surface backing ring keeps the avatar's marble legible — drawn
                straight on the tint, its hues bled into the card. */}
            <View style={sideNavStyles.avatarChip}>
              <WorkspaceAvatar
                color={workspaceColor}
                name={workspaceTitle ?? "?"}
                avatarKey={workspaceAvatarKey}
                size={30}
              />
            </View>
            <View style={sideNavStyles.workspaceIdentity}>
              <Text style={sideNavStyles.sectionLabel}>{t("navigation.workspace")}</Text>
              <UserText value={workspaceTitle ?? ""} style={sideNavStyles.workspaceName} numberOfLines={1}>
                {workspaceTitle ?? t("navigation.noWorkspace")}
              </UserText>
            </View>
            <Pressable
              testID="workspace-switch"
              accessibilityRole="button"
              accessibilityLabel={t("navigation.switchWorkspace")}
              style={({ pressed }) => [sideNavStyles.switchBtn, pressed ? styles.pressDown : null]}
              onPress={onGoHome}
              hitSlop={10}
            >
              <Ionicons name="swap-horizontal" size={17} color={colors.primaryDeep} />
            </Pressable>
          </View>

          {/* Collections — the door to everything in this workspace. Plain row,
              sitting directly on the tint (no boxed surface). The count rides
              inside the label ("Collections · 3") as quiet inventory, not a badge.
              The card ends here: it names where you are and offers the one door;
              shortcuts into particular collections live in RECENT below, where a
              section label can explain them (2026-09-10). */}
          {workspaceTitle ? (
            <Pressable
              style={({ pressed }) => [sideNavStyles.cardRow, pressed ? styles.pressDown : null]}
              onPress={onGoWorkspace}
            >
              <Ionicons name="albums-outline" size={17} color={colors.primaryDeep} />
              <Text style={sideNavStyles.cardRowLabel} numberOfLines={1}>
                {t("navigation.collections")}
                {collectionsCount > 0 ? (
                  <Text style={sideNavStyles.cardRowCount}>{` · ${collectionsCount}`}</Text>
                ) : null}
              </Text>
              <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Scrollable lower sections ──────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Recent — shortcuts into the collections you were last inside. Sits
            directly under the workspace card because, like the card, it is
            scoped to THIS workspace; everything after the divider is global.
            Absent entirely (no label, no divider) until something has been
            opened, so a fresh workspace's drawer stays quiet. */}
        {recentCollections.length > 0 ? (
          <>
            <Text style={sideNavStyles.sectionLabelScroll}>{t("navigation.recent")}</Text>
            {recentCollections.map((entry) => (
              <NavRow
                key={entry.id}
                testID={`nav-recent-${entry.id}`}
                icon={NAV_ICONS.collection}
                iconColor={NAV_ICON_COLOR}
                label={entry.title}
                supporting={entry.meta}
                userLabel
                active={entry.active === true}
                onPress={() => onOpenCollection(entry.id)}
                accessibilityLabel={`${t("navigation.recent")} · ${entry.title}`}
              />
            ))}
            <View style={sideNavStyles.divider} />
          </>
        ) : null}

        {/* Act-now — the two things you DO: capture a line, and clear ideas
            waiting on a decision. Unlabelled on purpose; their position (first
            global rows, right under the workspace context) is what marks them
            as primary. */}
        <NavRow
          icon={NAV_ICONS.notepad}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.lyricsPad")}
          active={currentRoute === "notepad"}
          onPress={onGoNotepad}
        />
        <NavRow
          icon={NAV_ICONS.shelf}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.shelf")}
          active={currentRoute === "shelf"}
          onPress={onGoShelf}
          accessory={
            shelfDecisionCount > 0 ? (
              <View style={sideNavStyles.countBadge}>
                <Text style={sideNavStyles.countBadgeText}>{shelfDecisionCount}</Text>
              </View>
            ) : undefined
          }
        />

        {/* Explore — the three ways to survey everything you've made. */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabelScroll}>{t("navigation.explore")}</Text>
        <NavRow
          icon={NAV_ICONS.compilations}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.compilations")}
          active={currentRoute === "library"}
          onPress={onGoLibrary}
        />
        <NavRow
          icon={NAV_ICONS.revisit}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.revisit")}
          active={currentRoute === "revisit"}
          onPress={onGoRevisit}
        />
        <NavRow
          icon={NAV_ICONS.activity}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.activity")}
          active={currentRoute === "activity"}
          onPress={onGoActivity}
        />

        {/* Tools — grab-and-go utilities. Lyric Spark (Word Ladder / Cut-Up /
            Borrowed Words) has its own page now, apart from the Lyric Pad. */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabelScroll}>{t("navigation.tools")}</Text>
        <NavRow
          icon={NAV_ICONS.sparks}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.sparks")}
          active={currentRoute === "sparks"}
          onPress={onGoSparks}
        />
        <NavRow
          icon={NAV_ICONS.tuner}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.tuner")}
          active={currentRoute === "tuner"}
          onPress={onGoTuner}
        />
        <NavRow
          icon={NAV_ICONS.metronome}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.metronome")}
          active={currentRoute === "metronome"}
          onPress={onGoMetronome}
        />
      </ScrollView>

      {/* ── Settings pinned footer ─────────────────────────────────────── */}
      <View style={sideNavStyles.footer}>
        <View style={sideNavStyles.footerDivider} />
        <NavRow
          icon={NAV_ICONS.settings}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.settings")}
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
    borderTopEndRadius: radii.drawer,
    borderBottomEndRadius: radii.drawer,
    ...shadows.drawer,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  // Placeholder mark — swap for the real logo asset when it lands.
  brandName: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  // Neutral (untinted) — its plainness is what tells you search is global.
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  searchBtnActive: {
    backgroundColor: "#efeeea",
    borderColor: "transparent",
  },

  // Workspace block
  workspaceBlock: {
    paddingHorizontal: 10,
  },
  workspaceCard: {
    backgroundColor: "#efeeea",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 4,
    marginHorizontal: 2,
  },
  workspaceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarChip: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  workspaceName: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 19,
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  switchBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },

  // Rows sitting directly on the workspace tint
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 9,
    marginHorizontal: -4,
    borderRadius: 8,
  },
  cardRowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  // Quiet inventory count — information, not a badge asking for action. Nested
  // inside the label's Text so it reads as part of the phrase ("Collections · 3").
  cardRowCount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: colors.textMuted,
  },

  // Scrollable sections
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 2,
  },
  sectionLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  // Same label, aligned with the nav rows' text inset in the scroll area.
  sectionLabelScroll: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingBottom: 2,
  },
  // Shelf keep-or-leave signal — a live count, shown only while decisions wait.
  countBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    lineHeight: 14,
    color: colors.surface,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.borderMuted,
    opacity: 0.5,
    marginVertical: 8,
    marginHorizontal: 12,
  },

  // Footer
  footer: {
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  footerDivider: {
    height: 0.5,
    backgroundColor: colors.borderMuted,
    opacity: 0.5,
    marginBottom: 6,
    marginHorizontal: 12,
  },
});
