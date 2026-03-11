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
const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3, 4, 5] as const;

type Range = {
    id: string;
    start: number;
    end: number;
    type: "keep" | "remove";
};

type OverlayArgs = {
    pixelsPerMs: number;
    timelineTranslateX: SharedValue<number>;
    timelineScale: SharedValue<number>;
    sharedAudioProgress: SharedValue<number>;
};

type Props = {
    waveformPeaks: number[];
    durationMs: number;
    currentTimeMs: number;
    isPlaying: boolean;
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
    renderOverlay?: (args: OverlayArgs) => ReactNode;
};

export function AudioReel({
    waveformPeaks,
    durationMs,
    currentTimeMs,
    isPlaying,
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
    renderOverlay,
}: Props) {
    const timelineTranslateX = useSharedValue(0);
    const timelineScale = useSharedValue(1);
    const visualizerHeight = useSharedValue(compact ? 120 : 160);
    const sharedAudioProgress = useSharedValue(0);
    const baseScale = useSharedValue(1);

    const [isExpanded, setIsExpanded] = useState(false);
    const [zoomIndex, setZoomIndex] = useState(0);
    const [mainCanvasWidth, setMainCanvasWidth] = useState(0);
    const [baseScaleValue, setBaseScaleValue] = useState(1);

    const collapsedHeight = compact ? 120 : 160;
    const expandedHeight = compact ? 220 : 320;

    React.useEffect(() => {
        visualizerHeight.value = withTiming(isExpanded ? expandedHeight : collapsedHeight, { duration: 300 });
    }, [collapsedHeight, expandedHeight, isExpanded, visualizerHeight]);

    const animatedHeightStyle = useAnimatedStyle(() => ({
        height: visualizerHeight.value,
    }));

    const pixelsPerMs = durationMs > 0 ? (waveformPeaks.length * 3) / durationMs : 0;
    const zoomMultiple = ZOOM_LEVELS[zoomIndex] ?? 1;
    const zoomText = `${zoomMultiple.toFixed(zoomMultiple % 1 === 0 ? 0 : 1)}x`;
    const showMinimap = zoomIndex > 0 && (!compact || isExpanded);

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
        if (baseScaleValue <= 0) return;
        const nextScale = baseScaleValue * zoomMultiple;
        baseScale.value = baseScaleValue;
        timelineScale.value = withTiming(nextScale, { duration: 250 });
    }, [baseScale, baseScaleValue, timelineScale, zoomMultiple]);

    const handleZoom = (direction: "in" | "out") => {
        setZoomIndex((prev) => {
            if (direction === "out") {
                return Math.max(0, prev - 1);
            }
            return Math.min(ZOOM_LEVELS.length - 1, prev + 1);
        });
    };

    const zoomControls = (
        <View style={[audioReelStyles.zoomRow, zoomPlacement === "top" ? audioReelStyles.zoomRowTop : null]}>
            <TouchableOpacity
                onPress={() => handleZoom("out")}
                style={[audioReelStyles.zoomButton, compact ? audioReelStyles.zoomButtonCompact : null, { opacity: zoomIndex > 0 ? 1 : 0.3 }]}
                disabled={zoomIndex === 0}
            >
                <Feather name="zoom-out" size={compact ? 18 : 20} color="#f8fafc" />
            </TouchableOpacity>
            <View style={[audioReelStyles.zoomReadout, compact ? audioReelStyles.zoomReadoutCompact : null]}>
                <Text style={[audioReelStyles.zoomReadoutText, compact ? audioReelStyles.zoomReadoutTextCompact : null]}>{zoomText}</Text>
            </View>
            <TouchableOpacity onPress={() => handleZoom("in")} style={[audioReelStyles.zoomButton, compact ? audioReelStyles.zoomButtonCompact : null]}>
                <Feather name="zoom-in" size={compact ? 18 : 20} color="#f8fafc" />
            </TouchableOpacity>
        </View>
    );

    return (
        <>
            {zoomPlacement === "top" || topLeftContent ? (
                <View style={audioReelStyles.utilityRow}>
                    <View style={audioReelStyles.utilityLeft}>{topLeftContent}</View>
                    {zoomPlacement === "top" ? zoomControls : <View />}
                </View>
            ) : null}
            <View style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", backgroundColor: "#111827" }}>
                <View style={{ pointerEvents: "none", backgroundColor: "#111827", paddingHorizontal: compact ? 10 : 12, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: "#f8fafc", fontWeight: "600", fontSize: compact ? 12 : 13, fontVariant: ["tabular-nums"] }}>{fmt(currentTimeMs)}</Text>
                </View>
                <View style={{ pointerEvents: "none", backgroundColor: "#111827", paddingHorizontal: compact ? 10 : 12, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: "#f8fafc", fontWeight: "600", fontSize: compact ? 12 : 13, fontVariant: ["tabular-nums"] }}>{fmt(durationMs)}</Text>
                </View>
            </View>

            <AnimatedView style={[{ backgroundColor: "#111827", overflow: "hidden", position: "relative" }, animatedHeightStyle]}>
                <TouchableOpacity
                    onPress={() => setIsExpanded((prev) => !prev)}
                    style={audioReelStyles.expandButton}
                >
                    <Feather name={isExpanded ? "minimize-2" : "maximize-2"} size={16} color="#f8fafc" />
                </TouchableOpacity>

                <View
                    onLayout={(e) => {
                        const nextWidth = e.nativeEvent.layout.width;
                        setMainCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
                    }}
                    style={{ flex: 1, marginHorizontal: TIMELINE_HORIZONTAL_PADDING, position: "relative" }}
                >
                    <View style={audioReelStyles.visualizerLayer}>
                        <PlaybackTapeVisualizer
                            waveformPeaks={waveformPeaks}
                            durationMs={durationMs}
                            currentTimeMs={currentTimeMs}
                            isScrubbing={isScrubbing}
                            onSeek={handleSeekCommit}
                            onScrubStateChange={handleInteractionStateChange}
                            selectedRanges={selectedRanges}
                            sharedTranslateX={timelineTranslateX}
                            sharedScale={timelineScale}
                            sharedAudioProgress={sharedAudioProgress}
                            sharedBaseScale={baseScale}
                            onBaseScaleChange={(nextScale) => {
                                setBaseScaleValue((prev) => (prev === nextScale ? prev : nextScale));
                            }}
                            theme={{
                                waveColor: "#64748b",
                                rulerColor: "#475569",
                                playheadColor: "#3b82f6",
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

            {zoomPlacement === "bottom" ? zoomControls : null}

            <View style={{ marginTop: 12, paddingHorizontal: 20 }}>
                {showMinimap && mainCanvasWidth > 0 ? (
                    <MinimapVisualizer
                        waveformPeaks={waveformPeaks}
                        durationMs={durationMs}
                        currentTimeMs={currentTimeMs}
                        timelineTranslateX={timelineTranslateX}
                        timelineScale={timelineScale}
                        mainCanvasWidth={mainCanvasWidth}
                        selectedRanges={selectedRanges}
                        onSeek={handleSeekCommit}
                        onScrubStateChange={handleInteractionStateChange}
                    />
                ) : null}
            </View>

            <View style={[audioReelStyles.transportRow, compact ? audioReelStyles.transportRowCompact : null]}>
                <TouchableOpacity onPress={() => void handleTransportSeek(onSeekToStart)} style={[audioReelStyles.transportButton, compact ? audioReelStyles.transportButtonCompact : null]}>
                    <Feather name="skip-back" size={compact ? 20 : 24} color="#f8fafc" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onTogglePlay} style={[audioReelStyles.playButton, compact ? audioReelStyles.playButtonCompact : null]}>
                    <Feather name={isPlaying ? "pause" : "play"} size={compact ? 22 : 24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void handleTransportSeek(onSeekToEnd)} style={[audioReelStyles.transportButton, compact ? audioReelStyles.transportButtonCompact : null]}>
                    <Feather name="skip-forward" size={compact ? 20 : 24} color="#f8fafc" />
                </TouchableOpacity>
            </View>
        </>
    );
}

const audioReelStyles = StyleSheet.create({
    expandButton: {
        position: "absolute",
        top: 5,
        right: 5,
        width: 32,
        height: 32,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
    },
    visualizerLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    overlayLayer: {
        zIndex: 2,
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
    zoomButton: {
        width: 32,
        height: 32,
        backgroundColor: "#1e293b",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    zoomButtonCompact: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    zoomReadout: {
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1e293b",
        borderRadius: 8,
        paddingHorizontal: 8,
        height: 32,
    },
    zoomReadoutCompact: {
        height: 28,
        borderRadius: 7,
        paddingHorizontal: 7,
    },
    zoomReadoutText: {
        color: "#f8fafc",
        fontWeight: "600",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    zoomReadoutTextCompact: {
        fontSize: 12,
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
        backgroundColor: "#1e293b",
        padding: 12,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    transportButtonCompact: {
        padding: 10,
        borderRadius: 20,
    },
    playButton: {
        backgroundColor: "#10b981",
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
