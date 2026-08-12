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
import { ChordSheetSection } from "../../ChordSheetScreen/ChordSheetSection";
import type { ChordSheet, LyricsLine } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

const noop = () => {};

type Props = {
  /** Which artifact is open — decides the body (lyric text / lyric chart / block chart). */
  artifact: "lyrics" | "chart";
  text: string;
  chordLines?: LyricsLine[];
  chordSheet?: ChordSheet | null;
  /** Text-size multiplier from the reading bar's Aa control. */
  zoom: number;
  /** Chord lines over the lyrics — the Aa sheet can turn them off for a
   *  words-only read. Ignored when the version has no chords. */
  showChords?: boolean;
  /** Follow: scroll in lock-step with the playhead. */
  followEnabled: boolean;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  /** Live playback rate, so extrapolation between audio samples matches a slowed
   * or sped-up track instead of always assuming 1×. */
  playbackRate: number;
};

/**
 * The open artifact of the reading ladder: lyrics (plain or chord chart) or the
 * standalone block chart, filling the space the slim reel freed up. With follow
 * on, the scroll maps proportionally to the playhead — at X% through the song
 * the text sits at X% of its range — extrapolated per-frame between coarse audio
 * ticks (same trick as the waveform playhead). A manual drag hands control back
 * to the reader until they tap Resync.
 */
export function PlayerArtifactReader({
  artifact,
  text,
  chordLines,
  chordSheet,
  zoom,
  showChords = true,
  followEnabled,
  positionMs,
  durationMs,
  isPlaying,
  playbackRate,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  // True while follow is on AND the reader hasn't dragged away from it.
  const [tracking, setTracking] = useState(true);

  const showLyricChart =
    artifact === "lyrics" &&
    showChords &&
    !!chordLines &&
    chordLines.some((line) => line.chords.length > 0);
  const lines = useMemo(() => text.split("\n"), [text]);

  // Live values the rAF loop reads without re-subscribing each render.
  const maxOffsetRef = useRef(0);
  const trackingRef = useRef(followEnabled && tracking);
  const isPlayingRef = useRef(isPlaying);
  const durationRef = useRef(durationMs);
  const rateRef = useRef(playbackRate);
  const lastTargetRef = useRef(-1);
  // Sample-and-extrapolate: remember the last known playhead and the wall clock
  // when we learned it, so we can estimate position between coarse updates.
  const sampleMsRef = useRef(positionMs);
  const sampleWallRef = useRef(Date.now());

  maxOffsetRef.current = Math.max(0, contentHeight - viewportHeight);
  trackingRef.current = followEnabled && tracking;
  isPlayingRef.current = isPlaying;
  durationRef.current = durationMs;
  rateRef.current = playbackRate > 0 ? playbackRate : 1;

  useEffect(() => {
    sampleMsRef.current = positionMs;
    sampleWallRef.current = Date.now();
  }, [positionMs]);

  // Switching follow on always re-arms tracking (and forces one fresh scroll).
  useEffect(() => {
    if (followEnabled) {
      lastTargetRef.current = -1;
      setTracking(true);
    }
  }, [followEnabled]);

  // One rAF loop for the component's life. It only moves the scroll while
  // tracking; a manual takeover or a closed follow leaves it untouched.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!trackingRef.current) return;
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
  const handleScrollBeginDrag = () => setTracking(false);

  const resync = useCallback(() => {
    lastTargetRef.current = -1; // force the next tick to scroll
    setTracking(true);
  }, []);

  const body =
    artifact === "chart" ? (
      chordSheet && chordSheet.sections.length > 0 ? (
        chordSheet.sections.map((section) =>
          section.kind === "text" ? (
            <UserText key={section.id} value={section.text ?? ""} style={styles.chartText}>
              {section.text ?? ""}
            </UserText>
          ) : (
            <ChordSheetSection
              key={section.id}
              section={section}
              editable={false}
              selectionActive={false}
              selectedMeasureIds={[]}
              onTapMeasure={noop}
              onLongPressMeasure={noop}
              onAddMeasure={noop}
              onNotes={noop}
              onOpenMenu={noop}
            />
          )
        )
      ) : null
    ) : showLyricChart ? (
      <ChordChartLines lines={chordLines!} editable={false} zoom={zoom} />
    ) : (
      lines.map((line, i) =>
        line.trim() ? (
          <Text
            key={i}
            style={[styles.line, { fontSize: 20 * zoom, lineHeight: 34 * zoom }]}
          >
            {line}
          </Text>
        ) : (
          <View key={i} style={styles.blankLine} />
        )
      )
    );

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
        {body}
      </ScrollView>

      {followEnabled && !tracking ? (
        <Pressable
          style={({ pressed }) => [styles.resync, pressed ? appStyles.pressDown : null]}
          onPress={resync}
          accessibilityRole="button"
          accessibilityLabel={t("player.resyncLyrics")}
        >
          <Ionicons name="sync" size={15} color={colors.primaryDeep} />
          <Text style={styles.resyncText}>{t("player.resync")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Compact −/＋ speed stepper for the reading bar while follow is on. Steps
 * through the shared practice presets; the playhead-synced scroll follows the
 * new rate for free. */
export function FollowSpeedControl({
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
    paddingTop: spacing.md,
    // Generous tail so the final lines can still scroll up into view at 100%.
    paddingBottom: 160,
  },
  line: {
    fontFamily: "Lora_500Medium",
    color: colors.textPrimary,
  },
  blankLine: {
    height: 18,
  },
  chartText: {
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: colors.textSecondary,
    marginVertical: spacing.sm,
  },
  // Soft key in the primary tier (tonal wash + deep ink) — solid primary is
  // reserved for the single highest-stakes commit, which a re-follow is not.
  resync: {
    position: "absolute",
    alignSelf: "center",
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySurface,
    borderRadius: radii.lg,
    minHeight: 38,
    paddingHorizontal: 16,
    ...shadows.control,
  },
  resyncText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primaryDeep,
  },
  speed: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingHorizontal: 2,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
  },
  speedBtn: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  speedValue: {
    minWidth: 44,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
});
