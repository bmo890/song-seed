import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { ChordChartLines } from "../../LyricsVersionScreen/components/chords/ChordChart";
import type { LyricsLine } from "../../../types";
import { useTranslation } from "react-i18next";

type Props = {
  text: string;
  chordLines?: LyricsLine[];
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  /** Live playback rate, so extrapolation between audio samples matches a slowed
   * or sped-up track instead of always assuming 1×. */
  playbackRate: number;
};

/**
 * Play-along lyrics: the lyrics fill the screen and scroll in lock-step with the
 * playhead. The mapping is proportional — at X% through the song the lyrics sit
 * at X% of their scroll range — so it "follows the waveform" without any per-line
 * timing. A manual drag hands control back to the reader (follow pauses) until
 * they tap Resync.
 *
 * Smoothness: audio position updates arrive coarsely (every audio tick), so a
 * requestAnimationFrame loop extrapolates between samples using wall-clock time
 * and scrolls every frame — the same trick the waveform playhead uses.
 */
export function PlayAlongLyrics({
  text,
  chordLines,
  positionMs,
  durationMs,
  isPlaying,
  playbackRate,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [following, setFollowing] = useState(true);

  const showChart = !!chordLines && chordLines.some((line) => line.chords.length > 0);
  const lines = useMemo(() => text.split("\n"), [text]);

  // Live values the rAF loop reads without re-subscribing each render.
  const maxOffsetRef = useRef(0);
  const followingRef = useRef(following);
  const isPlayingRef = useRef(isPlaying);
  const durationRef = useRef(durationMs);
  const rateRef = useRef(playbackRate);
  const lastTargetRef = useRef(-1);
  // Sample-and-extrapolate: remember the last known playhead and the wall clock
  // when we learned it, so we can estimate position between coarse updates.
  const sampleMsRef = useRef(positionMs);
  const sampleWallRef = useRef(Date.now());

  maxOffsetRef.current = Math.max(0, contentHeight - viewportHeight);
  followingRef.current = following;
  isPlayingRef.current = isPlaying;
  durationRef.current = durationMs;
  rateRef.current = playbackRate > 0 ? playbackRate : 1;

  useEffect(() => {
    sampleMsRef.current = positionMs;
    sampleWallRef.current = Date.now();
  }, [positionMs]);

  // One rAF loop for the component's life. It only moves the scroll while
  // following; a manual takeover or a paused/empty track leaves it untouched.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!followingRef.current) return;
      const duration = durationRef.current;
      const maxOffset = maxOffsetRef.current;
      if (duration <= 0 || maxOffset <= 0) return;
      const elapsed = isPlayingRef.current
        ? (Date.now() - sampleWallRef.current) * rateRef.current
        : 0;
      const estMs = Math.min(duration, Math.max(0, sampleMsRef.current + elapsed));
      const target = (estMs / duration) * maxOffset;
      // Skip redundant scrolls (paused, or sub-pixel movement).
      if (Math.abs(target - lastTargetRef.current) < 0.5) return;
      lastTargetRef.current = target;
      scrollRef.current?.scrollTo({ y: target, animated: false });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleViewportLayout = (e: LayoutChangeEvent) =>
    setViewportHeight(e.nativeEvent.layout.height);

  // A drag means the reader took over — stop following until they resync.
  const handleScrollBeginDrag = () => setFollowing(false);

  const resync = useCallback(() => {
    lastTargetRef.current = -1; // force the next tick to scroll
    setFollowing(true);
  }, []);

  if (!text.trim()) {
    return (
      <View style={styles.empty}>
        <Ionicons name="musical-notes-outline" size={26} color={colors.textMuted} />
        <Text style={styles.emptyText}>{t("player.noLyrics")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onLayout={handleViewportLayout}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onScrollBeginDrag={handleScrollBeginDrag}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {showChart ? (
          <ChordChartLines lines={chordLines!} editable={false} />
        ) : (
          lines.map((line, i) =>
            line.trim() ? (
              <Text key={i} style={styles.line}>
                {line}
              </Text>
            ) : (
              <View key={i} style={styles.blankLine} />
            )
          )
        )}
      </ScrollView>

      {!following ? (
        <Pressable
          style={({ pressed }) => [styles.resync, pressed ? appStyles.pressDown : null]}
          onPress={resync}
          accessibilityRole="button"
          accessibilityLabel={t("player.resyncLyrics")}
        >
          <Ionicons name="sync" size={15} color={colors.onPrimary} />
          <Text style={styles.resyncText}>{t("player.resync")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Compact −/＋ speed stepper for the play-along bar. Steps through the shared
 * practice presets; the playhead-synced scroll follows the new rate for free. */
export function PlayAlongSpeedControl({
  speed,
  presets,
  min,
  max,
  onSelect,
}: {
  speed: number;
  presets: readonly number[];
  min: number;
  max: number;
  onSelect: (speed: number) => void;
}) {
  const { t } = useTranslation();
  const sorted = useMemo(() => [...presets].sort((a, b) => a - b), [presets]);
  const canDecrease = speed > min + 1e-6;
  const canIncrease = speed < max - 1e-6;

  const decrease = () => {
    const next = [...sorted].reverse().find((p) => p < speed - 1e-6);
    if (next != null) onSelect(next);
  };
  const increase = () => {
    const next = sorted.find((p) => p > speed + 1e-6);
    if (next != null) onSelect(next);
  };

  const label = `${speed.toFixed(speed % 1 === 0 ? 1 : 2)}×`;

  return (
    <View style={styles.speed}>
      <Pressable
        style={({ pressed }) => [styles.speedBtn, pressed && canDecrease ? appStyles.pressDown : null]}
        onPress={decrease}
        disabled={!canDecrease}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t("player.slower")}
      >
        <Ionicons
          name="remove"
          size={16}
          color={canDecrease ? colors.textStrong : colors.textMuted}
        />
      </Pressable>
      <Text style={styles.speedValue}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.speedBtn, pressed && canIncrease ? appStyles.pressDown : null]}
        onPress={increase}
        disabled={!canIncrease}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t("player.faster")}
      >
        <Ionicons name="add" size={16} color={canIncrease ? colors.textStrong : colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    // Generous tail so the final lines can still scroll up into view at 100%.
    paddingBottom: 160,
  },
  line: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 22,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  blankLine: {
    height: 18,
  },
  resync: {
    position: "absolute",
    alignSelf: "center",
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingHorizontal: 16,
    paddingVertical: 9,
    ...shadows.control,
  },
  resyncText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.onPrimary,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyText: {
    ...textTokens.supporting,
  },
  speed: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    paddingHorizontal: 4,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  speedBtn: {
    width: 30,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  speedValue: {
    minWidth: 46,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
});
