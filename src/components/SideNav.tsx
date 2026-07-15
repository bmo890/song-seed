import type { ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { radii, shadows, colors } from "../design/tokens";
import { NavRow } from "./common/NavRow";
import { WorkspaceAvatar } from "./common/WorkspaceAvatar";
import { getWorkspaceTheme } from "../domain/workspaceTheme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// Sidenav-local icon set. Kept separate from the app-wide hierarchy icons so the
// drawer can use warmer, more music-appropriate glyphs tinted with the earthy
// workspace palette — without disturbing the icons used in idea lists/breadcrumbs.
const NAV_ICONS: Record<
  "revisit" | "activity" | "library" | "notepad" | "tuner" | "metronome" | "settings",
  { icon: IoniconName; color: string }
> = {
  revisit: { icon: "time-outline", color: "#7A9E8E" }, // sage
  activity: { icon: "analytics-outline", color: "#A89B6E" }, // ochre
  library: { icon: "library-outline", color: "#7B8FAD" }, // slate
  notepad: { icon: "journal-outline", color: "#8E7B9E" }, // plum
  tuner: { icon: "speedometer-outline", color: "#6E8E7D" }, // forest
  metronome: { icon: "pulse-outline", color: "#9E7B6E" }, // rust
  settings: { icon: "settings-outline", color: colors.textSecondary }, // warm gray
};

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
  onGoActivity: () => void;
  onGoTuner: () => void;
  onGoMetronome: () => void;
  onGoLibrary: () => void;
  onGoSettings: () => void;
  onGoNotepad: () => void;
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
  onGoActivity,
  onGoTuner,
  onGoMetronome,
  onGoLibrary,
  onGoSettings,
  onGoNotepad,
  onOpenCollection,
}: Props) {
  const mostRecent = recentCollections[0] ?? null;
  const workspaceTheme = getWorkspaceTheme(workspaceColor);

  return (
    <SafeAreaView style={sideNavStyles.shell}>

      {/* ── Brand + global search ─────────────────────────────────────── */}
      {/* Left: app wordmark (placeholder until the real logo lands). Right: a
          global search action — living up here (not under the workspace card)
          signals it searches the whole library, not just this workspace. */}
      <View style={sideNavStyles.header}>
        <View style={sideNavStyles.brand}>
          <View style={sideNavStyles.brandMark} />
          <Text style={sideNavStyles.brandName}>Songstead</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            sideNavStyles.searchBtn,
            currentRoute === "search" ? sideNavStyles.searchBtnActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onGoSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Search your library"
        >
          <Ionicons
            name="search"
            size={19}
            color={currentRoute === "search" ? colors.surface : colors.primaryDeep}
          />
        </Pressable>
      </View>

      {/* ── Workspace context block ────────────────────────────────────── */}
      <View style={sideNavStyles.workspaceBlock}>

        {/* Workspace identity card */}
        <View style={[sideNavStyles.workspaceCard, { backgroundColor: workspaceTheme.tint }]}>
          {/* Label row with dot */}
          <View style={sideNavStyles.workspaceLabelRow}>
            <View style={sideNavStyles.contextDot} />
            <Text style={sideNavStyles.sectionLabel}>Workspace</Text>
          </View>

          {/* Workspace name + swap icon inline */}
          <View style={sideNavStyles.workspaceNameRow}>
            <WorkspaceAvatar
              color={workspaceColor}
              name={workspaceTitle ?? "?"}
              avatarKey={workspaceAvatarKey}
              size={32}
            />
            <Text style={sideNavStyles.workspaceName} numberOfLines={1}>
              {workspaceTitle ?? "No workspace"}
            </Text>
            <Pressable
              testID="workspace-switch"
              accessibilityRole="button"
              accessibilityLabel="Switch workspace"
              style={({ pressed }) => [sideNavStyles.switchBtn, pressed ? styles.pressDown : null]}
              onPress={onGoHome}
              hitSlop={10}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Collections — browse all collections in this workspace. A quiet,
              plain row; the emphasis (white surface) goes to Recent below, which
              gets pressed far more often. */}
          {workspaceTitle ? (
            <Pressable
              style={({ pressed }) => [sideNavStyles.collectionsRow, pressed ? styles.pressDown : null]}
              onPress={onGoWorkspace}
            >
              <Ionicons name="albums-outline" size={16} color={colors.textSecondary} />
              <Text style={sideNavStyles.collectionsLabel}>Collections</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {/* Most recent collection — the primary quick-jump, so it carries the
              white CTA surface + the workspace accent on its (single) folder. */}
          {mostRecent ? (
            <>
              <View style={sideNavStyles.cardDivider} />
              <Text style={[sideNavStyles.sectionLabel, sideNavStyles.recentLabelInCard]}>Recent</Text>
              <Pressable
                style={({ pressed }) => [
                  sideNavStyles.recentItem,
                  mostRecent.active ? { borderColor: workspaceTheme.accent } : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => onOpenCollection(mostRecent.id)}
              >
                <Ionicons name="folder-outline" size={16} color={workspaceTheme.accent} />
                <View style={sideNavStyles.recentItemCopy}>
                  <Text style={sideNavStyles.recentItemTitle} numberOfLines={1}>
                    {mostRecent.title}
                  </Text>
                  {mostRecent.meta ? (
                    <Text style={sideNavStyles.recentItemMeta} numberOfLines={1}>
                      {mostRecent.meta}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {/* ── Scrollable lower sections ──────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={sideNavStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Explore */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabel}>Explore</Text>
        <NavRow
          icon={NAV_ICONS.revisit.icon}
          iconColor={NAV_ICONS.revisit.color}
          label="Revisit"
          active={currentRoute === "revisit"}
          onPress={onGoRevisit}
        />
        <NavRow
          icon={NAV_ICONS.activity.icon}
          iconColor={NAV_ICONS.activity.color}
          label="Activity"
          active={currentRoute === "activity"}
          onPress={onGoActivity}
        />
        <NavRow
          icon={NAV_ICONS.library.icon}
          iconColor={NAV_ICONS.library.color}
          label="Library"
          active={currentRoute === "library"}
          onPress={onGoLibrary}
        />

        {/* Tools */}
        <View style={sideNavStyles.divider} />
        <Text style={sideNavStyles.sectionLabel}>Tools</Text>
        <NavRow
          icon={NAV_ICONS.notepad.icon}
          iconColor={NAV_ICONS.notepad.color}
          label="Lyrics Pad"
          active={currentRoute === "notepad"}
          onPress={onGoNotepad}
        />
        <NavRow
          icon={NAV_ICONS.tuner.icon}
          iconColor={NAV_ICONS.tuner.color}
          label="Tuner"
          active={currentRoute === "tuner"}
          onPress={onGoTuner}
        />
        <NavRow
          icon={NAV_ICONS.metronome.icon}
          iconColor={NAV_ICONS.metronome.color}
          label="Metronome"
          active={currentRoute === "metronome"}
          onPress={onGoMetronome}
        />
      </ScrollView>

      {/* ── Settings pinned footer ─────────────────────────────────────── */}
      <View style={sideNavStyles.footer}>
        <View style={sideNavStyles.footerDivider} />
        <NavRow
          icon={NAV_ICONS.settings.icon}
          iconColor={NAV_ICONS.settings.color}
          label="Settings"
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
    borderTopRightRadius: radii.drawer,
    borderBottomRightRadius: radii.drawer,
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
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2e7e2",
  },
  searchBtnActive: {
    backgroundColor: colors.primary,
  },

  // Workspace block
  workspaceBlock: {
    paddingHorizontal: 10,
    gap: 6,
  },
  workspaceCard: {
    backgroundColor: "#efeeea",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
    marginHorizontal: 2,
  },
  workspaceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contextDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  workspaceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  workspaceName: {
    flex: 1,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 20,
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
  collectionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 9,
    marginHorizontal: -4,
    marginTop: 2,
    borderRadius: 6,
  },
  collectionsLabel: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },

  // Recent (nested inside the workspace card, sitting on its tint)
  cardDivider: {
    height: 0.5,
    backgroundColor: "rgba(28,28,25,0.08)",
    marginTop: 4,
    marginBottom: 2,
  },
  recentLabelInCard: {
    marginLeft: 2,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  recentItemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recentItemTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  recentItemMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Scrollable sections
  scrollContent: {
    paddingHorizontal: 10,
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
