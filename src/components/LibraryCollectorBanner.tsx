import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";
import { useTranslation } from "react-i18next";
import { useStore } from "../state/useStore";
import { addIdeasToLibraryCollector } from "../state/libraryCollectorActions";
import { AppAlert } from "./common/AppAlert";
import { haptic } from "../design/haptics";
import { UserText } from "../i18n";

type Props = {
  kind: "playlist" | "songbook" | "setlist";
  targetTitle: string;
  addedCount: number;
  onDone: () => void;
  onCancel: () => void;
};

const KIND_ICONS = {
  playlist: "musical-notes",
  songbook: "book",
  setlist: "albums",
} as const;

/** Persistent "collecting" indicator shown while the user browses the app adding
 * items to a playlist, songbook, or setlist. Same solid-terracotta mode language
 * as the song-target picker banner: you're in a mode, and the two exits are
 * explicit — Done returns to the collection, ✕ ends collecting in place. */
/** Walks up the navigator tree to reach a route registered on an ancestor
 *  (the drawer's LibraryHome from inside the workspace stack). */
function navigateToAncestorRoute(navigation: any, routeName: string, params?: Record<string, unknown>) {
  let current = navigation;
  while (current) {
    const routeNames = current.getState?.()?.routeNames;
    if (Array.isArray(routeNames) && routeNames.includes(routeName)) {
      current.navigate(routeName, params);
      return true;
    }
    current = current.getParent?.();
  }
  return false;
}

/**
 * The banner's two verbs, shared by every page that shows it (hub + collection).
 * Done means "I'm finished picking": anything still selected is added first,
 * then the compilation that started the session reopens. ✕ ends collecting
 * in place and keeps nothing (2026-09-11 — Done used to add nothing, so a
 * selection made with Done in mind silently vanished).
 */
export function useLibraryCollectorHandlers(navigation: any) {
  const { t } = useTranslation();
  const onDone = () => {
    const state = useStore.getState();
    const collector = state.libraryCollector;
    if (!collector) return;
    const pending = state.selectedListIdeaIds;
    if (pending.length > 0) {
      const result = addIdeasToLibraryCollector(pending);
      if (result.noCharts) {
        AppAlert.info(t("selection.noCharts"), t("selection.noChartsBody"));
        return;
      }
      state.cancelListSelection();
      haptic.success();
    }
    const { kind, targetId } = collector;
    state.cancelLibraryCollecting();
    navigateToAncestorRoute(navigation, "LibraryHome", {
      openCollectionKind: kind,
      openCollectionId: targetId,
      openToken: Date.now(),
    });
  };
  const onCancel = () => {
    const state = useStore.getState();
    state.cancelListSelection();
    state.cancelLibraryCollecting();
  };
  return { onDone, onCancel };
}

export function LibraryCollectorBanner({ kind, targetTitle, addedCount, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <View style={bannerStyles.bar}>
      <View style={bannerStyles.iconWrap}>
        <Ionicons name={KIND_ICONS[kind]} size={13} color={colors.onPrimary} />
      </View>
      <UserText value={targetTitle} style={bannerStyles.text} numberOfLines={1}>{t("common.addingTo", { title: targetTitle })}</UserText>
      {addedCount > 0 ? (
        <View style={bannerStyles.countBadge}>
          <Text style={bannerStyles.countBadgeText}>{addedCount}</Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [bannerStyles.doneBtn, pressed ? bannerStyles.btnPressed : null]}
        onPress={onDone}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.doneBackTo", { title: targetTitle })}
      >
        <Text style={bannerStyles.doneText}>{t("common.done")}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [bannerStyles.cancelBtn, pressed ? bannerStyles.btnPressed : null]}
        onPress={onCancel}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("common.stopAdding")}
      >
        <Ionicons name="close" size={15} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...textTokens.body,
    flex: 1,
    color: colors.onPrimary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    ...textTokens.annotation,
    color: colors.onPrimary,
    letterSpacing: 0,
  },
  doneBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  doneText: {
    ...textTokens.caption,
    color: colors.onPrimary,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  cancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.7,
  },
});
