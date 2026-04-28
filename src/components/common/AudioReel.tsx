import React, { ReactNode, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { useSharedValue, withTiming, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { PlaybackTapeVisualizer } from "../visualizers/PlaybackTapeVisualizer";
import { MinimapVisualizer } from "../visualizers/MinimapVisualizer";
import { fmt } from "../../utils";

const TIMELINE_HORIZONTAL_PADDING = 20;
const AnimatedView = Reanimated.createAnimatedComponent(View);
const ZOOM_LEVELS = [1, 3, 5, 7, 10] as const;
const DISPLAY_BAR_PITCH_PX = 3;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

function downsampleWaveformPeaks(peaks: number[], targetCount: number) {
    if (targetCount >= peaks.length) {
        return peaks;
    }

    const nextPeaks: number[] = [];
    const peaksPerBucket = peaks.length / targetCount;

    for (let index = 0; index < targetCount; index += 1) {
        const start = Math.floor(index * peaksPerBucket);
        const end = Math.min(peaks.length, Math.floor((index + 1) * peaksPerBucket));
        let maxPeak = 0;

        for (let cursor = start; cursor < end; cursor += 1) {
            maxPeak = Math.max(maxPeak, peaks[cursor] ?? 0);
        }

        nextPeaks.push(maxPeak);
    }

    return nextPeaks;
}

type Range = {
    id: string;
    start: number;
    end: number;
    type: "keep" | "remove";
};

type PracticeMarkerPreview = {
    id: string;
    atMs: number;
};

type OverlayArgs = {
    pixelsPerMs: number;
    timelineTranslateX: SharedValue<number>;
    timelineScale: SharedValue<number>;
    sharedAudioProgress: SharedValue<number>;
};

type ReelChrome = "dark" | "light";

type Props = {
    waveformPeaks: number[];
    durationMs: number;
    currentTimeMs: number;
    sharedCurrentTimeMs?: SharedValue<number>;
    sharedDurationMs?: SharedValue<number>;
    sharedTransportUpdateToken?: SharedValue<number>;
    sharedAudioProgress?: SharedValue<number>;
    sharedPauseHoldMs?: SharedValue<number>;
    sharedPauseHoldToken?: SharedValue<number>;
    isPlaying: boolean;
    sharedIsPlaying?: SharedValue<boolean>;
    playbackRate?: number;
    sharedPlaybackRate?: SharedValue<number>;
    isScrubbing?: boolean;
    compact?: boolean;
    zoomPlacement?: "top" | "bottom";
    topLeftContent?: ReactNode;
    onSeek: (timeMs: number) => void | Promise<void>;
    onTogglePlay: () => void;
    onSeekToStart: () => void | Promise<void>;
    onSeekToEnd: () => void | Promise<void>;
    onScrubStateChange?: (scrubbing: boolean) => void;
    selectedRanges?: Range[];
    practiceMarkers?: PracticeMarkerPreview[];
    sharedSelectedRangeStartMs?: SharedValue<number>;
    sharedSelectedRangeEndMs?: SharedValue<number>;
    selectedRangeType?: "keep" | "remove";
    resetKey?: string | number | null;
    renderOverlay?: (args: OverlayArgs) => ReactNode;
    renderBelowSurface?: (args: OverlayArgs) => ReactNode;
    renderBelowOverlay?: (args: OverlayArgs) => ReactNode;
    chrome?: ReelChrome;
    showTransportControls?: boolean;
    showExpandToggle?: boolean;
    showZoomControls?: boolean;
    showTimingRow?: boolean;
    defaultExpanded?: boolean;
    surfaceRadius?: number;
    timelineHorizontalPadding?: number;
    collapsedHeightOverride?: number;
    expandedHeightOverride?: number;
    showMinimapMode?: "auto" | "always" | "never";
    minimapInteractive?: boolean;
    zoomMultiple?: number;
    onZoomMultipleChange?: (zoomMultiple: number) => void;
    freezeSelectedRangeWhenFullyVisible?: boolean;
};

export function AudioReel({
    waveformPeaks,
    durationMs,
    currentTimeMs,
    sharedCurrentTimeMs,
    sharedDurationMs,
    sharedTransportUpdateToken,
    sharedAudioProgress: externalSharedAudioProgress,
    sharedPauseHoldMs,
    sharedPauseHoldToken,
    isPlaying,
    sharedIsPlaying,
    playbackRate = 1,
    sharedPlaybackRate,
    isScrubbing = false,
    compact = false,
    zoomPlacement = "bottom",
    topLeftContent,
    onSeek,
    onTogglePlay,
    onSeekToStart,
    onSeekToEnd,
    onScrubStateChange,
    selectedRanges,
    practiceMarkers,
    sharedSelectedRangeStartMs,
    sharedSelectedRangeEndMs,
    selectedRangeType,
    resetKey,
    renderOverlay,
    renderBelowSurface,
    renderBelowOverlay,
    chrome = "dark",
    showTransportControls = true,
    showExpandToggle = true,
    showZoomControls = true,
    showTimingRow = true,
    defaultExpanded = false,
    surfaceRadius = 24,
    timelineHorizontalPadding = TIMELINE_HORIZONTAL_PADDING,
    collapsedHeightOverride,
    expandedHeightOverride,
    showMinimapMode = "auto",
    minimapInteractive = true,
    zoomMultiple: controlledZoomMultiple,
    onZoomMultipleChange,
    freezeSelectedRangeWhenFullyVisible = false,
}: Props) {
    const timelineTranslateX = useSharedValue(0);
    const timelineScale = useSharedValue(1);
    const visualizerHeight = useSharedValue(compact ? 120 : 160);
    const localAudioProgress = useSharedValue(0);
    const sharedAudioProgress = externalSharedAudioProgress || localAudioProgress;

    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [uncontrolledZoomMultiple, setUncontrolledZoomMultiple] = useState<number>(1);
    const [mainCanvasWidth, setMainCanvasWidth] = useState(0);
    const zoomMultiple = controlledZoomMultiple ?? uncontrolledZoomMultiple;

    const collapsedHeight = collapsedHeightOverride ?? (compact ? 120 : 160);
    const expandedHeight = expandedHeightOverride ?? (compact ? 220 : 320);

    React.useEffect(() => {
        visualizerHeight.value = withTiming(isExpanded ? expandedHeight : collapsedHeight, { duration: 300 });
    }, [collapsedHeight, expandedHeight, isExpanded, visualizerHeight]);

    const animatedHeightStyle = useAnimatedStyle(() => ({
        height: visualizerHeight.value,
    }));

    const zoomText = `${zoomMultiple.toFixed(zoomMultiple % 1 === 0 ? 0 : 1)}x`;
    const nearestZoomIndex = React.useMemo(() => {
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        ZOOM_LEVELS.forEach((level, index) => {
            const distance = Math.abs(level - zoomMultiple);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });

        return bestIndex;
    }, [zoomMultiple]);
    const targetPeakCount = React.useMemo(() => {
        if (mainCanvasWidth <= 0) {
            return Math.min(waveformPeaks.length, 96);
        }

        const visibleBarCapacity = Math.max(48, Math.round(mainCanvasWidth / DISPLAY_BAR_PITCH_PX));
        const requestedBarCount = Math.round(visibleBarCapacity * zoomMultiple);
        return Math.max(48, Math.min(waveformPeaks.length, requestedBarCount));
    }, [mainCanvasWidth, waveformPeaks.length, zoomMultiple]);
    const displayWaveformPeaks = React.useMemo(
        () => downsampleWaveformPeaks(waveformPeaks, targetPeakCount),
        [targetPeakCount, waveformPeaks]
    );
    const overscaleFactor = React.useMemo(() => {
        if (targetPeakCount <= 0) {
            return 1;
        }
        const visibleBarCapacity = mainCanvasWidth > 0
            ? Math.max(48, Math.round(mainCanvasWidth / DISPLAY_BAR_PITCH_PX))
            : 96;
        const requestedBarCount = Math.max(48, Math.round(visibleBarCapacity * zoomMultiple));
        return Math.max(1, requestedBarCount / targetPeakCount);
    }, [mainCanvasWidth, targetPeakCount, zoomMultiple]);
    const pixelsPerMs = durationMs > 0 ? (displayWaveformPeaks.length * 3) / durationMs : 0;
    const showMinimap =
        showMinimapMode === "always"
            ? true
            : showMinimapMode === "never"
                ? false
                : zoomMultiple > 1.01 && (!compact || isExpanded);
    const palette = chrome === "light"
        ? {
            surfaceColor: "#f1f2f6",
            utilityBackgroundColor: "#ffffff",
            utilityBorderColor: "#d8dde6",
            utilityTextColor: "#0f172a",
            utilityIconColor: "#475569",
            waveColor: "#66758a",
            rulerColor: "#9ba3af",
            playheadColor: "#d95b56",
            transportButtonColor: "#ffffff",
            transportButtonBorderColor: "#d8dde6",
            transportIconColor: "#111827",
            playButtonColor: "#111827",
            playIconColor: "#ffffff",
            expandButtonColor: "#ffffff",
        }
        : {
            surfaceColor: "#111827",
            utilityBackgroundColor: "#1e293b",
            utilityBorderColor: "#1e293b",
            utilityTextColor: "#f8fafc",
            utilityIconColor: "#f8fafc",
            waveColor: "#64748b",
            rulerColor: "#475569",
            playheadColor: "#3b82f6",
            transportButtonColor: "#1e293b",
            transportButtonBorderColor: "#1e293b",
            transportIconColor: "#f8fafc",
            playButtonColor: "#10b981",
            playIconColor: "#ffffff",
            expandButtonColor: "rgba(0,0,0,0.5)",
        };

    const handleInteractionStateChange = (scrubbing: boolean) => {
        onScrubStateChange?.(scrubbing);
    };

    const handleSeekCommit = async (timeMs: number) => {
        handleInteractionStateChange(true);
        try {
            await onSeek(timeMs);
        } finally {
            handleInteractionStateChange(false);
        }
    };

    const handleTransportSeek = async (action: () => void | Promise<void>) => {
        handleInteractionStateChange(true);
        try {
            await action();
        } finally {
            handleInteractionStateChange(false);
        }
    };

    React.useEffect(() => {
        timelineScale.value = withTiming(overscaleFactor, { duration: 180 });
    }, [overscaleFactor, timelineScale]);

    const handleZoom = React.useCallback((direction: "in" | "out") => {
        const currentIndex = ZOOM_LEVELS.findIndex((level) => level >= zoomMultiple - 0.001);
        const baseIndex = currentIndex >= 0 ? currentIndex : nearestZoomIndex;
        const nextZoom =
            direction === "out"
                ? ZOOM_LEVELS[Math.max(0, baseIndex - 1)] ?? MIN_ZOOM
                : ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, baseIndex + 1)] ?? MAX_ZOOM;

        if (onZoomMultipleChange) {
            onZoomMultipleChange(nextZoom);
            return;
        }

        setUncontrolledZoomMultiple(nextZoom);
    }, [nearestZoomIndex, onZoomMultipleChange, zoomMultiple]);

    const zoomControls = (
        <View style={[audioReelStyles.zoomRow, zoomPlacement === "top" ? audioReelStyles.zoomRowTop : null]}>
            <TouchableOpacity
                onPress={() => handleZoom("out")}
                style={[
                    audioReelStyles.zoomButton,
                    compact ? audioReelStyles.zoomButtonCompact : null,
                    {
                        opacity: zoomMultiple > MIN_ZOOM ? 1 : 0.3,
                        backgroundColor: palette.utilityBackgroundColor,
                        borderColor: palette.utilityBorderColor,
                    },
                ]}
                disabled={zoomMultiple <= MIN_ZOOM}
            >
                <Feather name="zoom-out" size={compact ? 18 : 20} color={palette.utilityIconColor} />
            </TouchableOpacity>
            <View
                style={[
                    audioReelStyles.zoomReadout,
                    compact ? audioReelStyles.zoomReadoutCompact : null,
                    {
                        backgroundColor: palette.utilityBackgroundColor,
                        borderColor: palette.utilityBorderColor,
                    },
                ]}
            >
                <Text
                    style={[
                        audioReelStyles.zoomReadoutText,
                        compact ? audioReelStyles.zoomReadoutTextCompact : null,
                        { color: palette.utilityTextColor },
                    ]}
                >
                    {zoomText}
                </Text>
            </View>
            <TouchableOpacity
                onPress={() => handleZoom("in")}
                style={[
                    audioReelStyles.zoomButton,
                    compact ? audioReelStyles.zoomButtonCompact : null,
                    {
                        opacity: zoomMultiple < MAX_ZOOM ? 1 : 0.3,
                        backgroundColor: palette.utilityBackgroundColor,
                        borderColor: palette.utilityBorderColor,
                    },
                ]}
                disabled={zoomMultiple >= MAX_ZOOM}
            >
                <Feather name="zoom-in" size={compact ? 18 : 20} color={palette.utilityIconColor} />
            </TouchableOpacity>
        </View>
    );

    return (
        <>
            {((showZoomControls && zoomPlacement === "top") || topLeftContent) ? (
                <View style={audioReelStyles.utilityRow}>
                    <View style={audioReelStyles.utilityLeft}>{topLeftContent}</View>
                    {showZoomControls && zoomPlacement === "top" ? zoomControls : <View />}
                </View>
            ) : null}

            {showTimingRow ? (
                <View style={audioReelStyles.timingRow}>
                    {[fmt(currentTimeMs), fmt(durationMs)].map((value, index) => (
                        <View
                            key={`${index}-${value}`}
                            style={[
                                audioReelStyles.timingPill,
                                {
                                    backgroundColor: palette.utilityBackgroundColor,
                                    borderColor: palette.utilityBorderColor,
                                },
                            ]}
                            pointerEvents="none"
                        >
                            <Text
                                style={[
                                    audioReelStyles.timingText,
                                    compact ? audioReelStyles.timingTextCompact : null,
                                    { color: palette.utilityTextColor },
                                ]}
                            >
                                {value}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}

            <AnimatedView
                style={[
                    audioReelStyles.surface,
                    {
                        backgroundColor: palette.surfaceColor,
                        borderRadius: surfaceRadius,
                    },
                    animatedHeightStyle,
                ]}
            >
                {showExpandToggle ? (
                    <TouchableOpacity
                        onPress={() => setIsExpanded((prev) => !prev)}
                        style={[
                            audioReelStyles.expandButton,
                            {
                                backgroundColor: palette.expandButtonColor,
                                borderColor: palette.utilityBorderColor,
                            },
                        ]}
                    >
                        <Feather name={isExpanded ? "minimize-2" : "maximize-2"} size={16} color={palette.utilityIconColor} />
                    </TouchableOpacity>
                ) : null}

                <View
                    onLayout={(e) => {
                        const nextWidth = e.nativeEvent.layout.width;
                        setMainCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
                    }}
                    style={{ flex: 1, marginHorizontal: timelineHorizontalPadding, position: "relative" }}
                >
                    <View style={audioReelStyles.visualizerLayer}>
                        <PlaybackTapeVisualizer
                            waveformPeaks={displayWaveformPeaks}
                            durationMs={durationMs}
                            currentTimeMs={currentTimeMs}
                            resetKey={resetKey}
                            sharedCurrentTimeMs={sharedCurrentTimeMs}
                            sharedDurationMs={sharedDurationMs}
                            sharedTransportUpdateToken={sharedTransportUpdateToken}
                            isPlaying={isPlaying}
                            sharedIsPlaying={sharedIsPlaying}
                            isScrubbing={isScrubbing}
                            playbackRate={playbackRate}
                            sharedPlaybackRate={sharedPlaybackRate}
                            onSeek={handleSeekCommit}
                            onScrubStateChange={handleInteractionStateChange}
                            selectedRanges={selectedRanges}
                            practiceMarkers={practiceMarkers}
                            sharedSelectedRangeStartMs={sharedSelectedRangeStartMs}
                            sharedSelectedRangeEndMs={sharedSelectedRangeEndMs}
                            selectedRangeType={selectedRangeType}
                            freezeSelectedRangeWhenFullyVisible={freezeSelectedRangeWhenFullyVisible}
                            sharedTranslateX={timelineTranslateX}
                            sharedScale={timelineScale}
                            sharedAudioProgress={sharedAudioProgress}
                            sharedPauseHoldMs={sharedPauseHoldMs}
                            sharedPauseHoldToken={sharedPauseHoldToken}
                            theme={{
                                waveColor: palette.waveColor,
                                rulerColor: palette.rulerColor,
                                playheadColor: palette.playheadColor,
                                backgroundColor: "transparent",
                            }}
                        />
                    </View>

                    {renderOverlay ? (
                        <View style={[StyleSheet.absoluteFill, audioReelStyles.overlayLayer]} pointerEvents="box-none">
                            {renderOverlay({
                                pixelsPerMs,
                                timelineTranslateX,
                                timelineScale,
                                sharedAudioProgress,
                            })}
                        </View>
                    ) : null}
                </View>
            </AnimatedView>

            {renderBelowSurface ? (
                <View style={{ marginHorizontal: timelineHorizontalPadding, overflow: "visible" }}>
                    {renderBelowSurface({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress })}
                </View>
            ) : null}

            {showMinimap ? (
                <View style={audioReelStyles.minimapWrap}>
                    {mainCanvasWidth > 0 ? (
                        <MinimapVisualizer
                            waveformPeaks={waveformPeaks}
                            durationMs={durationMs}
                            currentTimeMs={currentTimeMs}
                            sharedCurrentTimeMs={sharedCurrentTimeMs}
                            timelineTranslateX={timelineTranslateX}
                            timelineScale={timelineScale}
                            mainCanvasWidth={mainCanvasWidth}
                            selectedRanges={selectedRanges}
                            practiceMarkers={practiceMarkers}
                            sharedSelectedRangeStartMs={sharedSelectedRangeStartMs}
                            sharedSelectedRangeEndMs={sharedSelectedRangeEndMs}
                            selectedRangeType={selectedRangeType}
                            onSeek={handleSeekCommit}
                            onScrubStateChange={handleInteractionStateChange}
                            chrome={chrome}
                            interactive={minimapInteractive}
                            sharedAudioProgress={sharedAudioProgress}
                        />
                    ) : null}
                </View>
            ) : null}

            {renderBelowOverlay ? (
                <View style={{ marginHorizontal: timelineHorizontalPadding, overflow: "visible" }}>
                    {renderBelowOverlay({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress })}
                </View>
            ) : null}

            {showZoomControls && zoomPlacement === "bottom" ? zoomControls : null}

            {showTransportControls ? (
                <View style={[audioReelStyles.transportRow, compact ? audioReelStyles.transportRowCompact : null]}>
                    <TouchableOpacity
                        onPress={() => void handleTransportSeek(onSeekToStart)}
                        style={[
                            audioReelStyles.transportButton,
                            compact ? audioReelStyles.transportButtonCompact : null,
                            {
                                backgroundColor: palette.transportButtonColor,
                                borderColor: palette.transportButtonBorderColor,
                            },
                        ]}
                    >
                        <Feather name="skip-back" size={compact ? 20 : 24} color={palette.transportIconColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onTogglePlay}
                        style={[
                            audioReelStyles.playButton,
                            compact ? audioReelStyles.playButtonCompact : null,
                            { backgroundColor: palette.playButtonColor },
                        ]}
                    >
                        <Feather name={isPlaying ? "pause" : "play"} size={compact ? 22 : 24} color={palette.playIconColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => void handleTransportSeek(onSeekToEnd)}
                        style={[
                            audioReelStyles.transportButton,
                            compact ? audioReelStyles.transportButtonCompact : null,
                            {
                                backgroundColor: palette.transportButtonColor,
                                borderColor: palette.transportButtonBorderColor,
                            },
                        ]}
                    >
                        <Feather name="skip-forward" size={compact ? 20 : 24} color={palette.transportIconColor} />
                    </TouchableOpacity>
                </View>
            ) : null}
        </>
    );
}

const audioReelStyles = StyleSheet.create({
    surface: {
        overflow: "hidden",
        position: "relative",
    },
    expandButton: {
        position: "absolute",
        top: 5,
        right: 5,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        borderWidth: 1,
    },
    visualizerLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    overlayLayer: {
        zIndex: 2,
    },
    utilityRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    utilityLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        flex: 1,
    },
    timingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    timingPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    timingText: {
        fontWeight: "600",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    timingTextCompact: {
        fontSize: 12,
    },
    zoomRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 20,
        marginTop: 12,
    },
    zoomRowTop: {
        justifyContent: "flex-end",
        paddingHorizontal: 0,
        marginTop: 0,
    },
    zoomButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    zoomButtonCompact: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    zoomReadout: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        paddingHorizontal: 10,
        minWidth: 76,
        height: 32,
        borderWidth: 1,
    },
    zoomReadoutCompact: {
        height: 28,
        borderRadius: 7,
        paddingHorizontal: 7,
        minWidth: 68,
    },
    zoomReadoutText: {
        fontWeight: "600",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    zoomReadoutTextCompact: {
        fontSize: 12,
    },
    minimapWrap: {
        marginTop: 12,
        paddingHorizontal: 20,
    },
    transportRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
        gap: 16,
    },
    transportRowCompact: {
        marginTop: 12,
        gap: 12,
    },
    transportButton: {
        padding: 12,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    transportButtonCompact: {
        padding: 10,
        borderRadius: 20,
    },
    playButton: {
        height: 48,
        width: 80,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    playButtonCompact: {
        height: 42,
        width: 68,
        borderRadius: 21,
    },
});
