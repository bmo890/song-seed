import React, { useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Canvas, Path, Rect as SkiaRect, Skia } from "@shopify/react-native-skia";
import Animated, { useAnimatedStyle, SharedValue, useDerivedValue, runOnJS, useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type Props = {
    waveformPeaks: number[];
    durationMs: number;
    currentTimeMs: number;
    timelineTranslateX: SharedValue<number>;
    timelineScale: SharedValue<number>;
    mainCanvasWidth: number;
    selectedRanges?: { id: string; start: number; end: number; type: "keep" | "remove" }[];
    onSeek: (timeMs: number) => void;
    onScrubStateChange?: (scrubbing: boolean) => void;
    chrome?: "dark" | "light";
    interactive?: boolean;
};

export function MinimapVisualizer({
    waveformPeaks,
    durationMs,
    currentTimeMs,
    timelineTranslateX,
    timelineScale,
    mainCanvasWidth,
    selectedRanges,
    onSeek,
    onScrubStateChange,
    chrome = "dark",
    interactive = true,
}: Props) {
    const [containerWidth, setContainerWidth] = useState(0);
    const containerHeight = 40; // Fixed height minimap

    const baseContentWidth = waveformPeaks.length * 3;

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    // Downsample peaks so each bar is at least MIN_BAR_PX wide
    const MIN_BAR_PX = 2.5;

    const { wavePath, barCount } = useMemo(() => {
        if (containerWidth === 0 || waveformPeaks.length === 0) return { wavePath: null, barCount: 0 };

        const maxBars = Math.floor(containerWidth / MIN_BAR_PX);
        const numBars = Math.min(waveformPeaks.length, maxBars);
        const chunkWidth = containerWidth / numBars;
        const peaksPerBar = waveformPeaks.length / numBars;

        const wave = Skia.Path.Make();
        const centerY = containerHeight / 2;
        const waveMaxHeight = containerHeight / 2 - 2;

        for (let i = 0; i < numBars; i++) {
            const startIdx = Math.floor(i * peaksPerBar);
            const endIdx = Math.min(Math.floor((i + 1) * peaksPerBar), waveformPeaks.length);

            // Take the max amplitude in this bucket for a representative peak
            let maxAmp = 0;
            for (let j = startIdx; j < endIdx; j++) {
                if (waveformPeaks[j] > maxAmp) maxAmp = waveformPeaks[j];
            }

            const x = i * chunkWidth + chunkWidth / 2;
            const scaleFactor = Math.max(0.02, Math.pow(Math.min(1, Math.max(0, maxAmp)), 0.8));
            const h = scaleFactor * waveMaxHeight;

            wave.moveTo(x, centerY - h);
            wave.lineTo(x, centerY + h);
        }
        return { wavePath: wave, barCount: numBars };
    }, [waveformPeaks, containerWidth]);

    const palette = chrome === "light"
        ? {
            backgroundColor: "#eef0f4",
            waveColor: "#64748b",
            playheadColor: "#d95b56",
            windowFill: "rgba(59, 130, 246, 0.14)",
            windowBorder: "rgba(59, 130, 246, 0.48)",
            keepFill: "rgba(96, 165, 250, 0.28)",
            removeFill: "rgba(239, 68, 68, 0.28)",
        }
        : {
            backgroundColor: "#1e293b",
            waveColor: "#475569",
            playheadColor: "#ef4444",
            windowFill: "rgba(59, 130, 246, 0.2)",
            windowBorder: "rgba(59, 130, 246, 0.5)",
            keepFill: "rgba(96, 165, 250, 0.32)",
            removeFill: "rgba(239, 68, 68, 0.4)",
        };

    const rangeRects = useMemo(() => {
        if (!selectedRanges || durationMs === 0 || containerWidth === 0) return [];
        return selectedRanges.map(r => {
            const left = (r.start / durationMs) * containerWidth;
            const right = (r.end / durationMs) * containerWidth;
            const w = Math.max(1, right - left);
            return {
                id: r.id,
                x: left,
                w,
                fill: r.type === "keep" ? palette.keepFill : palette.removeFill,
            };
        });
    }, [selectedRanges, durationMs, containerWidth, palette.keepFill, palette.removeFill]);

    const isDragging = useSharedValue(false);
    const audioProgress = useSharedValue(0);

    React.useEffect(() => {
        if (containerWidth === 0 || isDragging.value || durationMs === 0) return;
        audioProgress.value = currentTimeMs / durationMs;
    }, [currentTimeMs, containerWidth, durationMs, isDragging]);

    const playheadStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: audioProgress.value * containerWidth }]
        };
    });

    // Calculate the interactive overlay bounds
    const overlayProps = useDerivedValue(() => {
        if (containerWidth === 0 || mainCanvasWidth === 0 || baseContentWidth === 0) return;
        const cw = baseContentWidth * timelineScale.value;
        const visibleRatio = Math.min(1, mainCanvasWidth / cw);
        const w = visibleRatio * containerWidth;

        // timelineTranslateX is negative or 0
        const scrollRatio = -timelineTranslateX.value / cw;
        const x = scrollRatio * containerWidth;

        return { x, w };
    });

    const overlayStyle = useAnimatedStyle(() => {
        const props = overlayProps.value;
        if (!props) return { opacity: 0 };
        return {
            transform: [{ translateX: props.x }],
            width: props.w,
            backgroundColor: palette.windowFill,
            borderColor: palette.windowBorder,
            borderWidth: 1,
            borderRadius: 4,
        };
    }, [palette.windowBorder, palette.windowFill]);

    const pan = Gesture.Pan()
        .activeOffsetX([-5, 5])
        .onStart(() => {
            isDragging.value = true;
            if (onScrubStateChange) runOnJS(onScrubStateChange)(true);
        })
        .onUpdate((e) => {
            const ratio = Math.max(0, Math.min(1, e.x / containerWidth));
            audioProgress.value = ratio;
        })
        .onEnd(() => {
            isDragging.value = false;
            runOnJS(onSeek)(audioProgress.value * durationMs);
        });

    const tap = Gesture.Tap()
        .onEnd((e) => {
            const ratio = Math.max(0, Math.min(1, e.x / containerWidth));
            runOnJS(onSeek)(ratio * durationMs);
        });

    const composed = Gesture.Exclusive(pan, tap);

    return (
        <View style={[styles.container, { backgroundColor: palette.backgroundColor }]} onLayout={onLayout}>
            {containerWidth > 0 && wavePath && (
                <GestureDetector gesture={interactive ? composed : Gesture.Tap()}>
                    <View style={StyleSheet.absoluteFill}>
                        <Canvas style={{ flex: 1 }}>
                            {rangeRects.map(r => (
                                <SkiaRect key={r.id} x={r.x} y={0} width={r.w} height={containerHeight} color={r.fill} />
                            ))}
                            <Path path={wavePath} color={palette.waveColor} style="stroke" strokeWidth={Math.max(1, containerWidth / barCount * 0.7)} strokeCap="round" />
                        </Canvas>

                        {/* Playhead indicator */}
                        <Animated.View style={[styles.playhead, playheadStyle, { backgroundColor: palette.playheadColor }]} />

                        {/* Visible window indicator */}
                        <Animated.View style={[styles.windowOverlay, overlayStyle]} pointerEvents="none" />
                    </View>
                </GestureDetector>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 40,
        backgroundColor: "#1e293b",
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
    },
    playhead: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: "#ef4444",
    },
    windowOverlay: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
    }
});
