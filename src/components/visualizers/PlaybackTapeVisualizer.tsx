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

type Props = {
    waveformPeaks: number[];
    durationMs: number;
    currentTimeMs: number;
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
    sharedSelectedRangeStartMs?: SharedValue<number>;
    sharedSelectedRangeEndMs?: SharedValue<number>;
    selectedRangeType?: "keep" | "remove";
    theme?: {
        waveColor?: string;
        rulerColor?: string;
        playheadColor?: string;
        backgroundColor?: string;
    };
    sharedTranslateX?: SharedValue<number>;
    sharedScale?: SharedValue<number>;
    sharedAudioProgress?: SharedValue<number>;
    sharedBaseScale?: SharedValue<number>;
    onScrubStateChange?: (isScrubbing: boolean) => void;
    freezeSelectedRangeWhenFullyVisible?: boolean;
};

type PinMarkerOverlayProps = {
    canvasHeight: number;
    markers: Pick<PracticeMarker, "id" | "atMs">[];
    pixelsPerMs: number;
};

type LoopRangeOverlayProps = {
    durationMs: number;
    baseContentWidth: number;
    canvasHeight: number;
    scale: SharedValue<number>;
    translateX: SharedValue<number>;
    sharedStartMs: SharedValue<number>;
    sharedEndMs: SharedValue<number>;
    rangeType: "keep" | "remove";
};

const LOOP_HANDLE_WIDTH = 2;
const LOOP_PILL_WIDTH = 14;
const LOOP_PILL_HEIGHT = 28;

function LoopRangeOverlay({
    durationMs,
    baseContentWidth,
    canvasHeight,
    scale,
    translateX,
    sharedStartMs,
    sharedEndMs,
    rangeType,
}: LoopRangeOverlayProps) {
    const fillColor = rangeType === "keep" ? "rgba(96, 165, 250, 0.18)" : "rgba(239, 68, 68, 0.15)";
    const lineColor = rangeType === "keep" ? "rgba(59, 130, 246, 0.9)" : "rgba(239, 68, 68, 0.8)";

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

    return (
        <>
            <Rect x={leftX} y={0} width={fillWidth} height={canvasHeight} color={fillColor} />
            <Rect x={leftX} y={0} width={LOOP_HANDLE_WIDTH} height={canvasHeight} color={lineColor} />
            <Rect x={rightLineX} y={0} width={LOOP_HANDLE_WIDTH} height={canvasHeight} color={lineColor} />
            <RoundedRect
                x={leftPillX}
                y={canvasHeight / 2 - LOOP_PILL_HEIGHT / 2}
                width={LOOP_PILL_WIDTH}
                height={LOOP_PILL_HEIGHT}
                r={LOOP_PILL_WIDTH / 2}
                color={lineColor}
            />
            <RoundedRect
                x={rightPillX}
                y={canvasHeight / 2 - LOOP_PILL_HEIGHT / 2}
                width={LOOP_PILL_WIDTH}
                height={LOOP_PILL_HEIGHT}
                r={LOOP_PILL_WIDTH / 2}
                color={lineColor}
            />
        </>
    );
}

function PinMarkerOverlay({
    canvasHeight,
    markers,
    pixelsPerMs,
}: PinMarkerOverlayProps) {
    return (
        <>
            {markers.map((marker) => (
                <Rect
                    key={marker.id}
                    x={marker.atMs * pixelsPerMs}
                    y={10}
                    width={2}
                    height={Math.max(0, canvasHeight - 20)}
                    color="rgba(202, 138, 4, 0.78)"
                />
            ))}
        </>
    );
}

export function PlaybackTapeVisualizer({
    waveformPeaks,
    durationMs,
    currentTimeMs,
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
    sharedSelectedRangeStartMs,
    sharedSelectedRangeEndMs,
    selectedRangeType = "keep",
    theme,
    sharedTranslateX,
    sharedScale,
    sharedAudioProgress,
    sharedBaseScale,
    onScrubStateChange,
    freezeSelectedRangeWhenFullyVisible = false,
}: Props) {
    const [canvasWidth, setCanvasWidth] = useState(0);
    const [canvasHeight, setCanvasHeight] = useState(0);

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

        if (isPlayingShared.value !== lastPlayingState.value) {
            lastPlayingState.value = isPlayingShared.value;
            reportBaseProgress.value = audioProgress.value;
            reportFrameTimestamp.value = frameInfo.timestamp;
        }

        if (transportUpdateToken.value !== lastSeenTransportUpdate.value) {
            lastSeenTransportUpdate.value = transportUpdateToken.value;
            const reportedProgress = Math.max(0, Math.min(1, currentTimeMsValue.value / duration));
            const previousProgress = audioProgress.value;
            const shouldSnap =
                isScrubbingShared.value ||
                !isPlayingShared.value ||
                reportedProgress < previousProgress - 0.002 ||
                Math.abs(reportedProgress - previousProgress) > 0.04;

            reportBaseProgress.value = reportedProgress;
            reportFrameTimestamp.value = frameInfo.timestamp;

            if (shouldSnap) {
                cancelAnimation(audioProgress);
                audioProgress.value = reportedProgress;
                targetAudioProgress.value = reportedProgress;
            }
        }

        if (isScrubbingShared.value || !isPlayingShared.value) return;

        const frameDeltaMs = frameInfo.timeSincePreviousFrame ?? 16;
        if (frameDeltaMs <= 0) return;

        const elapsedSinceReport = Math.max(0, frameInfo.timestamp - reportFrameTimestamp.value);
        const predictedProgress = Math.min(
            1,
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
    const { wavePath, rulerPath, centerLinePath } = useMemo(() => {
        const wave = Skia.Path.Make();
        const ruler = Skia.Path.Make();
        const centerLine = Skia.Path.Make();

        const centerY = canvasHeight > 0 ? canvasHeight / 2 : 70;
        const waveMaxHeight = Math.max(10, centerY - 15);

        // waveformPeaks is ALREADY an array of absolute normalized amplitudes from 0 to 1
        // (calculated meticulously by `metersToWaveformPeaks` using absolute dBFS).
        // Do NOT normalize this against its own max! If we do, a completely silent
        // room tone clip will mathematically expand to max volume blocks.

        waveformPeaks.forEach((amp, i) => {
            const x = i * baseChunkWidth;
            const scaleFactor = Math.max(0, Math.min(1, amp));
            const h = scaleFactor * waveMaxHeight;

            wave.moveTo(x, centerY - h);
            wave.lineTo(x, centerY + h);
        });

        // Add ruler ticks, thinning out when density is too high
        const totalSeconds = durationMs / 1000 || 1;
        const pixelsPerSecond = baseContentWidth / totalSeconds;
        const MIN_TICK_PX = 4; // minimum pixels between ticks before we skip

        // Choose a tick interval that keeps ticks at least MIN_TICK_PX apart
        // Candidate intervals: 1s, 2s, 5s, 10s, 15s, 30s, 60s, 120s, 300s...
        const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
        let tickInterval = 1;
        for (const iv of intervals) {
            if (iv * pixelsPerSecond >= MIN_TICK_PX) {
                tickInterval = iv;
                break;
            }
            tickInterval = iv;
        }
        // Major tick every 5 tick-intervals (or every interval if already sparse)
        const majorEvery = tickInterval >= 10 ? 1 : 5;

        for (let s = 0; s <= Math.ceil(totalSeconds); s += tickInterval) {
            const x = s * pixelsPerSecond;
            const isMajor = s % (tickInterval * majorEvery) === 0;

            const tickHeight = isMajor ? 12 : 6;
            ruler.moveTo(x, 0);
            ruler.lineTo(x, tickHeight);

            if (canvasHeight > 0) {
                ruler.moveTo(x, canvasHeight);
                ruler.lineTo(x, canvasHeight - tickHeight);
            }
        }

        centerLine.moveTo(0, centerY);
        centerLine.lineTo(baseContentWidth, centerY);

        return { wavePath: wave, rulerPath: ruler, centerLinePath: centerLine };
    }, [waveformPeaks, baseChunkWidth, durationMs, canvasHeight, canvasWidth, baseContentWidth]);

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        const nextHeight = e.nativeEvent.layout.height;
        setCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
        setCanvasHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const waveColor = theme?.waveColor || "#64748b";
    const rulerColor = theme?.rulerColor || "#9ca3af";
    const playheadColor = theme?.playheadColor || "#ef4444";
    const backgroundColor = theme?.backgroundColor || "transparent";

    return (
        <View style={[styles.container, { backgroundColor }]} onLayout={onLayout}>
            <GestureDetector gesture={pan}>
                <View style={StyleSheet.absoluteFill}>
                    {canvasWidth > 0 && canvasHeight > 0 && (
                        <Canvas style={{ flex: 1 }}>
                            <Group transform={translateTransform}>
                                <Group transform={scaleTransform}>
                                    <Path
                                        path={centerLinePath}
                                        color={rulerColor}
                                        style="stroke"
                                        strokeWidth={1}
                                        opacity={0.3}
                                    />
                                    <Path
                                        path={rulerPath}
                                        color={rulerColor}
                                        style="stroke"
                                        strokeWidth={rulerStrokeWidth}
                                    />
                                    <Path
                                        path={wavePath}
                                        color={waveColor}
                                        style="stroke"
                                        strokeWidth={waveStrokeWidth}
                                    />
                                    {practiceMarkers && practiceMarkers.length > 0 ? (
                                        <PinMarkerOverlay
                                            canvasHeight={canvasHeight}
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
                                    canvasHeight={canvasHeight}
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
                                height={canvasHeight}
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
