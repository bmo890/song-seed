import React, { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { LyricsAutoscrollState } from "../../types";

type Props = {
  text: string;
  versionLabel: string;
  updatedAtLabel: string;
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

const AUTOSCROLL_SPEED_OPTIONS = [1, 1.25, 1.5, 2];
const BASE_MS_PER_LINE = 2600;
const MIN_AUTOSCROLL_DURATION_MS = 12000;

function getAutoscrollLabel(state?: LyricsAutoscrollState) {
  if (!state) return null;
  if (state.mode === "follow") return "Autoscroll on";
  if (state.mode === "manual") return "Autoscroll paused";
  return "Autoscroll off";
}

export function PlayerLyricsPanel({
  text,
  versionLabel,
  updatedAtLabel,
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
  const autoscrollLabel = getAutoscrollLabel(autoscrollState);
  const isRecordingVariant = variant === "recording";
  const isExpanded = expanded ?? uncontrolledExpanded;
  const scrollRef = useRef<ScrollView>(null);
  const currentOffsetRef = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const canAutoscroll = isExpanded && contentHeight > viewportHeight + 12;
  const lineCount = text.split("\n").filter((line) => line.trim().length > 0).length || 1;
  const maxOffset = Math.max(0, contentHeight - viewportHeight);
  const baseDurationMs = Math.max(MIN_AUTOSCROLL_DURATION_MS, lineCount * BASE_MS_PER_LINE);
  const effectiveDurationMs = baseDurationMs / autoscrollSpeedMultiplier;
  const autoscrollSpeedPxPerSecond = maxOffset > 0 ? maxOffset / (effectiveDurationMs / 1000) : 0;

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
        onToggleAutoscroll?.(false);
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
    onToggleAutoscroll,
    viewportHeight,
  ]);

  return (
    <View style={isRecordingVariant ? styles.recordingLyricsPanel : styles.card}>
      <View style={[styles.playerLyricsHeader, isRecordingVariant ? styles.recordingLyricsHeader : null]}>
        <View style={styles.playerLyricsHeaderText}>
          <Text style={[styles.playerLyricsTitle, isRecordingVariant ? styles.recordingLyricsTitle : null]}>Lyrics</Text>
          <Text style={[styles.playerLyricsMeta, isRecordingVariant ? styles.recordingLyricsMeta : null]}>
            {versionLabel} • {updatedAtLabel}
          </Text>
          {autoscrollLabel && (!isRecordingVariant || canAutoscroll) ? (
            <Pressable
              style={isRecordingVariant && canAutoscroll ? styles.recordingLyricsAutoscrollBtn : null}
              onPress={isRecordingVariant && canAutoscroll ? handleAutoscrollToggle : undefined}
            >
              <Text style={[styles.playerLyricsSyncMeta, isRecordingVariant ? styles.recordingLyricsSyncMeta : null]}>
                {autoscrollLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={[styles.playerLyricsToggleBtn, isRecordingVariant ? styles.recordingLyricsToggleBtn : null]}
          onPress={handleToggle}
          hitSlop={6}
        >
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#4b5563" />
        </Pressable>
      </View>

      {isExpanded ? (
        <View style={[styles.playerLyricsBody, isRecordingVariant ? styles.recordingLyricsBody : null]}>
          {isRecordingVariant && canAutoscroll ? (
            <View style={styles.recordingLyricsSpeedRow}>
              {AUTOSCROLL_SPEED_OPTIONS.map((speed) => {
                const isActive = Math.abs(speed - autoscrollSpeedMultiplier) < 0.001;
                return (
                  <Pressable
                    key={speed}
                    style={[
                      styles.recordingLyricsSpeedChip,
                      isActive ? styles.recordingLyricsSpeedChipActive : null,
                    ]}
                    onPress={() => onSelectAutoscrollSpeedMultiplier?.(speed)}
                  >
                    <Text
                      style={[
                        styles.recordingLyricsSpeedChipText,
                        isActive ? styles.recordingLyricsSpeedChipTextActive : null,
                      ]}
                    >
                      {speed.toFixed(speed % 1 === 0 ? 1 : 2)}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={[styles.playerLyricsScroll, isRecordingVariant ? styles.recordingLyricsScroll : null]}
            onLayout={handleLyricsLayout}
            onContentSizeChange={(_, height) => setContentHeight(height)}
            onScroll={handleLyricsScroll}
            onScrollBeginDrag={isRecordingVariant && autoscrollEnabled ? onAutoscrollInterrupted : undefined}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            persistentScrollbar
            scrollEventThrottle={16}
          >
            <Text style={[styles.playerLyricsText, isRecordingVariant ? styles.recordingLyricsText : null]}>{text}</Text>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
