import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Canvas, Path, Group, Skia, Rect, RoundedRect } from "@shopify/react-native-skia";
import {
    useSharedValue,
    withDecay,
    useDerivedValue,
    runOnJS,
    SharedValue,
    cancelAnimation,
    useFrameCallback,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import type { PracticeMarker } from "../../types";
import type { SectionBand } from "../../domain/playerSections";
import { colors } from "../../design/tokens";

type Props = {
    waveformPeaks: number[];
    durationMs: number;
    currentTimeMs: number;
    resetKey?: string | number | null;
    sharedCurrentTimeMs?: SharedValue<number>;
    sharedDurationMs?: SharedValue<number>;
    sharedTransportUpdateToken?: SharedValue<number>;
    isPlaying?: boolean;
    sharedIsPlaying?: SharedValue<boolean>;
    playbackRate?: number;
    sharedPlaybackRate?: SharedValue<number>;
    isScrubbing?: boolean;
    onSeek: (timeMs: number) => void;
    onBaseScaleChange?: (scale: number) => void;
    selectedRanges?: { id: string; start: number; end: number; type: "keep" | "remove" }[];
    practiceMarkers?: Pick<PracticeMarker, "id" | "atMs">[];
    sectionBands?: SectionBand[];
    sharedSelectedRangeStartMs?: SharedValue<number>;
    sharedSelectedRangeEndMs?: SharedValue<number>;
    selectedRangeType?: "keep" | "remove";
    theme?: {
        waveColor?: string;
        /** Terracotta fill for the played (behind-the-playhead) portion of the wave. */
        wavePlayedColor?: string;
        rulerColor?: string;
        playheadColor?: string;
        backgroundColor?: string;
    };
    sharedTranslateX?: SharedValue<number>;
    sharedScale?: SharedValue<number>;
    /** Live surface height (animated by AudioReel on expand/compact). When provided,
     *  all vertical geometry is driven off this shared value via Skia transforms, so a
     *  height animation never rebuilds paths or re-renders — it stays on the UI thread. */
    sharedSurfaceHeight?: SharedValue<number>;
    sharedAudioProgress?: SharedValue<number>;
    sharedPauseHoldMs?: SharedValue<number>;
    sharedPauseHoldToken?: SharedValue<number>;
    sharedBaseScale?: SharedValue<number>;
    onScrubStateChange?: (isScrubbing: boolean) => void;
    freezeSelectedRangeWhenFullyVisible?: boolean;
};

type PinMarkerOverlayProps = {
    /** Live surface height; the pin insets a few px top/bottom from it. */
    heightValue: SharedValue<number>;
    markers: Pick<PracticeMarker, "id" | "atMs">[];
    pixelsPerMs: number;
};

type LoopRangeOverlayProps = {
    durationMs: number;
    baseContentWidth: number;
    heightValue: SharedValue<number>;
    scale: SharedValue<number>;
    translateX: SharedValue<number>;
    sharedStartMs: SharedValue<number>;
    sharedEndMs: SharedValue<number>;
    rangeType: "keep" | "remove";
};

const LOOP_HANDLE_WIDTH = 2;
const LOOP_PILL_WIDTH = 14;
const LOOP_PILL_HEIGHT = 28;
const PLAY_START_STATUS_GRACE_MS = 450;
const PLAY_START_CORRECTION_FACTOR = 0.06;
const PLAYING_CORRECTION_FACTOR = 0.16;
const PLAY_START_STALE_FORWARD_MS = 40;
const HARD_FORWARD_SNAP_MS = 650;
const BACKWARD_SNAP_MS = 80;
// Frames the reel keeps showing the scrub target after a seek is committed, before it
// resumes following position reports. Covers the native seek latency (the source is still
// repositioning) so a stale in-flight report can't flash the playhead to the old spot the
// instant the lock releases. ~16 frames (≈260ms) was too short (stale flash); ≈470ms held
// the playhead visibly still after a scrub. ≈330ms is the middle ground.
const SCRUB_SETTLE_FRAMES = 20;
const PAUSE_VISUAL_HOLD_MS = 220;
// How far the frame-rate predictor may coast ahead of the last reported position
// before it stops and waits. Position reports arrive ~every 50ms but the JS thread
// often delivers them late/bursty while the player tree reconciles; if this cap is
// tighter than that jitter the scroll advances then FREEZES at the cap until the next
// report lands — the visible "move, pause, move" stutter. Local playback never
// buffer-stalls, so a generous cap just lets the reel coast smoothly through report
// gaps (a genuine stall still snaps back via HARD_FORWARD/BACKWARD_SNAP).
const PREDICTOR_MAX_LEAD_MS = 300;

function LoopRangeOverlay({
    durationMs,
    baseContentWidth,
    heightValue,
    scale,
    translateX,
    sharedStartMs,
    sharedEndMs,
    rangeType,
}: LoopRangeOverlayProps) {
    // Looper sits above section bands. Terracotta for a keep loop, muted rust for a
    // remove range — both read clearly over a tinted section underneath.
    const fillColor = rangeType === "keep" ? "rgba(184, 125, 107, 0.28)" : "rgba(161, 92, 74, 0.16)";
    const lineColor = rangeType === "keep" ? "rgba(139, 79, 59, 0.95)" : "rgba(161, 92, 74, 0.85)";

    const leftX = useDerivedValue(() => {
        if (durationMs <= 0) return 0;
        const baseX = (sharedStartMs.value / durationMs) * baseContentWidth;
        return baseX * scale.value + translateX.value;
    });

    const rightX = useDerivedValue(() => {
        if (durationMs <= 0) return 0;
        const baseX = (sharedEndMs.value / durationMs) * baseContentWidth;
        return baseX * scale.value + translateX.value;
    });

    const fillWidth = useDerivedValue(() => Math.max(1, rightX.value - leftX.value));
    const rightLineX = useDerivedValue(() => rightX.value - LOOP_HANDLE_WIDTH);
    const leftPillX = useDerivedValue(() => leftX.value - LOOP_PILL_WIDTH / 2 + 1);
    const rightPillX = useDerivedValue(() => rightX.value - LOOP_PILL_WIDTH / 2 - 1);
    const pillY = useDerivedValue(() => heightValue.value / 2 - LOOP_PILL_HEIGHT / 2);

    return (
        <>
            <Rect x={leftX} y={0} width={fillWidth} height={heightValue} color={fillColor} />
            <Rect x={leftX} y={0} width={LOOP_HANDLE_WIDTH} height={heightValue} color={lineColor} />
            <Rect x={rightLineX} y={0} width={LOOP_HANDLE_WIDTH} height={heightValue} color={lineColor} />
            <RoundedRect
                x={leftPillX}
                y={pillY}
                width={LOOP_PILL_WIDTH}
                height={LOOP_PILL_HEIGHT}
                r={LOOP_PILL_WIDTH / 2}
                color={lineColor}
            />
            <RoundedRect
                x={rightPillX}
                y={pillY}
                width={LOOP_PILL_WIDTH}
                height={LOOP_PILL_HEIGHT}
                r={LOOP_PILL_WIDTH / 2}
                color={lineColor}
            />
        </>
    );
}

function SectionBandOverlay({
    heightValue,
    bands,
    pixelsPerMs,
}: {
    heightValue: SharedValue<number>;
    bands: SectionBand[];
    pixelsPerMs: number;
}) {
    return (
        <>
            {bands.map((band) => {
                const x = band.startMs * pixelsPerMs;
                const width = Math.max(0, (band.endMs - band.startMs) * pixelsPerMs);
                if (width <= 0) return null;
                return (
                    <Group key={band.id}>
                        <Rect x={x} y={0} width={width} height={heightValue} color={band.color} />
                        <Rect x={x} y={0} width={width} height={2.5} color={band.railColor} />
                    </Group>
                );
            })}
        </>
    );
}

function PinMarkerOverlay({
    heightValue,
    markers,
    pixelsPerMs,
}: PinMarkerOverlayProps) {
    const pinHeight = useDerivedValue(() => Math.max(0, heightValue.value - 6));
    return (
        <>
            {markers.map((marker) => (
                <Rect
                    key={marker.id}
                    x={marker.atMs * pixelsPerMs}
                    y={3}
                    width={2.5}
                    height={pinHeight}
                    color="#8b4f3b"
                />
            ))}
        </>
    );
}

// Display-only waveform shaping (purely visual — the stored peaks are unchanged).
// Stored amplitudes for typical material cluster in a compressed mid band, which
// reads flat. We expand that window across the full bar height so quiet→loud
// variation is pronounced and detailed. Tune these to taste.
const WAVEFORM_DISPLAY_FLOOR = 0.16; // amplitudes at/below this read as ~silent (bottom contrast)
const WAVEFORM_DISPLAY_GAIN = 1.0; // no ceiling push — >1 saturated loud/mastered material
const WAVEFORM_DISPLAY_MIN = 0.02; // faint hairline so silent passages still register
const WAVEFORM_EDGE_MARGIN_PX = 6; // top/bottom px margin
// Vertical headroom: even the loudest content tops out at this fraction of the
// half-height, so a loud/mastered track reads as a full-but-breathing band rather
// than bars slamming the top and bottom edges.
const WAVEFORM_HEADROOM = 0.84;

export function PlaybackTapeVisualizer({
    waveformPeaks,
    durationMs,
    currentTimeMs,
    resetKey,
    sharedCurrentTimeMs,
    sharedDurationMs,
    sharedTransportUpdateToken,
    isPlaying = false,
    sharedIsPlaying,
    playbackRate = 1,
    sharedPlaybackRate,
    isScrubbing = false,
    onSeek,
    onBaseScaleChange,
    selectedRanges,
    practiceMarkers,
    sectionBands,
    sharedSelectedRangeStartMs,
    sharedSelectedRangeEndMs,
    selectedRangeType = "keep",
    theme,
    sharedTranslateX,
    sharedScale,
    sharedAudioProgress,
    sharedPauseHoldMs,
    sharedPauseHoldToken,
    sharedBaseScale,
    sharedSurfaceHeight,
    onScrubStateChange,
    freezeSelectedRangeWhenFullyVisible = false,
}: Props) {
    const [canvasWidth, setCanvasWidth] = useState(0);
    // Height is a shared value, never React state: expand/compact animates it on the UI
    // thread and drives all vertical geometry through Skia transforms, so no path
    // rebuild or re-render happens per frame. Falls back to onLayout when the parent
    // doesn't supply an animated height.
    const localSurfaceHeight = useSharedValue(0);
    const heightSV = sharedSurfaceHeight || localSurfaceHeight;

    const baseChunkWidth = 3;
    const baseContentWidth = waveformPeaks.length * baseChunkWidth;

    const localScale = useSharedValue(1);
    const scale = sharedScale || localScale;
    const isDragging = useSharedValue(false);
    const startProgress = useSharedValue(0);

    const localTranslateX = useSharedValue(0);
    const translateX = sharedTranslateX || localTranslateX;

    // The exact percentage distance (0 to 1) of the playhead
    const localAudioProgress = useSharedValue(0);
    const audioProgress = sharedAudioProgress || localAudioProgress;
    const targetAudioProgress = useSharedValue(0);
    const localCurrentTimeMs = useSharedValue(currentTimeMs);
    const currentTimeMsValue = sharedCurrentTimeMs || localCurrentTimeMs;
    const localDurationMs = useSharedValue(durationMs);
    const durationMsValue = sharedDurationMs || localDurationMs;
    const localTransportUpdateToken = useSharedValue(0);
    const transportUpdateToken = sharedTransportUpdateToken || localTransportUpdateToken;
    const localIsPlaying = useSharedValue(isPlaying);
    const isPlayingShared = sharedIsPlaying || localIsPlaying;
    const isScrubbingShared = useSharedValue(isScrubbing);
    const localPlaybackRate = useSharedValue(playbackRate);
    const playbackRateShared = sharedPlaybackRate || localPlaybackRate;
    const lastSeenTransportUpdate = useSharedValue(0);
    const reportBaseProgress = useSharedValue(0);
    const reportFrameTimestamp = useSharedValue(0);
    const lastPlayingState = useSharedValue(isPlaying);
    const playingStateChangedAt = useSharedValue(0);
    const scrubSettlingFrames = useSharedValue(0);
    const awaitingPlayStartClock = useSharedValue(false);
    const pauseHoldUntil = useSharedValue(0);
    const pauseHoldProgress = useSharedValue(0);
    const pauseAnchorActive = useSharedValue(false);
    const lastSeenPauseHoldToken = useSharedValue(0);

    const contentWidth = useDerivedValue(() => baseContentWidth * scale.value);

    // The exact pixel distance from the start of the audio to the playhead time
    const targetX = useDerivedValue(() => {
        return audioProgress.value * contentWidth.value;
    });
    // Initial Zoom: Fit the entire waveform fully onto the screen exactly 100% wide
    useEffect(() => {
        if (!sharedCurrentTimeMs) {
            currentTimeMsValue.value = currentTimeMs;
            transportUpdateToken.value += 1;
        }
    }, [currentTimeMs, currentTimeMsValue, sharedCurrentTimeMs, transportUpdateToken]);

    useEffect(() => {
        if (!sharedDurationMs) {
            durationMsValue.value = durationMs;
        }
    }, [durationMs, durationMsValue, sharedDurationMs]);

    useEffect(() => {
        if (!sharedIsPlaying) {
            isPlayingShared.value = isPlaying;
        }
    }, [isPlaying, isPlayingShared, sharedIsPlaying]);

    useEffect(() => {
        if (!sharedPlaybackRate) {
            playbackRateShared.value = playbackRate;
        }
    }, [playbackRate, playbackRateShared, sharedPlaybackRate]);

    useEffect(() => {
        isScrubbingShared.value = isScrubbing;
    }, [isScrubbing, isScrubbingShared]);

    useEffect(() => {
        const resetProgress = durationMs > 0 ? Math.max(0, Math.min(1, currentTimeMs / durationMs)) : 0;
        cancelAnimation(audioProgress);
        audioProgress.value = resetProgress;
        targetAudioProgress.value = resetProgress;
        reportBaseProgress.value = resetProgress;
        reportFrameTimestamp.value = 0;
        lastSeenTransportUpdate.value = transportUpdateToken.value;
        awaitingPlayStartClock.value = false;
        pauseHoldUntil.value = 0;
        pauseHoldProgress.value = resetProgress;
        pauseAnchorActive.value = false;
    }, [resetKey]);

    useEffect(() => {
        if (canvasWidth > 0 && baseContentWidth > 0) {
            const fitScale = canvasWidth / baseContentWidth;
            if (!sharedScale) {
                scale.value = fitScale;
            }
            if (sharedBaseScale) {
                sharedBaseScale.value = fitScale;
            }
            onBaseScaleChange?.(fitScale);
        }
    }, [canvasWidth, baseContentWidth]);

    useFrameCallback((frameInfo) => {
        const duration = durationMsValue.value;
        if (duration <= 0) return;

        const scrubVisualLockActive =
            isDragging.value ||
            isScrubbingShared.value ||
            scrubSettlingFrames.value > 0;
        if (scrubSettlingFrames.value > 0) {
            scrubSettlingFrames.value -= 1;
        }

        if (
            sharedPauseHoldMs &&
            sharedPauseHoldToken &&
            sharedPauseHoldToken.value !== lastSeenPauseHoldToken.value
        ) {
            lastSeenPauseHoldToken.value = sharedPauseHoldToken.value;
            const holdMs = sharedPauseHoldMs.value;
            if (holdMs >= 0) {
                const holdProgress = Math.max(0, Math.min(1, holdMs / duration));
                cancelAnimation(audioProgress);
                audioProgress.value = holdProgress;
                targetAudioProgress.value = holdProgress;
                reportBaseProgress.value = holdProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                pauseHoldProgress.value = holdProgress;
                pauseHoldUntil.value = frameInfo.timestamp + PAUSE_VISUAL_HOLD_MS;
                pauseAnchorActive.value = true;
                awaitingPlayStartClock.value = false;
            }
        }

        if (isPlayingShared.value !== lastPlayingState.value) {
            lastPlayingState.value = isPlayingShared.value;
            playingStateChangedAt.value = frameInfo.timestamp;
            awaitingPlayStartClock.value = isPlayingShared.value;

            if (scrubVisualLockActive) {
                awaitingPlayStartClock.value = isPlayingShared.value;
                pauseHoldUntil.value = 0;
                pauseAnchorActive.value = false;
                reportBaseProgress.value = audioProgress.value;
                reportFrameTimestamp.value = frameInfo.timestamp;
                targetAudioProgress.value = audioProgress.value;
            } else if (!isPlayingShared.value) {
                const heldProgress = audioProgress.value;
                awaitingPlayStartClock.value = false;
                pauseHoldProgress.value = heldProgress;
                pauseHoldUntil.value = frameInfo.timestamp + PAUSE_VISUAL_HOLD_MS;
                pauseAnchorActive.value = true;
                cancelAnimation(audioProgress);
                audioProgress.value = heldProgress;
                reportBaseProgress.value = heldProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                targetAudioProgress.value = heldProgress;
            } else {
                pauseAnchorActive.value = false;
                pauseHoldUntil.value = 0;
                const previousProgress = audioProgress.value;
                const startProgress = previousProgress;
                cancelAnimation(audioProgress);
                audioProgress.value = startProgress;
                reportBaseProgress.value = startProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                targetAudioProgress.value = startProgress;
            }
        }

        if (transportUpdateToken.value !== lastSeenTransportUpdate.value) {
            lastSeenTransportUpdate.value = transportUpdateToken.value;
            if (scrubVisualLockActive) {
                reportBaseProgress.value = audioProgress.value;
                targetAudioProgress.value = audioProgress.value;
                reportFrameTimestamp.value = frameInfo.timestamp;
                return;
            }

            const reportedProgress = Math.max(0, Math.min(1, currentTimeMsValue.value / duration));
            const previousProgress = audioProgress.value;
            const progressDelta = reportedProgress - previousProgress;
            const recentlyStartedPlaying =
                isPlayingShared.value &&
                frameInfo.timestamp - playingStateChangedAt.value < PLAY_START_STATUS_GRACE_MS;
            const stalePlayStartForwardProgress = Math.min(0.08, PLAY_START_STALE_FORWARD_MS / duration);

            if (pauseAnchorActive.value) {
                reportBaseProgress.value = pauseHoldProgress.value;
                targetAudioProgress.value = pauseHoldProgress.value;
                reportFrameTimestamp.value = frameInfo.timestamp;
                return;
            }

            pauseHoldUntil.value = 0;
            pauseAnchorActive.value = false;

            if (awaitingPlayStartClock.value && isPlayingShared.value) {
                const minimumAdvancingProgress = Math.min(0.01, Math.max(0.0005, 12 / duration));
                const resumeAlignmentProgress = Math.max(0.0005, 18 / duration);
                const playStartWaitMs = frameInfo.timestamp - playingStateChangedAt.value;
                const isAtStart = previousProgress <= minimumAdvancingProgress;
                const clockHasAdvanced =
                    isAtStart
                        ? reportedProgress > minimumAdvancingProgress
                        : reportedProgress + resumeAlignmentProgress >= previousProgress;
                const waitTimedOut = playStartWaitMs >= PLAY_START_STATUS_GRACE_MS;

                if (!clockHasAdvanced && !waitTimedOut) {
                    reportBaseProgress.value = previousProgress;
                    targetAudioProgress.value = previousProgress;
                    reportFrameTimestamp.value = frameInfo.timestamp;
                    return;
                }

                awaitingPlayStartClock.value = false;
                const releaseProgress = isAtStart ? reportedProgress : previousProgress;
                cancelAnimation(audioProgress);
                audioProgress.value = releaseProgress;
                targetAudioProgress.value = releaseProgress;
                reportBaseProgress.value = releaseProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                return;
            }

            awaitingPlayStartClock.value = false;
            if (recentlyStartedPlaying && progressDelta > stalePlayStartForwardProgress) {
                reportBaseProgress.value = previousProgress;
                targetAudioProgress.value = previousProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                return;
            }

            const hardForwardSnapProgress = Math.min(0.18, HARD_FORWARD_SNAP_MS / duration);
            const backwardSnapProgress = Math.min(0.02, BACKWARD_SNAP_MS / duration);
            const shouldSnap =
                !isPlayingShared.value ||
                progressDelta < -backwardSnapProgress ||
                (!recentlyStartedPlaying && progressDelta > hardForwardSnapProgress);

            reportFrameTimestamp.value = frameInfo.timestamp;

            if (shouldSnap) {
                cancelAnimation(audioProgress);
                audioProgress.value = reportedProgress;
                targetAudioProgress.value = reportedProgress;
                reportBaseProgress.value = reportedProgress;
            } else {
                const correctionFactor = recentlyStartedPlaying
                    ? PLAY_START_CORRECTION_FACTOR
                    : PLAYING_CORRECTION_FACTOR;
                const correctedProgress = Math.max(
                    0,
                    Math.min(1, previousProgress + progressDelta * correctionFactor)
                );
                reportBaseProgress.value = correctedProgress;
                targetAudioProgress.value = correctedProgress;
            }
        }

        if (
            scrubVisualLockActive ||
            pauseAnchorActive.value ||
            !isPlayingShared.value ||
            awaitingPlayStartClock.value
        ) return;

        const frameDeltaMs = frameInfo.timeSincePreviousFrame ?? 16;
        if (frameDeltaMs <= 0) return;

        const elapsedSinceReport = Math.max(0, frameInfo.timestamp - reportFrameTimestamp.value);
        const reportedProgress = Math.max(0, Math.min(1, currentTimeMsValue.value / duration));
        const maxLeadProgress = PREDICTOR_MAX_LEAD_MS / duration;
        const predictedProgress = Math.min(
            1,
            reportedProgress + maxLeadProgress,
            reportBaseProgress.value + (elapsedSinceReport * playbackRateShared.value) / duration
        );
        const progressError = predictedProgress - audioProgress.value;

        if (Math.abs(progressError) < 0.0002) {
            return;
        }

        if (Math.abs(progressError) > 0.03) {
            audioProgress.value = predictedProgress;
            return;
        }

        audioProgress.value = Math.max(
            0,
            Math.min(1, audioProgress.value + progressError * 0.35)
        );
    });

    // Handle Scrubbing Gestures
    const pan = Gesture.Pan()
        .onStart(() => {
            cancelAnimation(audioProgress);
            isDragging.value = true;
            awaitingPlayStartClock.value = false;
            pauseHoldUntil.value = 0;
            pauseAnchorActive.value = false;
            scrubSettlingFrames.value = 0;
            startProgress.value = audioProgress.value;
            if (onScrubStateChange) runOnJS(onScrubStateChange)(true);
        })
        .onUpdate((event) => {
            const progressChange = -event.translationX / contentWidth.value;
            let newProgress = startProgress.value + progressChange;
            newProgress = Math.max(0, Math.min(1, newProgress));
            audioProgress.value = newProgress;
        })
        .onEnd((event) => {
            const settle = (fromFling: boolean) => {
                "worklet";
                isDragging.value = false;
                scrubSettlingFrames.value = SCRUB_SETTLE_FRAMES;
                let newTime = audioProgress.value * durationMs;
                const edgeGuardMs = fromFling && durationMs > 200 ? 150 : 0;
                const minTime = edgeGuardMs > 0 ? edgeGuardMs : 0;
                const maxTime = edgeGuardMs > 0 ? durationMs - edgeGuardMs : durationMs;
                newTime = Math.max(0, Math.min(maxTime, newTime));
                if (fromFling) {
                    newTime = Math.max(minTime, Math.min(maxTime, newTime));
                }
                runOnJS(onSeek)(newTime);
            };

            const shouldFling = Math.abs(event.velocityX) > 2200 && contentWidth.value > 0;
            if (shouldFling) {
                const progressVelocity = (-event.velocityX / contentWidth.value) * 0.12;
                audioProgress.value = withDecay(
                    {
                        velocity: progressVelocity,
                        clamp: [0, 1],
                        rubberBandEffect: false,
                        deceleration: 0.986,
                    },
                    (finished) => {
                        if (finished) {
                            settle(true);
                        }
                    }
                );
                return;
            }

            settle(false);
        });

    // Dynamic bounded rules
    useDerivedValue(() => {
        if (canvasWidth === 0) return;
        const cw = contentWidth.value;
        const tx = targetX.value;
        const halfScreen = canvasWidth / 2;

        if (
            freezeSelectedRangeWhenFullyVisible &&
            sharedSelectedRangeStartMs &&
            sharedSelectedRangeEndMs &&
            durationMs > 0
        ) {
            const rangeStartX = (sharedSelectedRangeStartMs.value / durationMs) * cw;
            const rangeEndX = (sharedSelectedRangeEndMs.value / durationMs) * cw;
            const rangeWidth = Math.max(0, rangeEndX - rangeStartX);
            const currentMs = currentTimeMsValue.value;
            const isInsideRange =
                sharedSelectedRangeEndMs.value > sharedSelectedRangeStartMs.value &&
                currentMs >= sharedSelectedRangeStartMs.value &&
                currentMs <= sharedSelectedRangeEndMs.value;

            if (isInsideRange && rangeWidth > 0 && rangeWidth <= canvasWidth) {
                const desiredTranslate = canvasWidth / 2 - (rangeStartX + rangeWidth / 2);
                translateX.value = Math.max(Math.min(desiredTranslate, 0), canvasWidth - cw);
                return;
            }
        }

        if (cw <= canvasWidth) {
            translateX.value = 0;
        } else {
            if (tx < halfScreen) {
                translateX.value = 0;
            } else if (tx > cw - halfScreen) {
                translateX.value = canvasWidth - cw;
            } else {
                translateX.value = halfScreen - tx;
            }
        }
    });

    const playheadX = useDerivedValue(() => {
        if (canvasWidth === 0) return 0;
        const cw = contentWidth.value;
        const tx = targetX.value;
        const halfScreen = canvasWidth / 2;

        if (
            freezeSelectedRangeWhenFullyVisible &&
            sharedSelectedRangeStartMs &&
            sharedSelectedRangeEndMs &&
            durationMs > 0
        ) {
            const rangeStartX = (sharedSelectedRangeStartMs.value / durationMs) * cw;
            const rangeEndX = (sharedSelectedRangeEndMs.value / durationMs) * cw;
            const rangeWidth = Math.max(0, rangeEndX - rangeStartX);
            const currentMs = currentTimeMsValue.value;
            const isInsideRange =
                sharedSelectedRangeEndMs.value > sharedSelectedRangeStartMs.value &&
                currentMs >= sharedSelectedRangeStartMs.value &&
                currentMs <= sharedSelectedRangeEndMs.value;

            if (isInsideRange && rangeWidth > 0 && rangeWidth <= canvasWidth) {
                return tx + translateX.value;
            }
        }

        if (cw <= canvasWidth) {
            return tx;
        } else {
            if (tx < halfScreen) {
                return tx;
            } else if (tx > cw - halfScreen) {
                return tx + (canvasWidth - cw);
            } else {
                return halfScreen;
            }
        }
    });

    const playheadRectX = useDerivedValue(() => playheadX.value - 2);

    const translateTransform = useDerivedValue(() => {
        return [{ translateX: translateX.value }];
    });

    const scaleTransform = useDerivedValue(() => {
        return [{ scaleX: scale.value }];
    });

    // Counter-scale stroke widths so lines don't get fat when zoomed
    const waveStrokeWidth = useDerivedValue(() => 2 / scale.value);
    const rulerStrokeWidth = useDerivedValue(() => 1.5 / scale.value);

    // Vertical geometry lives in a normalized space (amplitude -1..1 around y=0) and is
    // mapped to pixels by this transform. A height change is therefore a pure UI-thread
    // transform — it never rebuilds the wave path or re-renders the component.
    const waveVerticalTransform = useDerivedValue(() => {
        const centerY = heightSV.value / 2;
        const waveMaxHeight = Math.max(10, (centerY - WAVEFORM_EDGE_MARGIN_PX) * WAVEFORM_HEADROOM);
        return [{ translateY: centerY }, { scaleY: waveMaxHeight }];
    });
    const baselineY = useDerivedValue(() => heightSV.value / 2 - 0.5);
    // Reveals only the played (behind-the-playhead) portion, in content coordinates so
    // the two-tone split lands exactly under the playhead at any zoom/scroll.
    const playedClip = useDerivedValue(
        () => Skia.XYWHRect(0, 0, audioProgress.value * baseContentWidth, 100000),
        [baseContentWidth]
    );

    const { wavePath, rulerPath } = useMemo(() => {
        const wave = Skia.Path.Make();
        const ruler = Skia.Path.Make();

        // waveformPeaks is ALREADY absolute normalized amplitudes (0..1) from
        // `metersToWaveformPeaks` using absolute dBFS. Do NOT normalize against its own
        // max, or a silent room-tone clip would expand to full-height blocks. We apply a
        // fixed (clip-independent) display expansion so the compressed mid band reads with
        // dynamic range, then emit the wave in NORMALIZED amplitude (-1..1); the pixel
        // height + centering is applied by waveVerticalTransform.
        waveformPeaks.forEach((amp, i) => {
            const x = i * baseChunkWidth;
            const clamped = Math.max(0, Math.min(1, amp));
            const expanded =
                clamped <= WAVEFORM_DISPLAY_FLOOR
                    ? 0
                    : (clamped - WAVEFORM_DISPLAY_FLOOR) / (1 - WAVEFORM_DISPLAY_FLOOR);
            const scaleFactor = Math.min(1, Math.max(WAVEFORM_DISPLAY_MIN, expanded * WAVEFORM_DISPLAY_GAIN));
            wave.moveTo(x, -scaleFactor);
            wave.lineTo(x, scaleFactor);
        });

        // Quiet grid: sparse MAJOR ticks only, along the top edge. The interval is chosen
        // so majors stay >= MIN_MAJOR_VISUAL_PX apart at the fitted (1x) scale — zooming in
        // only spreads them further, so the old length/zoom-dependent picket fence is gone.
        const totalSeconds = durationMs / 1000 || 1;
        const pixelsPerSecondBase = baseContentWidth / totalSeconds;
        const visualPxPerSecond = canvasWidth > 0 ? canvasWidth / totalSeconds : pixelsPerSecondBase;
        const MIN_MAJOR_VISUAL_PX = 54;
        const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
        let tickInterval = intervals[intervals.length - 1];
        for (const iv of intervals) {
            if (iv * visualPxPerSecond >= MIN_MAJOR_VISUAL_PX) {
                tickInterval = iv;
                break;
            }
        }
        const TICK_HEIGHT = 7;
        for (let s = 0; s <= Math.ceil(totalSeconds); s += tickInterval) {
            const x = s * pixelsPerSecondBase;
            ruler.moveTo(x, 0);
            ruler.lineTo(x, TICK_HEIGHT);
        }

        return { wavePath: wave, rulerPath: ruler };
    }, [waveformPeaks, baseChunkWidth, durationMs, canvasWidth, baseContentWidth]);

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        setCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
        // Only used as a fallback when the parent doesn't drive an animated height.
        if (!sharedSurfaceHeight) {
            localSurfaceHeight.value = e.nativeEvent.layout.height;
        }
    };

    const waveColor = theme?.waveColor || "#C7B9AF";
    const wavePlayedColor = theme?.wavePlayedColor || colors.primary;
    const rulerColor = theme?.rulerColor || colors.borderMuted;
    const playheadColor = theme?.playheadColor || "#8b4f3b";
    const backgroundColor = theme?.backgroundColor || "transparent";

    return (
        <View style={[styles.container, { backgroundColor }]} onLayout={onLayout}>
            <GestureDetector gesture={pan}>
                <View style={StyleSheet.absoluteFill}>
                    {canvasWidth > 0 && (
                        <Canvas style={{ flex: 1 }}>
                            {/* Faint center baseline — uniform, so it neither scrolls nor rebuilds. */}
                            <Rect x={0} y={baselineY} width={canvasWidth} height={1} color={rulerColor} opacity={0.4} />
                            <Group transform={translateTransform}>
                                <Group transform={scaleTransform}>
                                    {sectionBands && sectionBands.length > 0 ? (
                                        <SectionBandOverlay
                                            heightValue={heightSV}
                                            bands={sectionBands}
                                            pixelsPerMs={durationMs > 0 ? baseContentWidth / durationMs : 0}
                                        />
                                    ) : null}
                                    <Path
                                        path={rulerPath}
                                        color={rulerColor}
                                        style="stroke"
                                        strokeWidth={rulerStrokeWidth}
                                        opacity={0.7}
                                    />
                                    {/* Two-tone wave: muted ahead-of-playhead, terracotta played (clipped). */}
                                    <Group transform={waveVerticalTransform}>
                                        <Path
                                            path={wavePath}
                                            color={waveColor}
                                            style="stroke"
                                            strokeWidth={waveStrokeWidth}
                                        />
                                    </Group>
                                    <Group clip={playedClip}>
                                        <Group transform={waveVerticalTransform}>
                                            <Path
                                                path={wavePath}
                                                color={wavePlayedColor}
                                                style="stroke"
                                                strokeWidth={waveStrokeWidth}
                                            />
                                        </Group>
                                    </Group>
                                    {practiceMarkers && practiceMarkers.length > 0 ? (
                                        <PinMarkerOverlay
                                            heightValue={heightSV}
                                            markers={practiceMarkers}
                                            pixelsPerMs={durationMs > 0 ? baseContentWidth / durationMs : 0}
                                        />
                                    ) : null}
                                </Group>
                            </Group>
                            {sharedSelectedRangeStartMs && sharedSelectedRangeEndMs && selectedRanges?.[0] ? (
                                <LoopRangeOverlay
                                    durationMs={durationMs}
                                    baseContentWidth={baseContentWidth}
                                    heightValue={heightSV}
                                    scale={scale}
                                    translateX={translateX}
                                    sharedStartMs={sharedSelectedRangeStartMs}
                                    sharedEndMs={sharedSelectedRangeEndMs}
                                    rangeType={selectedRangeType}
                                />
                            ) : null}
                            <Rect
                                x={playheadRectX}
                                y={0}
                                width={4}
                                height={heightSV}
                                color={playheadColor}
                            />
                        </Canvas>
                    )}
                </View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "hidden",
        position: "relative",
    },
});
