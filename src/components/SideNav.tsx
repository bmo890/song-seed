import { useMemo, type ComponentProps } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Press } from "./common/Press";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../design/directionalIcons";
import { styles } from "../styles";
import { radii, shadows, colors, text as textTokens } from "../design/tokens";
import { NavRow } from "./common/NavRow";
import { WorkspaceAvatar } from "./common/WorkspaceAvatar";
import { getWorkspaceTheme } from "../domain/workspaceTheme";
import { useShelfStore } from "../state/useShelfStore";
import { getIdeaIndex } from "../state/librarySelectors";
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
  received: "mail-open-outline",
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
    | "received"
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
  /** Received packages exist → the row shows; badge = packages not opened yet. */
  receivedCount: number;
  unopenedReceivedCount: number;
  onGoReceived: () => void;
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
  receivedCount,
  unopenedReceivedCount,
  onGoReceived,
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
  // A primitive key of which shelf entries still exist in the library, so the
  // drawer re-renders on membership changes only — not on every library write.
  const existingShelfIdsKey = useStore((state) => {
    // The index is cached per library array, so this is O(shelf entries) per write
    // instead of O(entries × ideas).
    const index = getIdeaIndex(state.workspaces);
    const ids: string[] = [];
    for (const entry of shelfEntries) {
      if (index.all.has(entry.id)) ids.push(entry.id);
    }
    return ids.join(",");
  });
  const shelfDecisionCount = useMemo(() => {
    const existingIdeaIds = new Set(existingShelfIdsKey ? existingShelfIdsKey.split(",") : []);
    const now = Date.now();
    return shelfEntries.filter(
      (entry) =>
        existingIdeaIds.has(entry.id) &&
        (isEntryInDecisionWindow(entry, now) || isEntryExpired(entry, now))
    ).length;
  }, [shelfEntries, existingShelfIdsKey]);

  return (
    <SafeAreaView style={sideNavStyles.shell}>

      {/* ── Brand + global search ─────────────────────────────────────── */}
      {/* Left: the wordmark alone — the workspace avatar below is the drawer's
          only mark, since the workspace is the thing you switch (2026-09-08).
          Right: global search as a bare ink glyph (2026-10-15: the bordered
          circle was the app's only bordered icon button). */}
      <View style={sideNavStyles.header}>
        <View style={sideNavStyles.brand}>
          <Text style={sideNavStyles.brandName}>SongNook</Text>
        </View>
        <Press
          haptic="navigate"
          feel="glyph"
          testID="global-search"
          style={[sideNavStyles.searchBtn,
            currentRoute === "search" ? sideNavStyles.searchBtnActive : null]}
          onPress={onGoSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("navigation.searchLibrary")}
        >
          <Ionicons
            name="search"
            size={20}
            color={currentRoute === "search" ? colors.textPrimary : colors.textStrong}
          />
        </Press>
      </View>

      {/* ── Workspace card — the one tinted island ─────────────────────── */}
      {/* Everything below it is global; this block alone is "here": the
          workspace, its Collections door, and the collections you were last
          inside, indented under that door so they read as some of them
          (founder, 2026-10-15). The tint is washed to half strength on purpose:
          the card is a context reminder, not a destination. */}
      <View style={sideNavStyles.workspaceBlock}>
        <View style={[sideNavStyles.workspaceCard, { backgroundColor: `${workspaceTheme.tint}80` }]}>

          {/* Identity + switcher. The name is typed by a person, so it earns
              Lora (earned-serif rule); no eyebrow — the card says what it is. */}
          <View style={sideNavStyles.workspaceNameRow}>
            {/* A surface backing ring keeps the avatar's marble legible — drawn
                straight on the tint, its hues bled into the card. */}
            <View style={sideNavStyles.avatarChip}>
              <WorkspaceAvatar
                color={workspaceColor}
                name={workspaceTitle ?? "?"}
                avatarKey={workspaceAvatarKey}
                size={28}
              />
            </View>
            <UserText value={workspaceTitle ?? ""} style={sideNavStyles.workspaceName} numberOfLines={1}>
              {workspaceTitle ?? t("navigation.noWorkspace")}
            </UserText>
            <Press
              haptic="navigate"
              feel="glyph"
              testID="workspace-switch"
              accessibilityRole="button"
              accessibilityLabel={t("navigation.switchWorkspace")}
              style={sideNavStyles.switchBtn}
              onPress={onGoHome}
              hitSlop={10}
            >
              <Ionicons name="swap-horizontal" size={17} color={colors.textStrong} />
            </Press>
          </View>

          {/* Collections — the door to everything in this workspace. The count
              rides inside the label ("Collections · 3") as quiet inventory. */}
          {workspaceTitle ? (
            <Press
              testID="nav-collections"
              haptic="navigate"
              style={sideNavStyles.cardRow}
              onPress={onGoWorkspace}
            >
              <Ionicons name="albums-outline" size={17} color={colors.textStrong} />
              <Text style={sideNavStyles.cardRowLabel} numberOfLines={1}>
                {t("navigation.collections")}
                {collectionsCount > 0 ? (
                  <Text style={sideNavStyles.cardRowCount}>{` · ${collectionsCount}`}</Text>
                ) : null}
              </Text>
              <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
            </Press>
          ) : null}

          {/* Recent — the collections you were last inside, hung under the
              Collections door on a guide line, under one quiet word so they
              never read as the whole list. Absent until something was opened. */}
          {workspaceTitle && recentCollections.length > 0 ? (
            <View style={sideNavStyles.recentGroup}>
              <Text style={sideNavStyles.recentLabel}>{t("navigation.recent")}</Text>
              {recentCollections.map((entry) => (
                <Press
                  key={entry.id}
                  haptic="navigate"
                  testID={`nav-recent-${entry.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("navigation.recent")} · ${entry.title}`}
                  style={sideNavStyles.recentRow}
                  onPress={() => onOpenCollection(entry.id)}
                >
                  {/* "You are here": an ink tick on the guide line, not a fill
                      (founder, 2026-10-15: the white wash on the tint was a
                      third tone too many). */}
                  {entry.active ? <View style={sideNavStyles.recentHereTick} /> : null}
                  <Ionicons
                    name={NAV_ICONS.collection}
                    size={15}
                    color={entry.active ? colors.textStrong : colors.textSecondary}
                  />
                  <UserText
                    value={entry.title}
                    style={[sideNavStyles.recentTitle, entry.active ? sideNavStyles.recentTitleActive : null]}
                    numberOfLines={1}
                  >
                    {entry.title}
                  </UserText>
                  {entry.meta ? (
                    <UserText value={entry.meta} style={sideNavStyles.recentMeta} numberOfLines={1}>
                      {entry.meta}
                    </UserText>
                  ) : null}
                </Press>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Places, then your work ────────────────────────────────────── */}
      {/* No section labels (2026-10-15): two short groups split by a hairline
          read without being named. Places full of things first (Compilations,
          Received), then the pages about your own work. */}
      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <NavRow
          icon={NAV_ICONS.compilations}
          iconColor={NAV_ICON_COLOR}
          label={t("navigation.compilations")}
          active={currentRoute === "library"}
          onPress={onGoLibrary}
        />
        {/* Received — other people's work, kept apart from yours. The row exists
            only once something has arrived; the badge counts packages not yet
            opened, the Shelf's idiom. */}
        {receivedCount > 0 ? (
          <NavRow
            testID="nav-received"
            icon={NAV_ICONS.received}
            iconColor={NAV_ICON_COLOR}
            label={t("navigation.received")}
            active={currentRoute === "received"}
            onPress={onGoReceived}
            accessory={
              unopenedReceivedCount > 0 ? (
                <View style={sideNavStyles.countBadge}>
                  <Text style={sideNavStyles.countBadgeText}>{unopenedReceivedCount}</Text>
                </View>
              ) : undefined
            }
          />
        ) : null}

        <View style={sideNavStyles.divider} />
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
      </ScrollView>

      {/* ── Tool tray + Settings, pinned ──────────────────────────────── */}
      {/* The three instruments as one tray (founder, 2026-10-15: "distinguishes
          them quickly"): glyph over word on the paper, no boxes, so they read
          as tools without looking like form buttons. */}
      <View style={sideNavStyles.footer}>
        <View style={sideNavStyles.footerDivider} />
        <View style={sideNavStyles.tray}>
          {TOOL_TRAY.map((tool) => {
            const active = currentRoute === tool.route;
            return (
              <Press
                key={tool.route}
                haptic="navigate"
                testID={`nav-tool-${tool.route}`}
                accessibilityRole="button"
                style={[sideNavStyles.trayKey, active ? sideNavStyles.trayKeyActive : null]}
                onPress={{ sparks: onGoSparks, tuner: onGoTuner, metronome: onGoMetronome }[tool.route]}
              >
                <Ionicons name={NAV_ICONS[tool.route]} size={20} color={active ? colors.textPrimary : colors.textStrong} />
                <Text style={[sideNavStyles.trayLabel, active ? sideNavStyles.trayLabelActive : null]} numberOfLines={1}>
                  {t(tool.labelKey)}
                </Text>
              </Press>
            );
          })}
        </View>
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

const TOOL_TRAY = [
  { route: "sparks", labelKey: "navigation.sparks" },
  { route: "tuner", labelKey: "navigation.tuner" },
  { route: "metronome", labelKey: "navigation.metronome" },
] as const;

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
    paddingStart: 16,
    paddingEnd: 8,
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
  // A bare glyph, untinted: its plainness is what tells you search is global.
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnActive: {
    backgroundColor: colors.surfaceHigh,
  },

  // Workspace block
  workspaceBlock: {
    paddingHorizontal: 10,
  },
  workspaceCard: {
    backgroundColor: "#efeeea",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 2,
    marginHorizontal: 2,
  },
  workspaceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarChip: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceName: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Lora_600SemiBold",
    fontSize: 20,
    color: colors.textPrimary,
  },
  switchBtn: {
    width: 40,
    height: 40,
    marginEnd: -8,
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
  // Recent hangs under Collections: indented to the label's start, on a guide.
  recentGroup: {
    marginStart: 12,
    paddingStart: 14,
    borderStartWidth: StyleSheet.hairlineWidth,
    borderStartColor: colors.borderMuted,
    paddingTop: 2,
    paddingBottom: 2,
  },
  recentLabel: {
    ...textTokens.annotation,
    paddingTop: 2,
    paddingBottom: 2,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 36,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 6,
  },
  // Sits on the guide line (the group's start border, 8 pt outside the row).
  recentHereTick: {
    position: "absolute",
    start: -9,
    top: 9,
    bottom: 9,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.textStrong,
  },
  recentTitle: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.textStrong,
  },
  recentTitleActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  recentMeta: {
    flexShrink: 2,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },

  // Scrollable rows
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 2,
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

  // Footer: tool tray, then Settings
  footer: {
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  footerDivider: {
    height: 0.5,
    backgroundColor: colors.borderMuted,
    opacity: 0.5,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  tray: {
    flexDirection: "row",
    gap: 4,
  },
  trayKey: {
    flex: 1,
    minHeight: 60,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  trayKeyActive: {
    backgroundColor: "#efeeea",
  },
  trayLabel: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textStrong,
  },
  trayLabelActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
});
