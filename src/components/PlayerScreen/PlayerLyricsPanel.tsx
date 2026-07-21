import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, radii, spacing } from "../../design/tokens";
import { LyricsAutoscrollState, LyricsLine } from "../../types";
import { ChordChartLines } from "../LyricsVersionScreen/components/chords/ChordChart";
import { ChordZoomBar } from "../LyricsVersionScreen/components/chords/ChordZoomBar";
import { useTranslation } from "react-i18next";

type Props = {
  text: string;
  versionLabel: string;
  updatedAtLabel: string;
  /** When the version has chords, the structured lines render as a chord chart
   * (chords above lyrics) instead of the plain `text`. */
  chordLines?: LyricsLine[];
  /** Collapsed-state preview line; defaults to the first meaningful line of `text`. */
  summaryText?: string;
  autoscrollState?: LyricsAutoscrollState;
  variant?: "default" | "recording";
  expanded?: boolean;
  defaultExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
  autoscrollEnabled?: boolean;
  /** Whether the scroll may run right now (idle preview OR an unpaused take). */
  autoscrollActive?: boolean;
  /** True while a take is recording — flips Test→Pause and rewinds at take start. */
  isRecording?: boolean;
  autoscrollSpeedMultiplier?: number;
  onToggleAutoscroll?: (enabled: boolean) => void;
  onAutoscrollInterrupted?: () => void;
  onSelectAutoscrollSpeedMultiplier?: (multiplier: number) => void;
};

// Autoscroll speed is a multiplier on the base rate (1 ≈ one lyric line every
// ~BASE_MS_PER_LINE). Discrete steps you can tap by number — no slider.
const AUTOSCROLL_SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const BASE_MS_PER_LINE = 2600;
const MIN_AUTOSCROLL_DURATION_MS = 12000;

function autoscrollSpeedLabel(speed: number) {
  return speed.toString().replace(/^0/, "");
}

function PlayerLyricsPanelInner({
  text,
  versionLabel,
  updatedAtLabel,
  chordLines,
  summaryText,
  autoscrollState,
  variant = "default",
  expanded,
  defaultExpanded = true,
  onToggleExpanded,
  autoscrollEnabled = false,
  autoscrollActive = false,
  isRecording = false,
  autoscrollSpeedMultiplier = 1,
  onToggleAutoscroll,
  onAutoscrollInterrupted,
  onSelectAutoscrollSpeedMultiplier,
}: Props) {
  const { t } = useTranslation();
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const [zoom, setZoom] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);
  // Reveals the numeric speed row; auto-closes on pick or when a take starts.
  const [speedOpen, setSpeedOpen] = useState(false);
  const [chordsOn, setChordsOn] = useState(true);
  const isRecordingVariant = variant === "recording";
  const isExpanded = expanded ?? uncontrolledExpanded;
  const scrollRef = useRef<ScrollView>(null);
  const currentOffsetRef = useRef(0);
  // Keep the latest callback without making it an effect dependency — otherwise
  // the per-tick re-renders during recording would tear down and recreate the
  // scroll interval before it ever fires.
  const onToggleAutoscrollRef = useRef(onToggleAutoscroll);
  onToggleAutoscrollRef.current = onToggleAutoscroll;
  const onAutoscrollInterruptedRef = useRef(onAutoscrollInterrupted);
  onAutoscrollInterruptedRef.current = onAutoscrollInterrupted;
  const prevRecordingRef = useRef(false);
  // True while a finger is actively dragging the lyrics — lets a manual scroll
  // coexist with autoscroll instead of pausing it.
  const isDraggingRef = useRef(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const canAutoscroll = isExpanded && contentHeight > viewportHeight + 12;
  const lineCount = text.split("\n").filter((line) => line.trim().length > 0).length || 1;
  const maxOffset = Math.max(0, contentHeight - viewportHeight);
  const baseDurationMs = Math.max(MIN_AUTOSCROLL_DURATION_MS, lineCount * BASE_MS_PER_LINE);
  const effectiveDurationMs = baseDurationMs / autoscrollSpeedMultiplier;
  const autoscrollSpeedPxPerSecond = maxOffset > 0 ? maxOffset / (effectiveDurationMs / 1000) : 0;
  const previewText = useMemo(() => {
    if (summaryText !== undefined) return summaryText;
    const firstMeaningfulLine = text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    return firstMeaningfulLine ?? "";
  }, [summaryText, text]);

  const hasChords = !!chordLines && chordLines.some((line) => line.chords.length > 0);
  const showChart = chordsOn && hasChords;

  // One play/pause button, one meaning everywhere: is it scrolling right now?
  // Works identically idle (testing the speed) or mid-take (pausing/resuming) —
  // autoscrollActive is simply "not take-paused", so this needs no separate
  // "armed" or "testing" state.
  const isScrolling = autoscrollEnabled && autoscrollActive;
  const speedRowVisible = isRecordingVariant && isExpanded && canAutoscroll && speedOpen;

  if (!text.trim()) return null;

  function handleToggle() {
    const nextExpanded = !isExpanded;
    if (expanded === undefined) {
      setUncontrolledExpanded(nextExpanded);
    }
    onToggleExpanded?.(nextExpanded);
  }

  function handleLyricsLayout(event: LayoutChangeEvent) {
    setViewportHeight(event.nativeEvent.layout.height);
  }

  function handleLyricsScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    currentOffsetRef.current = event.nativeEvent.contentOffset.y;
  }

  useEffect(() => {
    if (!isExpanded) {
      currentOffsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [isExpanded]);

  // Rewind to the top when a take starts, and close the speed row — each take
  // begins fresh; pause/resume mid-take keeps your place.
  useEffect(() => {
    if (isRecording && !prevRecordingRef.current) {
      currentOffsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setSpeedOpen(false);
    }
    prevRecordingRef.current = !!isRecording;
  }, [isRecording]);

  // Rewind when the lyric text itself changes (e.g. switching versions).
  useEffect(() => {
    currentOffsetRef.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [text]);

  // Player variant: rewind whenever autoscroll is switched on (its original
  // behaviour). The recording variant rewinds on take start instead, so that
  // pause/resume mid-take keeps your place.
  useEffect(() => {
    if (!isRecordingVariant && autoscrollEnabled) {
      currentOffsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [autoscrollEnabled, isRecordingVariant]);

  useEffect(() => {
    if (!isExpanded || !canAutoscroll || !isScrolling) {
      return;
    }

    let lastTick = Date.now();
    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - lastTick;
      lastTick = now;

      // A manual scroll doesn't pause autoscroll — but skip the programmatic
      // scrollTo while a finger is down so it doesn't fight the drag. Resetting
      // lastTick every tick means the moment the drag ends, scrolling resumes
      // from wherever it was left with no catch-up jump.
      if (isDraggingRef.current) {
        return;
      }

      const nextOffset = Math.min(
        maxOffset,
        currentOffsetRef.current + (autoscrollSpeedPxPerSecond * elapsedMs) / 1000
      );

      currentOffsetRef.current = nextOffset;
      scrollRef.current?.scrollTo({ y: nextOffset, animated: false });

      if (nextOffset >= maxOffset) {
        if (isRecordingVariant) onAutoscrollInterruptedRef.current?.();
        else onToggleAutoscrollRef.current?.(false);
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [
    isScrolling,
    autoscrollSpeedMultiplier,
    canAutoscroll,
    contentHeight,
    isExpanded,
    isRecordingVariant,
    maxOffset,
    viewportHeight,
  ]);

  if (isRecordingVariant) {
    return (
      <View style={[appStyles.recordingLyricsPanel, isExpanded ? appStyles.recordingLyricsPanelExpanded : null]}>
        <View
          style={[
            appStyles.playerLyricsHeader,
            appStyles.recordingLyricsHeader,
            isExpanded ? appStyles.recordingLyricsHeaderExpanded : null,
          ]}
        >
          <Pressable
            style={isExpanded ? null : appStyles.recordingLyricsTitleArea}
            onPress={handleToggle}
            hitSlop={6}
          >
            <Text
              style={[
                appStyles.playerLyricsTitle,
                appStyles.recordingLyricsTitle,
                isExpanded ? appStyles.recordingLyricsTitleExpanded : null,
              ]}
              numberOfLines={1}
            >
              Lyrics
            </Text>
            {!isExpanded ? (
              <Text style={[appStyles.playerLyricsMeta, appStyles.recordingLyricsMeta]}>
                {versionLabel} • {updatedAtLabel}
              </Text>
            ) : null}
          </Pressable>

          {isExpanded && hasChords ? (
            <Pressable
              style={appStyles.recordingLyricsZoomBtn}
              onPress={() => setChordsOn((on) => !on)}
              hitSlop={6}
              accessibilityLabel={chordsOn ? t("player.hideChords") : t("player.showChords")}
            >
              <MaterialCommunityIcons name={chordsOn ? "music" : "music-off"} size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}

          {isExpanded ? <View style={appStyles.recordingLyricsHeaderSpacer} /> : null}

          {isExpanded ? (
            <View style={appStyles.recordingLyricsHeaderActions}>
              {canAutoscroll ? (
                <>
                  {/* The whole control: is it scrolling right now? Same single tap
                   * idle (test the speed) or mid-take (pause/resume). */}
                  <Pressable
                    style={[
                      appStyles.recordingLyricsZoomBtn,
                      isScrolling ? appStyles.recordingLyricsZoomBtnActive : null,
                    ]}
                    onPress={() =>
                      autoscrollEnabled ? onAutoscrollInterrupted?.() : onToggleAutoscroll?.(true)
                    }
                    hitSlop={6}
                    accessibilityLabel={isScrolling ? t("player.pauseAutoscroll") : t("player.startAutoscroll")}
                  >
                    <Ionicons
                      name={isScrolling ? "pause" : "play"}
                      size={16}
                      color={isScrolling ? colors.primaryDeep : colors.textSecondary}
                    />
                  </Pressable>

                  <Pressable
                    style={[
                      appStyles.recordingLyricsSpeedBtn,
                      speedOpen ? appStyles.recordingLyricsZoomBtnActive : null,
                    ]}
                    onPress={() => setSpeedOpen((open) => !open)}
                    hitSlop={6}
                    accessibilityLabel={t("player.autoscrollSpeed")}
                  >
                    <Text
                      style={[
                        appStyles.recordingLyricsSpeedBtnText,
                        speedOpen ? appStyles.recordingLyricsSpeedBtnTextActive : null,
                      ]}
                    >
                      {autoscrollSpeedLabel(autoscrollSpeedMultiplier)}×
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                style={[
                  appStyles.recordingLyricsZoomBtn,
                  zoomOpen ? appStyles.recordingLyricsZoomBtnActive : null,
                ]}
                onPress={() => setZoomOpen((open) => !open)}
                hitSlop={6}
                accessibilityLabel={t("player.lyricSize")}
              >
                <Ionicons name="text" size={16} color={zoomOpen ? colors.primaryDeep : colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[appStyles.playerLyricsToggleBtn, appStyles.recordingLyricsToggleBtn]}
            onPress={handleToggle}
            hitSlop={6}
          >
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textStrong} />
          </Pressable>
        </View>

        {speedRowVisible ? (
          <View style={appStyles.recordingLyricsSpeedRow}>
            {AUTOSCROLL_SPEED_OPTIONS.map((speed) => {
              const active = Math.abs(speed - autoscrollSpeedMultiplier) < 0.001;
              return (
                <Pressable
                  key={speed}
                  style={[
                    appStyles.recordingLyricsSpeedRowItem,
                    active ? appStyles.recordingLyricsSpeedRowItemActive : null,
                  ]}
                  onPress={() => {
                    onSelectAutoscrollSpeedMultiplier?.(speed);
                    setSpeedOpen(false);
                  }}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      appStyles.recordingLyricsSpeedRowText,
                      active ? appStyles.recordingLyricsSpeedRowTextActive : null,
                    ]}
                  >
                    {autoscrollSpeedLabel(speed)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {isExpanded ? (
          <View style={appStyles.recordingLyricsBodyExpanded}>
            <ScrollView
              ref={scrollRef}
              style={appStyles.recordingLyricsScroll}
              contentContainerStyle={appStyles.recordingLyricsScrollContent}
              onLayout={handleLyricsLayout}
              onContentSizeChange={(_, height) => setContentHeight(height)}
              onScroll={handleLyricsScroll}
              onScrollBeginDrag={() => {
                isDraggingRef.current = true;
              }}
              onScrollEndDrag={() => {
                isDraggingRef.current = false;
              }}
              onMomentumScrollEnd={() => {
                isDraggingRef.current = false;
              }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              persistentScrollbar
              scrollEventThrottle={16}
            >
              {showChart ? (
                <ChordChartLines lines={chordLines!} editable={false} zoom={zoom} />
              ) : (
                <Text
                  style={[
                    appStyles.playerLyricsText,
                    appStyles.recordingLyricsText,
                    { fontSize: 20 * zoom, lineHeight: 36 * zoom },
                  ]}
                >
                  {text}
                </Text>
              )}
            </ScrollView>

            {zoomOpen ? <ChordZoomBar zoom={zoom} onChange={setZoom} compact /> : null}
          </View>
        ) : null}
      </View>
    );
  }

  // Player variant: the lyrics are the reading hero. No card-in-card — when
  // expanded they flow directly on the page (carried by the screen's own
  // scroll), so a long lyric gets real room instead of a cramped inner box.
  return (
    <View style={styles.panel}>
      <Pressable style={styles.header} onPress={handleToggle} hitSlop={6}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{t("common.lyrics")}</Text>
          <Text style={styles.meta}>
            {versionLabel} · {updatedAtLabel}
          </Text>
          {!isExpanded && previewText ? (
            <Text style={styles.summary} numberOfLines={2}>
              {previewText}
            </Text>
          ) : null}
        </View>
        <View style={styles.toggle}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={styles.body}>
          {showChart ? (
            <ChordChartLines lines={chordLines!} editable={false} />
          ) : (
            <Text style={styles.text}>{text}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export const PlayerLyricsPanel = React.memo(PlayerLyricsPanelInner);

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  kicker: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  summary: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggle: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
  },
  text: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 30,
    color: colors.textPrimary,
  },
});
