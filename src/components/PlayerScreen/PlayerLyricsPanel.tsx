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
  const previewText = useMemo(() => {
    const firstMeaningfulLine = text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    return firstMeaningfulLine ?? "";
  }, [text]);

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

  if (isRecordingVariant) {
    return (
      <View style={appStyles.recordingLyricsPanel}>
        <View style={[appStyles.playerLyricsHeader, appStyles.recordingLyricsHeader]}>
          <View style={appStyles.playerLyricsHeaderText}>
            <Text style={[appStyles.playerLyricsTitle, appStyles.recordingLyricsTitle]}>Lyrics</Text>
            <Text style={[appStyles.playerLyricsMeta, appStyles.recordingLyricsMeta]}>
              {versionLabel} • {updatedAtLabel}
            </Text>
            {autoscrollLabel && canAutoscroll ? (
              <Pressable
                style={appStyles.recordingLyricsAutoscrollBtn}
                onPress={handleAutoscrollToggle}
              >
                <Text style={[appStyles.playerLyricsSyncMeta, appStyles.recordingLyricsSyncMeta]}>
                  {autoscrollLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            style={[appStyles.playerLyricsToggleBtn, appStyles.recordingLyricsToggleBtn]}
            onPress={handleToggle}
            hitSlop={6}
          >
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#4b5563" />
          </Pressable>
        </View>

        {isExpanded ? (
          <View style={[appStyles.playerLyricsBody, appStyles.recordingLyricsBody]}>
            {canAutoscroll ? (
              <View style={appStyles.recordingLyricsSpeedRow}>
                {AUTOSCROLL_SPEED_OPTIONS.map((speed) => {
                  const isActive = Math.abs(speed - autoscrollSpeedMultiplier) < 0.001;
                  return (
                    <Pressable
                      key={speed}
                      style={[
                        appStyles.recordingLyricsSpeedChip,
                        isActive ? appStyles.recordingLyricsSpeedChipActive : null,
                      ]}
                      onPress={() => onSelectAutoscrollSpeedMultiplier?.(speed)}
                    >
                      <Text
                        style={[
                          appStyles.recordingLyricsSpeedChipText,
                          isActive ? appStyles.recordingLyricsSpeedChipTextActive : null,
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
              style={[appStyles.playerLyricsScroll, appStyles.recordingLyricsScroll]}
              onLayout={handleLyricsLayout}
              onContentSizeChange={(_, height) => setContentHeight(height)}
              onScroll={handleLyricsScroll}
              onScrollBeginDrag={autoscrollEnabled ? onAutoscrollInterrupted : undefined}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              persistentScrollbar
              scrollEventThrottle={16}
            >
              <Text style={[appStyles.playerLyricsText, appStyles.recordingLyricsText]}>{text}</Text>
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Lyrics</Text>
          <Text style={styles.meta}>
            {versionLabel} • {updatedAtLabel}
          </Text>
          {!isExpanded && previewText ? (
            <Text style={styles.summary} numberOfLines={2}>
              {previewText}
            </Text>
          ) : null}
          {isExpanded && autoscrollLabel && autoscrollState?.mode !== "off" ? (
            <Text style={styles.autoscrollMeta}>{autoscrollLabel}</Text>
          ) : null}
        </View>
        <Pressable style={styles.toggle} onPress={handleToggle} hitSlop={6}>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#4b5563" />
        </Pressable>
      </View>

      {isExpanded ? (
        <View style={styles.body}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            onLayout={handleLyricsLayout}
            onContentSizeChange={(_, height) => setContentHeight(height)}
            onScroll={handleLyricsScroll}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            <Text style={styles.text}>{text}</Text>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#f6f7f9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e3e6eb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#111827",
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: "#6b7280",
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
    color: "#374151",
  },
  autoscrollMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: "#40658c",
  },
  toggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dde3ea",
  },
  body: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3e6eb",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scroll: {
    maxHeight: 176,
  },
  text: {
    fontSize: 16,
    lineHeight: 26,
    color: "#111827",
  },
});
