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
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../styles";
import { colors, radii, spacing } from "../../design/tokens";
import { LyricsAutoscrollState, LyricsLine } from "../../types";
import { ChordChartLines } from "../LyricsVersionScreen/components/chords/ChordChart";
import { ChordZoomBar } from "../LyricsVersionScreen/components/chords/ChordZoomBar";

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
  autoscrollActive?: boolean;
  autoscrollSpeedMultiplier?: number;
  onToggleAutoscroll?: (enabled: boolean) => void;
  onAutoscrollInterrupted?: () => void;
  onSelectAutoscrollSpeedMultiplier?: (multiplier: number) => void;
};

const AUTOSCROLL_SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2];
const BASE_MS_PER_LINE = 2600;
const MIN_AUTOSCROLL_DURATION_MS = 12000;

function getAutoscrollLabel(state?: LyricsAutoscrollState) {
  if (!state) return null;
  if (state.mode === "follow") return "Autoscroll on";
  if (state.mode === "manual") return "Autoscroll paused";
  return "Autoscroll off";
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
  autoscrollSpeedMultiplier = 1,
  onToggleAutoscroll,
  onAutoscrollInterrupted,
  onSelectAutoscrollSpeedMultiplier,
}: Props) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const [zoom, setZoom] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [autoscrollMenuOpen, setAutoscrollMenuOpen] = useState(false);
  const autoscrollLabel = getAutoscrollLabel(autoscrollState);
  const isRecordingVariant = variant === "recording";
  const isExpanded = expanded ?? uncontrolledExpanded;
  const scrollRef = useRef<ScrollView>(null);
  const currentOffsetRef = useRef(0);
  // Keep the latest callback without making it an effect dependency — otherwise
  // the per-tick re-renders during recording would tear down and recreate the
  // scroll interval before it ever fires.
  const onToggleAutoscrollRef = useRef(onToggleAutoscroll);
  onToggleAutoscrollRef.current = onToggleAutoscroll;
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

  const showChart = !!chordLines && chordLines.some((line) => line.chords.length > 0);

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

  function handleAutoscrollToggle() {
    onToggleAutoscroll?.(!autoscrollEnabled);
  }

  useEffect(() => {
    if (!isExpanded) {
      currentOffsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [isExpanded]);

  useEffect(() => {
    if (autoscrollEnabled) {
      currentOffsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [autoscrollEnabled, text]);

  useEffect(() => {
    if (!isExpanded || !canAutoscroll || !autoscrollEnabled || !autoscrollActive) {
      return;
    }

    let lastTick = Date.now();
    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - lastTick;
      lastTick = now;

      const nextOffset = Math.min(
        maxOffset,
        currentOffsetRef.current + (autoscrollSpeedPxPerSecond * elapsedMs) / 1000
      );

      currentOffsetRef.current = nextOffset;
      scrollRef.current?.scrollTo({ y: nextOffset, animated: false });

      if (nextOffset >= maxOffset) {
        onToggleAutoscrollRef.current?.(false);
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [
    autoscrollActive,
    autoscrollEnabled,
    autoscrollSpeedMultiplier,
    canAutoscroll,
    contentHeight,
    isExpanded,
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
          <Pressable style={appStyles.recordingLyricsTitleArea} onPress={handleToggle} hitSlop={6}>
            <Text style={[appStyles.playerLyricsTitle, appStyles.recordingLyricsTitle]}>Lyrics</Text>
            {!isExpanded ? (
              <Text style={[appStyles.playerLyricsMeta, appStyles.recordingLyricsMeta]}>
                {versionLabel} • {updatedAtLabel}
              </Text>
            ) : null}
          </Pressable>

          {isExpanded ? (
            <View style={appStyles.recordingLyricsHeaderActions}>
              {canAutoscroll ? (
                <Pressable
                  style={[
                    appStyles.recordingLyricsHeaderChip,
                    autoscrollEnabled ? appStyles.recordingLyricsHeaderChipActive : null,
                  ]}
                  onPress={() => setAutoscrollMenuOpen((open) => !open)}
                  hitSlop={6}
                >
                  <Ionicons
                    name="play"
                    size={12}
                    color={autoscrollEnabled ? "#ffffff" : "#824f3f"}
                  />
                  <Text
                    style={[
                      appStyles.recordingLyricsHeaderChipText,
                      autoscrollEnabled ? appStyles.recordingLyricsHeaderChipTextActive : null,
                    ]}
                  >
                    {autoscrollEnabled ? `${autoscrollSpeedMultiplier}×` : "Auto"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={12}
                    color={autoscrollEnabled ? "#ffffff" : "#a89994"}
                  />
                </Pressable>
              ) : null}

              <Pressable
                style={[
                  appStyles.recordingLyricsZoomBtn,
                  zoomOpen ? appStyles.recordingLyricsZoomBtnActive : null,
                ]}
                onPress={() => setZoomOpen((open) => !open)}
                hitSlop={6}
                accessibilityLabel="Adjust lyric size"
              >
                <Ionicons name="text" size={16} color={zoomOpen ? "#824f3f" : "#84736f"} />
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[appStyles.playerLyricsToggleBtn, appStyles.recordingLyricsToggleBtn]}
            onPress={handleToggle}
            hitSlop={6}
          >
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#524440" />
          </Pressable>
        </View>

        {isExpanded && autoscrollMenuOpen ? (
          <>
            <Pressable
              style={appStyles.recordingLyricsMenuOverlay}
              onPress={() => setAutoscrollMenuOpen(false)}
            />
            <View style={appStyles.recordingLyricsMenu}>
              {[null, ...AUTOSCROLL_SPEED_OPTIONS].map((speed) => {
                const isOff = speed === null;
                const isActive = isOff
                  ? !autoscrollEnabled
                  : autoscrollEnabled && Math.abs(speed - autoscrollSpeedMultiplier) < 0.001;
                return (
                  <Pressable
                    key={isOff ? "off" : speed}
                    style={({ pressed }) => [
                      appStyles.recordingLyricsMenuItem,
                      pressed ? { backgroundColor: "#F4F1ED" } : null,
                    ]}
                    onPress={() => {
                      if (isOff) {
                        onToggleAutoscroll?.(false);
                      } else {
                        onSelectAutoscrollSpeedMultiplier?.(speed);
                        if (!autoscrollEnabled) onToggleAutoscroll?.(true);
                      }
                      setAutoscrollMenuOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        appStyles.recordingLyricsMenuItemText,
                        isActive ? appStyles.recordingLyricsMenuItemTextActive : null,
                      ]}
                    >
                      {isOff ? "Off" : `${speed}×`}
                    </Text>
                    {isActive ? <Ionicons name="checkmark" size={15} color="#824f3f" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {isExpanded ? (
          <View style={appStyles.recordingLyricsBodyExpanded}>
            <ScrollView
              ref={scrollRef}
              style={[appStyles.playerLyricsScroll, appStyles.recordingLyricsScroll]}
              contentContainerStyle={appStyles.recordingLyricsScrollContent}
              onLayout={handleLyricsLayout}
              onContentSizeChange={(_, height) => setContentHeight(height)}
              onScroll={handleLyricsScroll}
              onScrollBeginDrag={autoscrollEnabled ? onAutoscrollInterrupted : undefined}
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
          <Text style={styles.kicker}>Lyrics</Text>
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
