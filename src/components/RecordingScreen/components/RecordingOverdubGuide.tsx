import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { collapseIn, collapseOut } from "../../../design/motion";
import { colors, text as textTokens } from "../../../design/tokens";
import { AudioReel } from "../../common/AudioReel";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { Press } from "../../common/Press";
import { OverdubLayerLanes, type OverdubLayerLane } from "../../common/OverdubLayerLanes";
import { useTransportClock } from "../../../hooks/useTransportClock";
import { buildSectionBands } from "../../../domain/playerSections";
import { fmtDuration } from "../../../utils";
import { styles } from "../../../styles";
import type { ClipSection, PracticeMarker } from "../../../types";
import { useTranslation } from "react-i18next";

/**
 * The upper register of the overdub page: the master you're playing along to.
 *
 * It is NOT a card. Two registers read top-to-bottom on one sheet of paper — the
 * guide up here, your take on the tape below — and a white surface with its own
 * radius made the guide look like a widget pasted onto the recorder instead of
 * the other half of the same instrument.
 *
 * It also stops repeating the page. The clock, the state and the title all live
 * once, in the page header and the status row; this used to print its own copy
 * of all three within 100pt of theirs. What's left is the one thing only this
 * register can say: that it is the GUIDE, and how far through it you are.
 *
 * The same smooth scrolling reel as the player — section bands, pins, and
 * existing layer lanes ride the waveform — with the playhead at the guide's REAL
 * position (a punch take opens mid-song, exactly where the layer will sit).
 * Before the take it is the performer's (founder, 2026-10-22): drag it to choose
 * where the layer starts, Listen to hear that spot. From arming on it is read-only:
 * seeking the guide mid-take would break the measured alignment.
 */

export type GuideCue = {
  /** True until a take is armed: the guide can be dragged and listened to. */
  movable: boolean;
  listening: boolean;
  /** Where the layer starts on the guide (bar-snapped); 0 = from the top. */
  startMs: number;
  onMove: (ms: number) => void | Promise<void>;
  onToggleListen: () => void | Promise<void>;
};

type RecordingOverdubGuideProps = {
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  waveformPeaks?: number[];
  sections?: ClipSection[];
  practiceMarkers?: PracticeMarker[];
  /** Already-recorded layers on this master, drawn as slim lanes under the reel. */
  layerLanes?: OverdubLayerLane[];
  /** The guide plays from the phone's own speaker, straight into the mic: say once,
   *  quietly, that headphones keep it out of the take. Hidden once recording. */
  showHeadphonesHint?: boolean;
  cue?: GuideCue;
};

const GUIDE_FOLLOW_WINDOW_MS = 20000;

function noop() {}

export function RecordingOverdubGuide({
  durationMs,
  positionMs,
  isPlaying,
  waveformPeaks,
  sections,
  practiceMarkers,
  layerLanes,
  showHeadphonesHint,
  cue,
}: RecordingOverdubGuideProps) {
  const { t } = useTranslation();
  // Interpolates the 250ms-interval position updates on the UI thread — the tape glides
  // instead of stepping.
  const transportClock = useTransportClock({
    positionMs,
    durationMs,
    isPlaying,
    playbackRate: 1,
  });

  // Stopping a listen parks the tape back on the start. The tape swallows reports for
  // a moment after any pause (it covers the player's corrective seek), so the return
  // is handed over the same way the player hands its pause position: as a pause hold.
  const sharedPauseHoldMs = useSharedValue(-1);
  const sharedPauseHoldToken = useSharedValue(0);
  const wasListeningRef = useRef(false);
  useEffect(() => {
    const listening = !!cue?.listening;
    if (wasListeningRef.current && !listening && cue?.movable) {
      sharedPauseHoldMs.value = cue.startMs;
      sharedPauseHoldToken.value += 1;
    }
    wasListeningRef.current = listening;
  }, [cue?.listening, cue?.movable, cue?.startMs, sharedPauseHoldMs, sharedPauseHoldToken]);
  const sectionBands = useMemo(
    () => buildSectionBands(sections ?? [], durationMs),
    [sections, durationMs]
  );

  return (
    <View style={styles.recordingGuideCard}>
      <View style={styles.recordingGuideHeader}>
        <Text style={styles.recordingGuideEyebrow}>{t("recording.guide")}</Text>
        {/* How far through the master you are — the one fact the page's own clock
            (which counts YOUR take) cannot tell you. */}
        <Text style={styles.recordingGuideTimingText}>
          {fmtDuration(positionMs)} / {fmtDuration(durationMs)}
        </Text>
      </View>

      <View pointerEvents={cue?.movable ? "auto" : "none"}>
        <AudioReel
          waveformPeaks={waveformPeaks ?? []}
          durationMs={durationMs}
          currentTimeMs={0}
          sharedCurrentTimeMs={transportClock.sharedCurrentTimeMs}
          sharedDurationMs={transportClock.sharedDurationMs}
          sharedTransportUpdateToken={transportClock.sharedUpdateToken}
          isPlaying={isPlaying}
          sharedIsPlaying={transportClock.sharedIsPlaying}
          playbackRate={1}
          sharedPlaybackRate={transportClock.sharedPlaybackRate}
          sharedPauseHoldMs={sharedPauseHoldMs}
          sharedPauseHoldToken={sharedPauseHoldToken}
          chrome="light"
          showTransportControls={false}
          showExpandToggle={false}
          showZoomControls={false}
          showTimingRow={false}
          defaultExpanded={false}
          surfaceRadius={4}
          timelineHorizontalPadding={0}
          collapsedHeightOverride={84}
          showMinimapMode="never"
          initialZoomMultiple={durationMs > 0 ? durationMs / GUIDE_FOLLOW_WINDOW_MS : undefined}
          sectionBands={sectionBands}
          practiceMarkers={practiceMarkers}
          renderBelowSurface={({ pixelsPerMs, timelineTranslateX, timelineScale }) =>
            layerLanes && layerLanes.length > 0 ? (
              <OverdubLayerLanes
                lanes={layerLanes}
                pixelsPerMs={pixelsPerMs}
                timelineTranslateX={timelineTranslateX}
                timelineScale={timelineScale}
              />
            ) : null
          }
          renderOverlay={({ pixelsPerMs, timelineTranslateX, timelineScale }) =>
            cue && cue.startMs > 0 ? (
              <StartFlag
                startMs={cue.startMs}
                pixelsPerMs={pixelsPerMs}
                timelineTranslateX={timelineTranslateX}
                timelineScale={timelineScale}
              />
            ) : null
          }
          onSeek={cue?.movable ? cue.onMove : noop}
          onTogglePlay={noop}
          onSeekToStart={noop}
          onSeekToEnd={noop}
        />
      </View>
      {cue?.movable ? (
        <Animated.View entering={collapseIn} exiting={collapseOut} style={cueStyles.row}>
          <InkKey
            // Haptics vocabulary: `tap` — a control toggles.
            haptic="tap"
            tone={cue.listening ? "active" : "idle"}
            label={cue.listening ? t("recording.stopListening") : t("recording.listen")}
            glyph={
              <Ionicons
                name={cue.listening ? "stop" : "play"}
                size={14}
                color={inkKeyColor(cue.listening ? "active" : "idle")}
              />
            }
            onPress={() => void cue.onToggleListen()}
            accessibilityLabel={cue.listening ? t("recording.stopListening") : t("recording.listenFromStart")}
          />
          {cue.startMs > 0 ? (
            <View style={cueStyles.start}>
              <Text style={cueStyles.startText}>
                {t("recording.startsAt", { time: fmtDuration(cue.startMs) })}
              </Text>
              <Press
                feel="glyph"
                // Haptics vocabulary: `tap` — an acknowledged press.
                haptic="tap"
                onPress={() => void cue.onMove(0)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("recording.fromTop")}
              >
                <Text style={cueStyles.link}>{t("recording.fromTop")}</Text>
              </Press>
            </View>
          ) : (
            <Text style={cueStyles.hint}>{t("recording.dragToStart")}</Text>
          )}
        </Animated.View>
      ) : null}
      {showHeadphonesHint ? (
        <Animated.View entering={collapseIn} exiting={collapseOut} style={hintStyles.row}>
          <Ionicons name="headset-outline" size={15} color={colors.textSecondary} />
          <Text style={hintStyles.text}>{t("recording.headphonesHint")}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Where the layer starts, riding the tape: while you listen the playhead leaves it,
 *  and while the lead-in runs the playhead walks up to it. */
function StartFlag({
  startMs,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
}: {
  startMs: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
}) {
  const placement = useAnimatedStyle(() => ({
    transform: [{ translateX: startMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value }],
  }));
  return <Animated.View pointerEvents="none" style={[cueStyles.flag, placement]} />;
}

const cueStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  start: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  startText: {
    ...textTokens.supporting,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  link: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  hint: {
    ...textTokens.supporting,
    color: colors.textMuted,
  },
  flag: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: colors.textStrong,
    opacity: 0.55,
  },
});

const hintStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  text: {
    ...textTokens.supporting,
    flexShrink: 1,
  },
});
