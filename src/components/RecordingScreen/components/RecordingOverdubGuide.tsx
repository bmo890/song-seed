import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { collapseIn, collapseOut } from "../../../design/motion";
import { colors, text as textTokens } from "../../../design/tokens";
import { AudioReel } from "../../common/AudioReel";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { Press } from "../../common/Press";
import { OverdubLayerLanes, type OverdubLayerLane } from "../../common/OverdubLayerLanes";
import { TakeRegister } from "./TakeRegister";
import { TakePinKey } from "./RecordingMeta";
import { useTransportClock } from "../../../hooks/useTransportClock";
import { buildSectionBands } from "../../../domain/playerSections";
import { fmtDuration } from "../../../utils";
import { styles } from "../../../styles";
import { haptic } from "../../../design/haptics";
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
 *
 * One reel (founder, 2026-10-22): the take is written into the reel's lower register
 * (TakeRegister), under the song, on the same timeline. There used to be a second tape
 * below the clock; with a few layers the guide grew and squeezed it until its centre
 * line sat on the dock, and the two scrolled as unrelated pictures. The registers now
 * share whatever height the page has, so nothing can be pushed off the bottom.
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
  /** The take written under the song. */
  take: {
    active: boolean;
    isRecording: boolean;
    isPaused: boolean;
    isCountIn: boolean;
    /** Pins dropped in this take, capture ms. */
    pins: number[];
    onAddPin?: () => void;
  };
  /** Lyrics open beside the take: a fixed, slim reel instead of filling the page. */
  compact?: boolean;
  /** The height this register may use: the page's visible height less everything
   *  else on it. Measured from the viewport, never from the reel itself (a box that
   *  holds the reel grows with it, and the reel then grew to its cap). */
  availableHeight?: number;
};

const GUIDE_FOLLOW_WINDOW_MS = 20000;
/** How the reel's height splits between the song and the take. */
const SONG_SHARE = 0.55;
const SONG_HEIGHT = { min: 64, max: 210, compact: 56 } as const;
const TAKE_HEIGHT = { min: 64, max: 190, compact: 48 } as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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
  take,
  compact = false,
  availableHeight = 0,
}: RecordingOverdubGuideProps) {
  const { t } = useTranslation();
  // The reel takes the height the page has left once the lanes and the rows under
  // it are laid out; each part reports its own height, so none of it is guessed.
  const [lanesHeight, setLanesHeight] = useState(0);
  // With the words open the page belongs to them: the layers already on the song fold
  // to one "Layers · n" line, a tap away (founder, 2026-10-26: several layers squeezed
  // the lyrics).
  const [lanesOpen, setLanesOpen] = useState(false);
  const lanesFolded = compact && !lanesOpen;
  const [tailHeight, setTailHeight] = useState(0);
  const measure = (set: (value: number) => void) => (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    set(next);
  };
  const reelRoom = availableHeight - lanesHeight - tailHeight - GUIDE_HEADER_HEIGHT - GUIDE_GAPS;
  const songHeight = compact
    ? SONG_HEIGHT.compact
    : clamp(Math.round(reelRoom * SONG_SHARE), SONG_HEIGHT.min, SONG_HEIGHT.max);
  const takeHeight = compact
    ? TAKE_HEIGHT.compact
    : clamp(reelRoom - songHeight, TAKE_HEIGHT.min, TAKE_HEIGHT.max);
  // Interpolates the 250ms-interval position updates on the UI thread — the tape glides
  // instead of stepping.
  const transportClock = useTransportClock({
    positionMs,
    durationMs,
    isPlaying,
    playbackRate: 1,
  });

  // While the guide is stopped, the position it reports is where the tape rests:
  // after a listen, a redo, a discard or a moved start. The tape swallows reports
  // for a moment after any pause (it covers the player's corrective seek), so
  // the resting place is handed over the way the player hands its own: as a
  // pause hold.
  const sharedPauseHoldMs = useSharedValue(-1);
  const sharedPauseHoldToken = useSharedValue(0);
  useEffect(() => {
    if (isPlaying) return;
    sharedPauseHoldMs.value = positionMs;
    sharedPauseHoldToken.value += 1;
  }, [isPlaying, positionMs, sharedPauseHoldMs, sharedPauseHoldToken]);

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
          // Square: the take register continues the surface below it.
          surfaceRadius={0}
          timelineHorizontalPadding={0}
          collapsedHeightOverride={songHeight}
          showMinimapMode="never"
          initialZoomMultiple={durationMs > 0 ? durationMs / GUIDE_FOLLOW_WINDOW_MS : undefined}
          sectionBands={sectionBands}
          practiceMarkers={practiceMarkers}
          // The take register and the lanes are the same tape: a drag anywhere on them
          // moves the start, as one on the song does.
          belowSurfaceScrubs
          renderBelowSurface={({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress }) => (
            <>
              <TakeRegister
                height={takeHeight}
                pixelsPerMs={pixelsPerMs}
                timelineTranslateX={timelineTranslateX}
                timelineScale={timelineScale}
                sharedProgress={sharedAudioProgress}
                durationMs={durationMs}
                startMs={cue?.startMs ?? 0}
                active={take.active}
                recording={take.isRecording && !take.isPaused}
                pins={take.pins}
              >
                <TakePinKey
                  isRecording={take.isRecording}
                  isPaused={take.isPaused}
                  isCountIn={take.isCountIn}
                  pinCount={take.pins.length}
                  onAddPin={take.onAddPin}
                />
              </TakeRegister>
              {layerLanes && layerLanes.length > 0 ? (
                <View onLayout={measure(setLanesHeight)}>
                  <OverdubLayerLanes
                    lanes={layerLanes}
                    pixelsPerMs={pixelsPerMs}
                    timelineTranslateX={timelineTranslateX}
                    timelineScale={timelineScale}
                    collapsed={lanesFolded}
                    onToggleCollapsed={
                      compact
                        ? () => {
                            haptic.tap(); // Vocabulary: tap = a control toggles.
                            setLanesOpen((open) => !open);
                          }
                        : undefined
                    }
                  />
                </View>
              ) : null}
            </>
          )}
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
      <View onLayout={measure(setTailHeight)}>
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
    </View>
  );
}

/** The GUIDE · time line above the reel. */
const GUIDE_HEADER_HEIGHT = 18;
/** The card's two gaps: header → reel → the rows under it. */
const GUIDE_GAPS = 12;

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
