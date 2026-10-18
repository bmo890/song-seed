import React, { useMemo } from "react";
import { I18nManager, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { colors } from "../../design/tokens";
import { dirIcon } from "../../design/directionalIcons";
import { useStore } from "../../state/useStore";
import { UserText } from "../../i18n";
import { looksMachineNamed } from "../../domain/titleNaming";

/**
 * The strip at the foot of a stage page (songbook reader, setlist song,
 * 2026-10-18): the previous song's name, whatever the page keeps at hand in
 * the middle, the next song's name. It sits ABOVE the media dock: the dock's
 * published height is reserved under it, so playing a song never buries the
 * page turn (it used to). Turning a page is navigation, so it is silent.
 */
export function SongPagerStrip({
  previousTitle,
  nextTitle,
  onPrevious,
  onNext,
  children,
}: {
  previousTitle: string | null;
  nextTitle: string | null;
  onPrevious: () => void;
  onNext: () => void;
  /** The page's keys between the two names (play, the click, a position). */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dockHeight = useStore((s) => s.playerDockHeight);
  const bottom = dockHeight > 0 ? dockHeight : Math.max(insets.bottom, 10);

  return (
    <View style={[styles.strip, { paddingBottom: bottom }]}>
      <View style={styles.row}>
        <Press
          feel="glyph"
          // haptics.ts: navigation is silent.
          haptic="navigate"
          style={[styles.side, !previousTitle ? styles.sideDisabled : null]}
          onPress={onPrevious}
          disabled={!previousTitle}
          accessibilityRole="button"
          accessibilityLabel={
            previousTitle ? t("library.previousSong", { title: previousTitle }) : t("library.firstSong")
          }
        >
          <Ionicons name={dirIcon("chevron-back")} size={15} color={colors.textStrong} />
          {previousTitle ? <SongName title={previousTitle} /> : null}
        </Press>

        {children ? <View style={styles.middle}>{children}</View> : null}

        <Press
          feel="glyph"
          // haptics.ts: navigation is silent.
          haptic="navigate"
          style={[styles.side, styles.sideEnd, !nextTitle ? styles.sideDisabled : null]}
          onPress={onNext}
          disabled={!nextTitle}
          accessibilityRole="button"
          accessibilityLabel={nextTitle ? t("library.nextSong", { title: nextTitle }) : t("library.lastSong")}
        >
          {nextTitle ? <SongName title={nextTitle} /> : null}
          <Ionicons name={dirIcon("chevron-forward")} size={15} color={colors.textStrong} />
        </Press>
      </View>
    </View>
  );
}

/** A neighbour's name: Lora when it reads as a name, quiet Jakarta when the
 *  recorder named it (earned serif). */
function SongName({ title }: { title: string }) {
  const machine = looksMachineNamed(title);
  return (
    <UserText value={title} style={[styles.name, machine ? styles.nameMachine : null]} numberOfLines={1}>
      {title}
    </UserText>
  );
}

/** A horizontal swipe turns the page: toward the reading direction's end is
 *  the next song. Vertical drags fail it, so the page still scrolls. */
export function useSongSwipe(onPrevious: () => void, onNext: () => void) {
  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .onEnd((event) => {
          const forward = I18nManager.isRTL ? event.translationX > 0 : event.translationX < 0;
          const far = Math.abs(event.translationX) > 64 || Math.abs(event.velocityX) > 600;
          if (!far) return;
          if (forward) onNext();
          else onPrevious();
        }),
    [onNext, onPrevious]
  );
}

/** The quiet "2 of 4" a stage page shows. */
export function SongPosition({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  return <Text style={styles.position}>{t("reading.position", { current, total })}</Text>;
}

const styles = StyleSheet.create({
  strip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
    backgroundColor: colors.page,
    paddingTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: 6,
  },
  side: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  sideEnd: {
    justifyContent: "flex-end",
  },
  sideDisabled: {
    opacity: 0.35,
  },
  middle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  name: {
    flexShrink: 1,
    fontFamily: "Lora_600SemiBold",
    fontSize: 15,
    color: colors.textStrong,
  },
  nameMachine: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
  },
  position: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
});
