import React, { useState } from "react";
import { View, StyleSheet, LayoutChangeEvent, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, SharedValue, useAnimatedReaction, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Polygon } from "react-native-svg";

type Region = {
    id: string;
    start: number;
    end: number;
    type: "keep" | "remove";
};

type Props = {
    durationMs: number;
    pixelsPerMs: number;
    regions: Region[];
    onRegionChange: (id: string, start: number, end: number) => void;
    sharedTranslateX: SharedValue<number>;
    sharedScale?: SharedValue<number>;
    sharedAudioProgress: SharedValue<number>;
    onScrubStateChange?: (scrubbing: boolean) => void;
    onSeek?: (time: number) => void;
};

const HANDLE_WIDTH = 20;

function TimeRegionNode({
    region,
    index,
    durationMs,
    pixelsPerMs,
    targetStartMs,
    targetEndMs,
    minBoundMs,
    maxBoundMs,
    onRegionChange,
    sharedTranslateX,
    scale,
    sharedAudioProgress,
    onScrubStateChange,
    onSeek
}: {
    region: Region,
    index: number,
    durationMs: number,
    pixelsPerMs: number,
    targetStartMs: number,
    targetEndMs: number,
    minBoundMs: number,
    maxBoundMs: number,
    onRegionChange: (id: string, start: number, end: number) => void,
    sharedTranslateX: SharedValue<number>,
    scale: SharedValue<number>,
    sharedAudioProgress: SharedValue<number>,
    onScrubStateChange?: (scrubbing: boolean) => void,
    onSeek?: (time: number) => void
}) {
    const isDragging = useSharedValue(false);
    const isBoxDragging = useSharedValue(false);

    // We use isolated shared values for physics, synced back to React state when gestures end
    const leftTime = useSharedValue(region.start);
    const rightTime = useSharedValue(region.end);

    // Listen for external React state changes (like appending un-focused regions)
    useAnimatedReaction(
        () => ({ start: targetStartMs, end: targetEndMs }),
        ({ start, end }) => {
            if (!isDragging.value) {
                leftTime.value = start;
                rightTime.value = end;
            }
        },
        [targetStartMs, targetEndMs]
    );

    const enforceLimits = () => {
        "worklet";
        // Floor constraints
        if (leftTime.value < minBoundMs) leftTime.value = minBoundMs;
        if (rightTime.value > maxBoundMs) rightTime.value = maxBoundMs;
        // Self intersection constraints
        if (rightTime.value < leftTime.value + 1000) rightTime.value = leftTime.value + 1000;
        if (leftTime.value > rightTime.value - 1000) leftTime.value = rightTime.value - 1000;
    };

    const commitChanges = () => {
        "worklet";
        runOnJS(onRegionChange)(region.id, Math.round(leftTime.value), Math.round(rightTime.value));
    };

    const leftPan = Gesture.Pan()
        .onStart(() => {
            isDragging.value = true;
            if (onScrubStateChange) runOnJS(onScrubStateChange)(true);
        })
        .onChange((e) => {
            if (pixelsPerMs > 0 && scale.value > 0) {
                leftTime.value += e.changeX / (pixelsPerMs * scale.value);
                enforceLimits();
            }
        })
        .onEnd(() => {
            isDragging.value = false;
            commitChanges();
            if (onScrubStateChange) runOnJS(onScrubStateChange)(false);
        });

    const rightPan = Gesture.Pan()
        .onStart(() => {
            isDragging.value = true;
            if (onScrubStateChange) runOnJS(onScrubStateChange)(true);
        })
        .onChange((e) => {
            if (pixelsPerMs > 0 && scale.value > 0) {
                rightTime.value += e.changeX / (pixelsPerMs * scale.value);
                enforceLimits();
            }
        })
        .onEnd(() => {
            isDragging.value = false;
            commitChanges();
            if (onScrubStateChange) runOnJS(onScrubStateChange)(false);
        });

    const boxStartLeft = useSharedValue(0);
    const boxStartRight = useSharedValue(0);
    const scrubStartProgress = useSharedValue(0);

    const moveSelectionPan = Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart(() => {
            isBoxDragging.value = true;
            isDragging.value = true;
            boxStartLeft.value = leftTime.value;
            boxStartRight.value = rightTime.value;
            if (onScrubStateChange) runOnJS(onScrubStateChange)(true);
            runOnJS(Haptics.selectionAsync)();
        })
        .onChange((e) => {
            if (!isBoxDragging.value || pixelsPerMs <= 0 || scale.value <= 0) return;

            const deltaMs = e.translationX / (pixelsPerMs * scale.value);
            const blockWidth = boxStartRight.value - boxStartLeft.value;

            let projectedLeft = boxStartLeft.value + deltaMs;
            let projectedRight = boxStartRight.value + deltaMs;

            if (projectedLeft < minBoundMs) {
                projectedLeft = minBoundMs;
                projectedRight = minBoundMs + blockWidth;
            }
            if (projectedRight > maxBoundMs) {
                projectedRight = maxBoundMs;
                projectedLeft = maxBoundMs - blockWidth;
            }

            leftTime.value = projectedLeft;
            rightTime.value = projectedRight;
            enforceLimits();
        })
        .onEnd(() => {
            if (isBoxDragging.value) {
                isBoxDragging.value = false;
                commitChanges();
                if (onScrubStateChange) runOnJS(onScrubStateChange)(false);
            }
            isDragging.value = false;
        });

    const scrubPan = Gesture.Pan()
        .onStart(() => {
            scrubStartProgress.value = sharedAudioProgress.value;
            if (onScrubStateChange) runOnJS(onScrubStateChange)(true);
        })
        .onChange((e) => {
            const cw = durationMs * pixelsPerMs * scale.value;
            if (cw <= 0) return;

            const progressChange = -e.translationX / cw;
            const newProgress = Math.max(0, Math.min(1, scrubStartProgress.value + progressChange));
            sharedAudioProgress.value = newProgress;
        })
        .onEnd(() => {
            if (onSeek) runOnJS(onSeek)(sharedAudioProgress.value * durationMs);
            if (onScrubStateChange) runOnJS(onScrubStateChange)(false);
        });

    const combinedGesture = Gesture.Race(moveSelectionPan, scrubPan);

    const leftStyle = useAnimatedStyle(() => {
        const originalX = leftTime.value * pixelsPerMs * scale.value;
        return { transform: [{ translateX: originalX + sharedTranslateX.value }] };
    });

    const rightStyle = useAnimatedStyle(() => {
        const originalX = rightTime.value * pixelsPerMs * scale.value;
        return { transform: [{ translateX: originalX + sharedTranslateX.value - HANDLE_WIDTH }] };
    });

    const trackStyle = useAnimatedStyle(() => {
        const originalX = leftTime.value * pixelsPerMs * scale.value;
        const width = (rightTime.value - leftTime.value) * pixelsPerMs * scale.value;
        return {
            transform: [
                { translateX: originalX + sharedTranslateX.value + 1 },
                { scaleY: withSpring(isBoxDragging.value ? 1.05 : 1) }
            ],
            width: Math.max(0, width - 2),
            opacity: withSpring(isBoxDragging.value ? 1 : 0.7),
        };
    });

    const isKeep = region.type === "keep";
    const bgTrackColor = isKeep ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
    const highlightColor = isKeep ? "rgba(16, 185, 129, 0.8)" : "rgba(239, 68, 68, 0.8)";

    return (
        <React.Fragment>
            <GestureDetector gesture={combinedGesture}>
                <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: bgTrackColor, justifyContent: "center", alignItems: "center" }, trackStyle]}>
                    <Text style={{ fontSize: 40, fontWeight: "900", color: isKeep ? "rgba(16, 185, 129, 0.8)" : "rgba(239, 68, 68, 0.8)" }}>
                        {index + 1}
                    </Text>
                </Animated.View>
            </GestureDetector>

            <GestureDetector gesture={leftPan}>
                <Animated.View style={[styles.handleContainer, styles.handleContainerBottom, leftStyle]}>
                    <View style={[styles.handleInner, styles.handleInnerLeft, { backgroundColor: highlightColor }]} />
                    <Svg height="14" width="16" viewBox="0 0 16 14" style={styles.handleTriangleLeft}>
                        <Polygon points="0,0 0,14 16,14" fill={highlightColor} />
                    </Svg>
                </Animated.View>
            </GestureDetector>

            <GestureDetector gesture={rightPan}>
                <Animated.View style={[styles.handleContainer, styles.handleContainerBottom, rightStyle]}>
                    <View style={[styles.handleInner, styles.handleInnerRight, { backgroundColor: highlightColor }]} />
                    <Svg height="14" width="16" viewBox="0 0 16 14" style={styles.handleTriangleRight}>
                        <Polygon points="16,0 16,14 0,14" fill={highlightColor} />
                    </Svg>
                </Animated.View>
            </GestureDetector>
        </React.Fragment>
    );
}

export function MultiTimeRangeSelector({ durationMs, pixelsPerMs, regions, onRegionChange, sharedTranslateX, sharedScale, sharedAudioProgress, onScrubStateChange, onSeek }: Props) {
    const [containerWidth, setContainerWidth] = useState(0);

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    const fallbackScale = useSharedValue(1);
    const scale = sharedScale || fallbackScale;

    // Pre-sort regions so we can calculate boundaries natively
    const sortedRegions = [...regions].sort((a, b) => a.start - b.start);

    return (
        <View style={styles.container} onLayout={onLayout} pointerEvents="box-none">
            {containerWidth > 0 && sortedRegions.map((region, index) => {
                const prevRegion = sortedRegions[index - 1];
                const nextRegion = sortedRegions[index + 1];

                const minBoundMs = prevRegion ? prevRegion.end : 0;
                const maxBoundMs = nextRegion ? nextRegion.start : durationMs;

                return (
                    <TimeRegionNode
                        key={region.id}
                        region={region}
                        index={index}
                        durationMs={durationMs}
                        pixelsPerMs={pixelsPerMs}
                        targetStartMs={region.start}
                        targetEndMs={region.end}
                        minBoundMs={minBoundMs}
                        maxBoundMs={maxBoundMs}
                        onRegionChange={onRegionChange}
                        sharedTranslateX={sharedTranslateX}
                        scale={scale}
                        sharedAudioProgress={sharedAudioProgress}
                        onScrubStateChange={onScrubStateChange}
                        onSeek={onSeek}
                    />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: "relative",
    },
    handleContainer: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: HANDLE_WIDTH,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    handleContainerBottom: {
        justifyContent: "flex-end",
    },
    handleInner: {
        width: 2,
        height: "100%",
        borderRadius: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
        position: "absolute",
        top: 0,
        bottom: 0,
    },
    handleInnerLeft: {
        left: 0,
    },
    handleInnerRight: {
        right: 0,
    },
    handleTriangleLeft: {
        marginLeft: 0,
        marginBottom: -1,
    },
    handleTriangleRight: {
        marginLeft: 4,
        marginBottom: -1,
    }
});
