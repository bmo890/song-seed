import React, { useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
    SharedValue,
    useAnimatedReaction,
    withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

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
    sharedPreviewStartMs?: SharedValue<number>;
    sharedPreviewEndMs?: SharedValue<number>;
    onScrubStateChange?: (scrubbing: boolean) => void;
    onSeek?: (time: number) => void | Promise<void>;
    showVisuals?: boolean;
};

const HANDLE_WIDTH = 24;
const GRAB_PILL_WIDTH = 14;
const GRAB_PILL_HEIGHT = 28;
const BASE_MIN_LOOP_DURATION_MS = 1000;
const INTERACTIVE_MIN_LOOP_WIDTH_PX = 44;
const HANDLE_TOUCH_TARGET_X = 14;
const HANDLE_TOUCH_TARGET_Y = 16;

function TimeRegionNode({
    region,
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
    sharedPreviewStartMs,
    sharedPreviewEndMs,
    onScrubStateChange,
    onSeek,
    showVisuals = true,
}: {
    region: Region;
    durationMs: number;
    pixelsPerMs: number;
    targetStartMs: number;
    targetEndMs: number;
    minBoundMs: number;
    maxBoundMs: number;
    onRegionChange: (id: string, start: number, end: number) => void;
    sharedTranslateX: SharedValue<number>;
    scale: SharedValue<number>;
    sharedAudioProgress: SharedValue<number>;
    sharedPreviewStartMs?: SharedValue<number>;
    sharedPreviewEndMs?: SharedValue<number>;
    onScrubStateChange?: (scrubbing: boolean) => void;
    onSeek?: (time: number) => void | Promise<void>;
    showVisuals?: boolean;
}) {
    const isDragging = useSharedValue(false);
    const isBoxDragging = useSharedValue(false);
    const isLeftActive = useSharedValue(false);
    const isRightActive = useSharedValue(false);

    const leftTime = useSharedValue(region.start);
    const rightTime = useSharedValue(region.end);

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

    useAnimatedReaction(
        () => ({ start: leftTime.value, end: rightTime.value }),
        ({ start, end }) => {
            if (sharedPreviewStartMs) {
                sharedPreviewStartMs.value = start;
            }
            if (sharedPreviewEndMs) {
                sharedPreviewEndMs.value = end;
            }
        },
        [sharedPreviewEndMs, sharedPreviewStartMs]
    );

    const getMinimumLoopDurationMs = () => {
        "worklet";
        return pixelsPerMs > 0 && scale.value > 0
            ? Math.max(BASE_MIN_LOOP_DURATION_MS, INTERACTIVE_MIN_LOOP_WIDTH_PX / (pixelsPerMs * scale.value))
            : BASE_MIN_LOOP_DURATION_MS;
    };

    const enforceLimits = () => {
        "worklet";
        const minimumLoopDurationMs = getMinimumLoopDurationMs();

        if (leftTime.value < minBoundMs) {
            leftTime.value = minBoundMs;
        }
        if (rightTime.value > maxBoundMs) {
            rightTime.value = maxBoundMs;
        }
        if (rightTime.value < leftTime.value + minimumLoopDurationMs) {
            rightTime.value = leftTime.value + minimumLoopDurationMs;
        }
        if (leftTime.value > rightTime.value - minimumLoopDurationMs) {
            leftTime.value = rightTime.value - minimumLoopDurationMs;
        }
        if (rightTime.value > maxBoundMs) {
            rightTime.value = maxBoundMs;
            leftTime.value = Math.max(minBoundMs, rightTime.value - minimumLoopDurationMs);
        }
        if (leftTime.value < minBoundMs) {
            leftTime.value = minBoundMs;
            rightTime.value = Math.min(maxBoundMs, leftTime.value + minimumLoopDurationMs);
        }
    };

    const commitChanges = () => {
        "worklet";
        runOnJS(onRegionChange)(region.id, Math.round(leftTime.value), Math.round(rightTime.value));
    };

    const leftPan = Gesture.Pan()
        .hitSlop({
            left: HANDLE_TOUCH_TARGET_X,
            right: HANDLE_TOUCH_TARGET_X,
            top: HANDLE_TOUCH_TARGET_Y,
            bottom: HANDLE_TOUCH_TARGET_Y,
        })
        .activateAfterLongPress(300)
        .onStart(() => {
            isDragging.value = true;
            isLeftActive.value = true;
            if (onScrubStateChange) {
                runOnJS(onScrubStateChange)(true);
            }
            runOnJS(Haptics.selectionAsync)();
        })
        .onChange((e) => {
            if (pixelsPerMs > 0 && scale.value > 0) {
                const minimumLoopDurationMs = getMinimumLoopDurationMs();
                const nextLeftTime =
                    leftTime.value + e.changeX / (pixelsPerMs * scale.value);
                leftTime.value = Math.max(
                    minBoundMs,
                    Math.min(nextLeftTime, rightTime.value - minimumLoopDurationMs)
                );
            }
        })
        .onEnd(() => {
            isDragging.value = false;
            isLeftActive.value = false;
            commitChanges();
            if (onScrubStateChange) {
                runOnJS(onScrubStateChange)(false);
            }
        });

    const rightPan = Gesture.Pan()
        .hitSlop({
            left: HANDLE_TOUCH_TARGET_X,
            right: HANDLE_TOUCH_TARGET_X,
            top: HANDLE_TOUCH_TARGET_Y,
            bottom: HANDLE_TOUCH_TARGET_Y,
        })
        .activateAfterLongPress(300)
        .onStart(() => {
            isDragging.value = true;
            isRightActive.value = true;
            if (onScrubStateChange) {
                runOnJS(onScrubStateChange)(true);
            }
            runOnJS(Haptics.selectionAsync)();
        })
        .onChange((e) => {
            if (pixelsPerMs > 0 && scale.value > 0) {
                const minimumLoopDurationMs = getMinimumLoopDurationMs();
                const nextRightTime =
                    rightTime.value + e.changeX / (pixelsPerMs * scale.value);
                rightTime.value = Math.min(
                    maxBoundMs,
                    Math.max(nextRightTime, leftTime.value + minimumLoopDurationMs)
                );
            }
        })
        .onEnd(() => {
            isDragging.value = false;
            isRightActive.value = false;
            commitChanges();
            if (onScrubStateChange) {
                runOnJS(onScrubStateChange)(false);
            }
        });

    const boxStartLeft = useSharedValue(0);
    const boxStartRight = useSharedValue(0);
    const scrubStartProgress = useSharedValue(0);
    const handleSeekEnd = React.useCallback(
        (timeMs: number) => {
            const maybeSeek = onSeek?.(timeMs);
            if (maybeSeek && typeof (maybeSeek as Promise<void>).finally === "function") {
                void Promise.resolve(maybeSeek).finally(() => {
                    onScrubStateChange?.(false);
                });
                return;
            }

            onScrubStateChange?.(false);
        },
        [onScrubStateChange, onSeek]
    );

    const moveSelectionPan = Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart(() => {
            isBoxDragging.value = true;
            isDragging.value = true;
            isLeftActive.value = true;
            isRightActive.value = true;
            boxStartLeft.value = leftTime.value;
            boxStartRight.value = rightTime.value;
            if (onScrubStateChange) {
                runOnJS(onScrubStateChange)(true);
            }
            runOnJS(Haptics.selectionAsync)();
        })
        .onChange((e) => {
            if (!isBoxDragging.value || pixelsPerMs <= 0 || scale.value <= 0) {
                return;
            }

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
                if (onScrubStateChange) {
                    runOnJS(onScrubStateChange)(false);
                }
            }
            isDragging.value = false;
            isLeftActive.value = false;
            isRightActive.value = false;
        });

    const scrubPan = Gesture.Pan()
        .onStart(() => {
            scrubStartProgress.value = sharedAudioProgress.value;
            if (onScrubStateChange) {
                runOnJS(onScrubStateChange)(true);
            }
        })
        .onChange((e) => {
            const contentWidth = durationMs * pixelsPerMs * scale.value;
            if (contentWidth <= 0) {
                return;
            }

            const progressChange = -e.translationX / contentWidth;
            const newProgress = Math.max(0, Math.min(1, scrubStartProgress.value + progressChange));
            sharedAudioProgress.value = newProgress;
        })
        .onEnd(() => {
            runOnJS(handleSeekEnd)(sharedAudioProgress.value * durationMs);
        });

    const combinedGesture = Gesture.Race(moveSelectionPan, scrubPan);

    const isKeep = region.type === "keep";
    const visualOpacity = showVisuals ? 1 : 0;

    const leftStyle = useAnimatedStyle(() => {
        const originalX = leftTime.value * pixelsPerMs * scale.value;
        return { transform: [{ translateX: originalX + sharedTranslateX.value }] };
    });

    const leftLineStyle = useAnimatedStyle(() => {
        const active = isLeftActive.value;
        return {
            width: withSpring(active ? 3 : 2, { damping: 20, stiffness: 300 }),
            backgroundColor: isKeep
                ? (active ? "rgba(96, 165, 250, 1)" : "rgba(59, 130, 246, 0.9)")
                : (active ? "rgba(252, 129, 129, 1)" : "rgba(239, 68, 68, 0.8)"),
            opacity: visualOpacity,
        };
    });

    const leftGrabStyle = useAnimatedStyle(() => ({
        opacity: showVisuals
            ? withSpring(isLeftActive.value ? 1 : 0.7, { damping: 20, stiffness: 300 })
            : 0,
        transform: [{ scale: withSpring(isLeftActive.value ? 1.15 : 1, { damping: 20, stiffness: 300 }) }],
    }));

    const rightStyle = useAnimatedStyle(() => {
        const originalX = rightTime.value * pixelsPerMs * scale.value;
        return { transform: [{ translateX: originalX + sharedTranslateX.value - HANDLE_WIDTH }] };
    });

    const rightLineStyle = useAnimatedStyle(() => {
        const active = isRightActive.value;
        return {
            width: withSpring(active ? 3 : 2, { damping: 20, stiffness: 300 }),
            backgroundColor: isKeep
                ? (active ? "rgba(96, 165, 250, 1)" : "rgba(59, 130, 246, 0.9)")
                : (active ? "rgba(252, 129, 129, 1)" : "rgba(239, 68, 68, 0.8)"),
            opacity: visualOpacity,
        };
    });

    const rightGrabStyle = useAnimatedStyle(() => ({
        opacity: showVisuals
            ? withSpring(isRightActive.value ? 1 : 0.7, { damping: 20, stiffness: 300 })
            : 0,
        transform: [{ scale: withSpring(isRightActive.value ? 1.15 : 1, { damping: 20, stiffness: 300 }) }],
    }));

    const trackStyle = useAnimatedStyle(() => {
        const originalX = leftTime.value * pixelsPerMs * scale.value;
        const width = (rightTime.value - leftTime.value) * pixelsPerMs * scale.value;
        const bothActive = isLeftActive.value && isRightActive.value;
        return {
            transform: [
                { translateX: originalX + sharedTranslateX.value + 1 },
                { scaleY: withSpring(bothActive ? 1.05 : 1) },
            ],
            width: Math.max(0, width - 2),
            opacity: showVisuals ? withSpring(bothActive ? 1 : 0.7) : 0,
            backgroundColor: isKeep
                ? (bothActive ? "rgba(96, 165, 250, 0.28)" : "rgba(96, 165, 250, 0.18)")
                : (bothActive ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.15)"),
        };
    });

    const grabPillColor = isKeep ? "rgba(59, 130, 246, 0.9)" : "rgba(239, 68, 68, 0.8)";

    return (
        <>
            <GestureDetector gesture={combinedGesture}>
                <Animated.View
                    style={[
                        {
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: 0,
                            justifyContent: "center",
                            alignItems: "center",
                            borderRadius: 18,
                        },
                        trackStyle,
                    ]}
                />
            </GestureDetector>

            <GestureDetector gesture={leftPan}>
                <Animated.View style={[styles.handleContainer, leftStyle]}>
                    <Animated.View style={[styles.handleLine, styles.handleLineLeft, leftLineStyle]} />
                    <Animated.View
                        style={[styles.grabPill, styles.grabPillLeft, { backgroundColor: grabPillColor }, leftGrabStyle]}
                    />
                </Animated.View>
            </GestureDetector>

            <GestureDetector gesture={rightPan}>
                <Animated.View style={[styles.handleContainer, rightStyle]}>
                    <Animated.View style={[styles.handleLine, styles.handleLineRight, rightLineStyle]} />
                    <Animated.View
                        style={[styles.grabPill, styles.grabPillRight, { backgroundColor: grabPillColor }, rightGrabStyle]}
                    />
                </Animated.View>
            </GestureDetector>
        </>
    );
}

export function MultiTimeRangeSelector({
    durationMs,
    pixelsPerMs,
    regions,
    onRegionChange,
    sharedTranslateX,
    sharedScale,
    sharedAudioProgress,
    sharedPreviewStartMs,
    sharedPreviewEndMs,
    onScrubStateChange,
    onSeek,
    showVisuals = true,
}: Props) {
    const [containerWidth, setContainerWidth] = useState(0);

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    const fallbackScale = useSharedValue(1);
    const scale = sharedScale || fallbackScale;
    const sortedRegions = [...regions].sort((a, b) => a.start - b.start);

    return (
        <View style={styles.container} onLayout={onLayout} pointerEvents="box-none">
            {containerWidth > 0 &&
                sortedRegions.map((region, index) => {
                    const prevRegion = sortedRegions[index - 1];
                    const nextRegion = sortedRegions[index + 1];

                    const minBoundMs = prevRegion ? prevRegion.end : 0;
                    const maxBoundMs = nextRegion ? nextRegion.start : durationMs;

                    return (
                        <TimeRegionNode
                            key={region.id}
                            region={region}
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
                            sharedPreviewStartMs={sharedPreviewStartMs}
                            sharedPreviewEndMs={sharedPreviewEndMs}
                            onScrubStateChange={onScrubStateChange}
                            onSeek={onSeek}
                            showVisuals={showVisuals}
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
    handleLine: {
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
    handleLineLeft: {
        left: 0,
    },
    handleLineRight: {
        right: 0,
    },
    grabPill: {
        width: GRAB_PILL_WIDTH,
        height: GRAB_PILL_HEIGHT,
        borderRadius: GRAB_PILL_WIDTH / 2,
        position: "absolute",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
    },
    grabPillLeft: {
        left: -(GRAB_PILL_WIDTH / 2) + 1,
    },
    grabPillRight: {
        right: -(GRAB_PILL_WIDTH / 2) + 1,
    },
});
