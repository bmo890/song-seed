import { useMemo, type ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { radii, shadows, colors } from "../design/tokens";
import { NavRow } from "./common/NavRow";
import { WorkspaceAvatar } from "./common/WorkspaceAvatar";
import { getWorkspaceTheme } from "../domain/workspaceTheme";
import { useShelfStore } from "../state/useShelfStore";
import { useStore } from "../state/useStore";
import { isEntryInDecisionWindow, isEntryExpired } from "../domain/shelf";
import { useTranslation } from "react-i18next";
import { useLocale } from "../i18n";
import { UserText } from "../i18n";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// Nav icons are monochrome by design: color in the drawer is reserved for
// meaning — the workspace tint, the active row, a pending-decision count — so a
// glyph's hue never competes with a signal. One muted tone for every row.
const NAV_ICON_COLOR = colors.textSecondary;
const NAV_ICONS = {
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
    | null;
  workspaceTitle: string | null;
  workspaceColor?: string;
  workspaceAvatarKey?: number;
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
  const { direction } = useLocale();
  const mostRecent = recentCollections[0] ?? null;
  const workspaceTheme = getWorkspaceTheme(workspaceColor);
  const forwardChevron = direction === "rtl" ? "chevron-back" : "chevron-forward";

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
      {/* Left: app wordmark (placeholder until the real logo lands). Right: a
          global search action. It's a NEUTRAL icon on purpose — untinted, it
          reads as app-level, signalling it searches your whole library and not
          just the current workspace. */}
      <View style={sideNavStyles.header}>
        <View style={sideNavStyles.brand}>
          <View style={sideNavStyles.brandMark} />
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
      {/* Everything below it is global; this block alone is "here". */}
      <View style={sideNavStyles.workspaceBlock}>
        <View style={[sideNavStyles.workspaceCard, { backgroundColor: workspaceTheme.tint }]}>

          {/* Identity + switcher. The chevron is the familiar account-switch
              affordance — tap to change which workspace you're in. */}
          <View style={sideNavStyles.workspaceNameRow}>
            <WorkspaceAvatar
              color={workspaceColor}
              name={workspaceTitle ?? "?"}
              avatarKey={workspaceAvatarKey}
              size={32}
            />
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
              <Ionicons name="chevron-down" size={18} color={colors.primaryDeep} />
            </Pressable>
          </View>

          {/* Collections — the door to everything in this workspace. Plain row,
              sitting directly on the tint (no boxed surface). */}
          {workspaceTitle ? (
            <Pressable
              style={({ pressed }) => [sideNavStyles.cardRow, pressed ? styles.pressDown : null]}
              onPress={onGoWorkspace}
            >
              <Ionicons name="albums-outline" size={17} color={colors.primaryDeep} />
              <Text style={sideNavStyles.cardRowLabel}>{t("navigation.collections")}</Text>
              <Ionicons name={forwardChevron} size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {/* Most recent collection — indented one level, because it lives INSIDE
              Collections: this is a shortcut into one of them, not a sibling. */}
          {mostRecent ? (
            <Pressable
              style={({ pressed }) => [
                sideNavStyles.cardRow,
                sideNavStyles.recentRow,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onOpenCollection(mostRecent.id)}
            >
              <Ionicons name="folder-outline" size={16} color={colors.textSecondary} />
              <UserText value={mostRecent.title} style={sideNavStyles.recentLabel} numberOfLines={1}>
                {mostRecent.title}
              </UserText>
              <Text style={sideNavStyles.recentTag}>{t("navigation.recent")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Scrollable lower sections ──────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Act-now — the two things you DO: capture a line, and clear ideas
            waiting on a decision. Unlabelled on purpose; their position (first,
            right under the workspace) is what marks them as primary. */}
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

        {/* Tools — grab-and-go utilities. Sparks (Word Ladder / Cut-Up / Magpie)
            lives here; it also stays reachable from inside the Lyrics Pad. */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabelScroll}>{t("navigation.tools")}</Text>
        <NavRow
          icon={NAV_ICONS.sparks}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.sparks")}
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
  brandMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  brandName: {
    fontFamily: "PlayfairDisplay_600SemiBold",
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
  // The recent collection is nested under Collections — indented one level.
  recentRow: {
    paddingStart: 26,
  },
  recentLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  recentTag: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9.5,
    letterSpacing: 0.7,
    textTransform: "uppercase",
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
