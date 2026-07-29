import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import {
    useDerivedValue,
    useFrameCallback,
    useSharedValue,
} from "react-native-reanimated";
import { DataPoint } from "@siteed/audio-studio";
import { advanceTracker } from "../../domain/motionTracking";
import { colors } from "../../design/tokens";

type Props = {
    dataPoints: DataPoint[];
    intervalMs?: number; // Usually 40
    theme?: {
        waveColor?: string;
        rulerColor?: string;
        playheadColor?: string;
        backgroundColor?: string;
    };
};

const CANDLE_WIDTH = 2;
const CANDLE_SPACE = 1;
const CHUNK_WIDTH = CANDLE_WIDTH + CANDLE_SPACE;
const NOISE_FLOOR_DB = -55;
/** Seconds of empty ruler drawn past the newest audio, so ticks never pop in at the edge. */
const RULER_LOOKAHEAD_SECONDS = 4;

// The tape rides an α-β tracking filter (position + its own velocity estimate) locked to
// CAPTURE TIME — the end of the newest complete audio segment — rather than to the take's
// elapsed clock. Two problems went away with that change:
//
//  - The gap. Elapsed time and captured audio come from different places: the timer runs
//    on a wall clock while segments arrive a buffer late, so the drawn wave always sat a
//    delivery-latency's worth to the LEFT of the playhead. (A count-in take hid it: the
//    head-trim commit re-zeroed both clocks at once and cancelled the offset. Recording
//    without the metronome had nothing to cancel it — which is exactly where it showed.)
//    Anchored to the audio, the newest candle lands ON the playhead by construction.
//
//  - The stutter. Scroll position was a React prop, so every frame of movement cost a
//    re-render and a full Skia path rebuild on the JS thread. Now the path is built only
//    when audio arrives (~25×/s) and the scroll is a UI-thread transform, so the tape
//    keeps gliding even when JS is busy with the audio stream or the metronome.
const TRACKING_TAU_MS = 110;
/** Ceiling on the velocity estimate (ms of tape per ms of clock). */
const MAX_TRACKING_VELOCITY = 2;
/** Past this, it isn't drift — it's a reset (new take, head trim). Jump. */
const TRACKING_RESYNC_MS = 1200;
/** Runaway guard: never coast more than this far past the audio we actually hold. */
const MAX_COAST_MS = 250;

function LiveTapeVisualizerImpl({
    dataPoints,
    intervalMs = 50,
    theme,
}: Props) {
    const [canvasWidth, setCanvasWidth] = useState(0);
    const [canvasHeight, setCanvasHeight] = useState(0);

    const pixelsPerMs = CHUNK_WIDTH / Math.max(1, intervalMs);
    const playheadX = canvasWidth > 0 ? canvasWidth / 2 : 0;

    // Where the audio ends right now, in capture ms. The tape chases this.
    const latestDataMs = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].endTime ?? 0 : 0;
    const targetDataMs = useSharedValue(0);
    const tapeNowMs = useSharedValue(0);
    const tapeVelocity = useSharedValue(0);

    useEffect(() => {
        targetDataMs.value = latestDataMs;
    }, [latestDataMs, targetDataMs]);

    useFrameCallback((frameInfo) => {
        const frameDeltaMs = frameInfo.timeSincePreviousFrame ?? 16;
        if (frameDeltaMs <= 0) return;

        const target = targetDataMs.value;
        const parked = tapeVelocity.value === 0;
        const gap = target - tapeNowMs.value;
        // Parked between takes: nothing to integrate, so don't.
        if (parked && Math.abs(gap) < 0.05) return;
        // First audio of a take: the tape runs at real time from the first frame rather
        // than spending a third of a second winding up to speed.
        const startVelocity = parked && gap > 0 && gap < TRACKING_RESYNC_MS ? 1 : tapeVelocity.value;

        const tracked = advanceTracker(
            tapeNowMs.value,
            startVelocity,
            target,
            frameDeltaMs,
            {
                tauMs: TRACKING_TAU_MS,
                maxVelocity: MAX_TRACKING_VELOCITY,
                // Past this it isn't drift — it's a reset (new take, head trim). Jump,
                // and start the new take from a standstill rather than at speed.
                resyncDistance: TRACKING_RESYNC_MS,
                resyncVelocity: 0,
            }
        );
        tapeVelocity.value = tracked.velocity;
        // Runaway guard: never coast far past the audio we actually hold.
        tapeNowMs.value = Math.min(tracked.position, target + MAX_COAST_MS);
    });

    // Content coordinates: x = capture ms × px/ms. The whole tape is one transform, so the
    // wave, the ruler and everything else that ever lands here move as one rigid picture.
    const tapeTransform = useDerivedValue(() => [
        { translateX: playheadX - tapeNowMs.value * pixelsPerMs },
    ]);

    const { wavePath, rulerPath } = useMemo(() => {
        const wave = Skia.Path.Make();
        const ruler = Skia.Path.Make();

        const centerY = canvasHeight > 0 ? canvasHeight / 2 : 70;
        const waveMaxHeight = Math.max(10, centerY - 15);

        dataPoints.forEach((point) => {
            const x = (point.endTime ?? 0) * pixelsPerMs;
            const db = Number.isFinite(point.dB)
                ? point.dB
                : 20 * Math.log10(Math.max(0.00001, point.rms || point.amplitude || 0));

            const normalized = Math.min(
                1,
                Math.max(0, (db - NOISE_FLOOR_DB) / Math.abs(NOISE_FLOOR_DB))
            );
            const scale = point.silent ? 0.01 : Math.max(0.015, Math.pow(normalized, 1.35));
            const h = scale * waveMaxHeight;

            wave.moveTo(x, centerY - h);
            wave.lineTo(x, centerY + h);
        });

        const firstPointMs = dataPoints.length > 0 ? dataPoints[0].startTime ?? 0 : 0;
        const lastPointMs = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].endTime ?? 0 : 0;
        const startSecond = Math.max(0, Math.floor(firstPointMs / 1000) - 1);
        const endSecond = Math.ceil(lastPointMs / 1000) + RULER_LOOKAHEAD_SECONDS;

        for (let second = startSecond; second <= endSecond; second += 1) {
            const x = second * 1000 * pixelsPerMs;
            const tickHeight = second % 5 === 0 ? 12 : 6;
            ruler.moveTo(x, 0);
            ruler.lineTo(x, tickHeight);

            if (canvasHeight > 0) {
                ruler.moveTo(x, canvasHeight);
                ruler.lineTo(x, canvasHeight - tickHeight);
            }
        }

        return { wavePath: wave, rulerPath: ruler };
    }, [canvasHeight, dataPoints, pixelsPerMs]);

    const centerLinePath = useMemo(() => {
        const centerLine = Skia.Path.Make();
        const centerY = canvasHeight > 0 ? canvasHeight / 2 : 70;
        centerLine.moveTo(0, centerY);
        centerLine.lineTo(canvasWidth, centerY);
        return centerLine;
    }, [canvasHeight, canvasWidth]);

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        const nextHeight = e.nativeEvent.layout.height;
        setCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
        setCanvasHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const waveColor = theme?.waveColor || colors.textMuted;
    const rulerColor = theme?.rulerColor || colors.borderMuted;
    const playheadColor = theme?.playheadColor || "#B5483A";
    const backgroundColor = theme?.backgroundColor || "transparent";

    return (
        <View style={[styles.container, { backgroundColor }]} onLayout={onLayout}>
            {canvasWidth > 0 && canvasHeight > 0 && (
                <Canvas style={{ flex: 1 }}>
                    {/* Uniform centre line — canvas space, so it never scrolls or rebuilds. */}
                    <Path
                        path={centerLinePath}
                        color={rulerColor}
                        style="stroke"
                        strokeWidth={1}
                        opacity={0.3}
                    />
                    <Group transform={tapeTransform}>
                        <Path
                            path={rulerPath}
                            color={rulerColor}
                            style="stroke"
                            strokeWidth={1.5}
                        />
                        <Path
                            path={wavePath}
                            color={waveColor}
                            style="stroke"
                            strokeWidth={CANDLE_WIDTH}
                        />
                    </Group>
                </Canvas>
            )}

            {/* Static Playhead perfectly centered */}
            {canvasWidth > 0 && (
                <View
                    style={[
                        styles.playhead,
                        { left: canvasWidth / 2, backgroundColor: playheadColor },
                    ]}
                />
            )}
        </View>
    );
}

/** Memoized: the recording screen re-renders on its own clock, and the tape has no
 *  reason to reconcile unless new audio (or a new size/theme) actually arrived. */
export const LiveTapeVisualizer = React.memo(LiveTapeVisualizerImpl);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "hidden",
        position: "relative",
    },
    playhead: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 2,
        marginLeft: -1,
        zIndex: 10,
    },
});
