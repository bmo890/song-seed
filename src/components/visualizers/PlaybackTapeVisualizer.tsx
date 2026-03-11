import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Canvas, Path, Group, Skia, Rect } from "@shopify/react-native-skia";
import Animated, {
    useSharedValue,
    withTiming,
    withDecay,
    useDerivedValue,
    useAnimatedStyle,
    runOnJS,
    SharedValue,
    cancelAnimation,
    Easing,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

type Props = {
    waveformPeaks: number[];
    durationMs: number;
    currentTimeMs: number;
    isScrubbing?: boolean;
    onSeek: (timeMs: number) => void;
    onBaseScaleChange?: (scale: number) => void;
    selectedRanges?: { id: string; start: number; end: number; type: "keep" | "remove" }[];
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
};

export function PlaybackTapeVisualizer({
    waveformPeaks,
    durationMs,
    currentTimeMs,
    isScrubbing = false,
    onSeek,
    onBaseScaleChange,
    selectedRanges,
    theme,
    sharedTranslateX,
    sharedScale,
    sharedAudioProgress,
    sharedBaseScale,
    onScrubStateChange,
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

    const contentWidth = useDerivedValue(() => baseContentWidth * scale.value);

    // The exact pixel distance from the start of the audio to the playhead time
    const targetX = useDerivedValue(() => {
        return audioProgress.value * contentWidth.value;
    });
    // Initial Zoom: Fit the entire waveform fully onto the screen exactly 100% wide
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

    // Sync the UI translation when the external `currentTimeMs` player changes
    useEffect(() => {
        if (canvasWidth === 0 || isScrubbing) return;
        const progress = durationMs > 0 ? Math.min(1, currentTimeMs / durationMs) : 0;

        audioProgress.value = withTiming(progress, {
            duration: 72,
            easing: Easing.linear,
        });
    }, [currentTimeMs, canvasWidth, durationMs, isScrubbing]);

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

    const playheadStyle = useAnimatedStyle(() => {
        return { transform: [{ translateX: playheadX.value }] };
    });

    // Skia UI thread translation
    const transform = useDerivedValue(() => {
        return [{ translateX: translateX.value }, { scaleX: scale.value }];
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
            const scaleFactor = Math.max(0.02, Math.pow(Math.min(1, Math.max(0, amp)), 0.8));
            const h = scaleFactor * waveMaxHeight;

            wave.moveTo(x, centerY - h);
            wave.lineTo(x, centerY + h);
        });

        // Add enough ticks to cover an arbitrarily wide un-zoomed area
        const totalBaseSeconds = Math.ceil(durationMs / 1000);

        for (let s = 0; s <= totalBaseSeconds; s++) {
            const x = s * (baseContentWidth / (durationMs / 1000 || 1));
            const isMajor = s % 5 === 0;

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
                            <Group transform={transform}>
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
                            </Group>
                        </Canvas>
                    )}
                </View>
            </GestureDetector>

            {canvasWidth > 0 && (
                <Animated.View
                    style={[
                        styles.playhead,
                        playheadStyle,
                        { backgroundColor: playheadColor },
                    ]}
                />
            )}
        </View>
    );
}

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
        left: 0,
        width: 4,
        marginLeft: -2,
        zIndex: 10,
        // opacity: 0.96,
        pointerEvents: "none",
    },
});
