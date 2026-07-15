import React, { ReactNode, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { useSharedValue, withTiming, SharedValue, useAnimatedStyle, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather, Ionicons } from "@expo/vector-icons";
import { PlaybackTapeVisualizer } from "../visualizers/PlaybackTapeVisualizer";
import { MinimapVisualizer } from "../visualizers/MinimapVisualizer";
import type { SectionBand } from "../../playerSections";
import { fmt } from "../../utils";
import { radii } from "../../design/tokens";
import { durations } from "../../design/motion";
import { haptic } from "../../design/haptics";

const TIMELINE_HORIZONTAL_PADDING = 20;
const AnimatedView = Reanimated.createAnimatedComponent(View);
/** Stable keys for the pending line's dashes (count is cosmetic; space-between spreads
 *  them across whatever width the reel has). */
const PENDING_DASHES = Array.from({ length: 56 }, (_, index) => `pending-dash-${index}`);
// Geometric steps — each press ~doubles the zoom so every tap feels equally
// meaningful (linear steps make the high end feel like nothing). 16x is the useful
// ceiling for a ~2048-point sidecar at the reel's bar density; beyond it a long
// clip runs out of points and goes blocky.
const ZOOM_LEVELS = [1, 2, 4, 8, 16] as const;
const DISPLAY_BAR_PITCH_PX = 3;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/** Snap an arbitrary desired zoom (e.g. duration / target-window) to the nearest
 *  supported step, clamped to [MIN_ZOOM, MAX_ZOOM]. */
function snapToZoomLevel(value: number | undefined | null): number {
    if (!value || !Number.isFinite(value) || value <= MIN_ZOOM) return MIN_ZOOM;
    let nearest: number = ZOOM_LEVELS[0];
    let bestDistance = Math.abs(value - nearest);
    for (const level of ZOOM_LEVELS) {
        const distance = Math.abs(value - level);
        if (distance < bestDistance) {
            bestDistance = distance;
            nearest = level;
        }
    }
    return nearest;
}

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
    /**
     * The peaks are a synthetic placeholder, not the shape of this audio (a fresh
     * import whose background analysis hasn't landed). The reel then draws an honest
     * pending line instead of a convincing fake wave: a fake that later morphs into
     * the real shape reads as the app contradicting itself, i.e. as a bug.
     * Everything else (scrub, seek, playback, zoom) stays fully live — the audio is
     * ready; only its picture isn't.
     */
    waveformPending?: boolean;
    /** A decode is running RIGHT NOW for this clip — drives the "Analyzing…" caption.
     *  False while pending-but-deferred (playback is using the codec), so the caption
     *  never claims work that is standing down. */
    waveformAnalyzing?: boolean;
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
    zoomPlacement?: "top" | "bottom" | "overlay";
    topLeftContent?: ReactNode;
    onSeek: (timeMs: number) => void | Promise<void>;
    onTogglePlay: () => void;
    onSeekToStart: () => void | Promise<void>;
    onSeekToEnd: () => void | Promise<void>;
    onScrubStateChange?: (scrubbing: boolean) => void;
    selectedRanges?: Range[];
    practiceMarkers?: PracticeMarkerPreview[];
    sectionBands?: SectionBand[];
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
    /** Desired initial zoom for the uncontrolled case (snapped to the nearest step).
     *  Callers pass duration / target-window so longer files open more zoomed; short
     *  files snap to 1x (whole clip). Re-applied when `resetKey` changes (new clip). */
    initialZoomMultiple?: number;
    freezeSelectedRangeWhenFullyVisible?: boolean;
};

export function AudioReel({
    waveformPeaks,
    waveformPending = false,
    waveformAnalyzing = false,
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
    sectionBands,
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
    surfaceRadius = 8,
    timelineHorizontalPadding = TIMELINE_HORIZONTAL_PADDING,
    collapsedHeightOverride,
    expandedHeightOverride,
    showMinimapMode = "auto",
    minimapInteractive = true,
    zoomMultiple: controlledZoomMultiple,
    onZoomMultipleChange,
    initialZoomMultiple,
    freezeSelectedRangeWhenFullyVisible = false,
}: Props) {
    const timelineTranslateX = useSharedValue(0);
    const timelineScale = useSharedValue(1);
    const visualizerHeight = useSharedValue(compact ? 120 : 160);
    const localAudioProgress = useSharedValue(0);
    const sharedAudioProgress = externalSharedAudioProgress || localAudioProgress;

    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [uncontrolledZoomMultiple, setUncontrolledZoomMultiple] = useState<number>(
        () => snapToZoomLevel(initialZoomMultiple)
    );
    const [mainCanvasWidth, setMainCanvasWidth] = useState(0);
    const zoomMultiple = controlledZoomMultiple ?? uncontrolledZoomMultiple;

    // Re-apply the duration-aware default zoom when the source changes (new clip),
    // unless the caller controls zoom. Manual zoom within a clip is preserved — this
    // only fires on an actual resetKey change, not on every render.
    const lastZoomResetKeyRef = React.useRef(resetKey);
    React.useEffect(() => {
        if (lastZoomResetKeyRef.current === resetKey) return;
        lastZoomResetKeyRef.current = resetKey;
        if (controlledZoomMultiple == null) {
            setUncontrolledZoomMultiple(snapToZoomLevel(initialZoomMultiple));
        }
    }, [resetKey, initialZoomMultiple, controlledZoomMultiple]);

    const collapsedHeight = collapsedHeightOverride ?? (compact ? 120 : 160);
    const expandedHeight = expandedHeightOverride ?? (compact ? 220 : 320);

    React.useEffect(() => {
        visualizerHeight.value = withTiming(isExpanded ? expandedHeight : collapsedHeight, { duration: 300 });
    }, [collapsedHeight, expandedHeight, isExpanded, visualizerHeight]);

    const animatedHeightStyle = useAnimatedStyle(() => ({
        height: visualizerHeight.value,
    }));

    // Cross-fade the wave against the pending line. An instant swap from placeholder to
    // real peaks is a hard visual pop that reads as a glitch; fading the real shape in
    // reads as it ARRIVING. Snap (no animation) on the first commit and on clip changes
    // so an already-analyzed clip never fades in from nothing on open.
    const waveOpacity = useSharedValue(waveformPending ? 0 : 1);
    const didMountWaveOpacityRef = React.useRef(false);
    React.useEffect(() => {
        const target = waveformPending ? 0 : 1;
        if (!didMountWaveOpacityRef.current) {
            didMountWaveOpacityRef.current = true;
            waveOpacity.value = target;
            return;
        }
        waveOpacity.value = withTiming(target, { duration: durations.slow });
    }, [waveformPending, waveOpacity]);
    React.useEffect(() => {
        // New clip in the reel: adopt its state immediately rather than fading between
        // two different clips' waveforms.
        waveOpacity.value = waveformPending ? 0 : 1;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey]);
    const waveLayerStyle = useAnimatedStyle(() => ({ opacity: waveOpacity.value }));
    // The pending line's opacity is the exact inverse, so the two genuinely cross-fade.
    // It stays MOUNTED at opacity 0 rather than being conditionally rendered: unmounting
    // on the pending flip would pop it out instantly while the wave was still fading in —
    // a hole in the middle of the transition, which is the pop this whole treatment exists
    // to avoid.
    const pendingLayerStyle = useAnimatedStyle(() => ({ opacity: 1 - waveOpacity.value }));

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
    // Nocturne paper palette. Light = warm paper (the primary reel look); dark = a warm
    // espresso variant for any dark host surface. Both use the terracotta two-tone wave.
    const palette = chrome === "light"
        ? {
            surfaceColor: "#F0EBE4",
            utilityBackgroundColor: "#FFFFFF",
            utilityBorderColor: "#E8E4DF",
            utilityTextColor: "#524440",
            utilityIconColor: "#524440",
            waveColor: "#C7B9AF",
            wavePlayedColor: "#B87D6B",
            rulerColor: "#D7C2BD",
            playheadColor: "#8b4f3b",
            transportButtonColor: "#FFFFFF",
            transportButtonBorderColor: "#E8E4DF",
            transportIconColor: "#524440",
            playButtonColor: "#B87D6B",
            playIconColor: "#FFFFFF",
            expandButtonColor: "#FDFBF7",
        }
        : {
            surfaceColor: "#2B211D",
            utilityBackgroundColor: "#3A2D28",
            utilityBorderColor: "#4A3A34",
            utilityTextColor: "#F5EDE7",
            utilityIconColor: "#EADFD8",
            waveColor: "#7A655C",
            wavePlayedColor: "#D89A85",
            rulerColor: "#5A473F",
            playheadColor: "#E8B865",
            transportButtonColor: "#3A2D28",
            transportButtonBorderColor: "#4A3A34",
            transportIconColor: "#F5EDE7",
            playButtonColor: "#B87D6B",
            playIconColor: "#FFFFFF",
            expandButtonColor: "rgba(0,0,0,0.4)",
        };

    const scrubbingRef = React.useRef(false);
    const handleInteractionStateChange = (scrubbing: boolean) => {
        // Grab/release ticks on the transition only — the reel is the app's most
        // tactile surface and deserves physical detents (per docs/haptics-vocabulary.md).
        if (scrubbing !== scrubbingRef.current) {
            scrubbingRef.current = scrubbing;
            haptic.tap();
        }
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

        // No detent past the limit: no haptic, no state churn on a no-op zoom tap.
        if (nextZoom === zoomMultiple) return;
        haptic.light();

        if (onZoomMultipleChange) {
            onZoomMultipleChange(nextZoom);
            return;
        }

        setUncontrolledZoomMultiple(nextZoom);
    }, [nearestZoomIndex, onZoomMultipleChange, zoomMultiple]);

    // Reset to 1x — the whole clip fits the reel. No-op (and no haptic) when already there.
    const handleZoomToFit = React.useCallback(() => {
        if (zoomMultiple <= MIN_ZOOM) return;
        haptic.light();
        if (onZoomMultipleChange) {
            onZoomMultipleChange(MIN_ZOOM);
            return;
        }
        setUncontrolledZoomMultiple(MIN_ZOOM);
    }, [onZoomMultipleChange, zoomMultiple]);

    // RNGH taps (not TouchableOpacity) for the on-reel overlay zoom, so the press wins over
    // the waveform's pan/scrub gesture underneath it instead of being swallowed.
    const zoomOutTap = React.useMemo(
        () => Gesture.Tap().onEnd(() => { runOnJS(handleZoom)("out"); }),
        [handleZoom]
    );
    const zoomInTap = React.useMemo(
        () => Gesture.Tap().onEnd(() => { runOnJS(handleZoom)("in"); }),
        [handleZoom]
    );
    const zoomFitTap = React.useMemo(
        () => Gesture.Tap().onEnd(() => { runOnJS(handleZoomToFit)(); }),
        [handleZoomToFit]
    );

    // The overlay zoom collapses to a single magnifier puck; tapping expands the full
    // −/+ control, which auto-collapses again after a few idle seconds.
    const [zoomExpanded, setZoomExpanded] = useState(false);
    const zoomCollapseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleZoomCollapse = React.useCallback(() => {
        if (zoomCollapseTimer.current) clearTimeout(zoomCollapseTimer.current);
        zoomCollapseTimer.current = setTimeout(() => setZoomExpanded(false), 2800);
    }, []);
    React.useEffect(() => () => {
        if (zoomCollapseTimer.current) clearTimeout(zoomCollapseTimer.current);
    }, []);
    const zoomExpandTap = React.useMemo(
        () => Gesture.Tap().onEnd(() => {
            runOnJS(setZoomExpanded)(true);
            runOnJS(scheduleZoomCollapse)();
        }),
        [scheduleZoomCollapse]
    );

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
                    {/* Pending: an honest, obviously-unfinished line instead of a fake wave.
                        Sits in the wave's place and cross-fades out as the real peaks fade
                        in (see waveLayerStyle), so analysis completing reads as the app
                        finishing a job rather than correcting a mistake. */}
                    <AnimatedView
                        style={[audioReelStyles.pendingLayer, pendingLayerStyle]}
                        pointerEvents="none"
                    >
                        {/* Dashes are individual Views, not a dashed border: RN's
                            borderStyle:"dashed" renders SOLID on iOS. They sit on the exact
                            centre line the visualizer draws its baseline on, so the wave
                            resolves around them instead of the picture jumping. */}
                        <View style={audioReelStyles.pendingDashRow}>
                            {PENDING_DASHES.map((key) => (
                                <View
                                    key={key}
                                    style={[audioReelStyles.pendingDash, { backgroundColor: palette.waveColor }]}
                                />
                            ))}
                        </View>
                        {waveformPending && waveformAnalyzing ? (
                            <Text style={[audioReelStyles.pendingCaption, { color: palette.rulerColor }]}>
                                Analyzing waveform…
                            </Text>
                        ) : null}
                    </AnimatedView>

                    <AnimatedView style={[audioReelStyles.visualizerLayer, waveLayerStyle]}>
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
                            sectionBands={sectionBands}
                            sharedSelectedRangeStartMs={sharedSelectedRangeStartMs}
                            sharedSelectedRangeEndMs={sharedSelectedRangeEndMs}
                            selectedRangeType={selectedRangeType}
                            freezeSelectedRangeWhenFullyVisible={freezeSelectedRangeWhenFullyVisible}
                            sharedTranslateX={timelineTranslateX}
                            sharedScale={timelineScale}
                            sharedAudioProgress={sharedAudioProgress}
                            sharedPauseHoldMs={sharedPauseHoldMs}
                            sharedPauseHoldToken={sharedPauseHoldToken}
                            sharedSurfaceHeight={visualizerHeight}
                            theme={{
                                waveColor: palette.waveColor,
                                wavePlayedColor: palette.wavePlayedColor,
                                rulerColor: palette.rulerColor,
                                playheadColor: palette.playheadColor,
                                backgroundColor: "transparent",
                            }}
                        />
                    </AnimatedView>

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

            {/* Rendered as a static sibling of the animated surface (not inside it) so RNGH
                hit-testing isn't thrown off by the surface's animated height. Positioned over
                the reel's bottom-right via the known collapsed height. */}
            {showZoomControls && zoomPlacement === "overlay" ? (
                <View style={[audioReelStyles.zoomOverlay, { top: collapsedHeight - 34 }]} pointerEvents="box-none">
                    {zoomExpanded ? (
                        <AnimatedView
                            key="zoom-pill"
                            entering={Reanimated.FadeIn.duration(140)}
                            exiting={Reanimated.FadeOut.duration(120)}
                            style={audioReelStyles.zoomOverlayPill}
                            onTouchStart={scheduleZoomCollapse}
                        >
                            {/* Fit to whole clip (1x). A viewfinder frame, not an arrow —
                                so it never reads as the reel-size or sheet minimize. */}
                            <GestureDetector gesture={zoomFitTap}>
                                <View style={audioReelStyles.zoomOverlayButton}>
                                    <Ionicons
                                        name="scan-outline"
                                        size={15}
                                        color="#524440"
                                        style={{ opacity: zoomMultiple > MIN_ZOOM ? 1 : 0.3 }}
                                    />
                                </View>
                            </GestureDetector>
                            <View style={audioReelStyles.zoomOverlayDivider} />
                            <GestureDetector gesture={zoomOutTap}>
                                <View style={audioReelStyles.zoomOverlayButton}>
                                    <Feather
                                        name="zoom-out"
                                        size={15}
                                        color="#524440"
                                        style={{ opacity: zoomMultiple > MIN_ZOOM ? 1 : 0.3 }}
                                    />
                                </View>
                            </GestureDetector>
                            <Text style={audioReelStyles.zoomOverlayText}>{zoomText}</Text>
                            <GestureDetector gesture={zoomInTap}>
                                <View style={audioReelStyles.zoomOverlayButton}>
                                    <Feather
                                        name="zoom-in"
                                        size={15}
                                        color="#524440"
                                        style={{ opacity: zoomMultiple < MAX_ZOOM ? 1 : 0.3 }}
                                    />
                                </View>
                            </GestureDetector>
                        </AnimatedView>
                    ) : (
                        <AnimatedView
                            key="zoom-puck"
                            entering={Reanimated.FadeIn.duration(140)}
                            exiting={Reanimated.FadeOut.duration(120)}
                        >
                            <GestureDetector gesture={zoomExpandTap}>
                                <View style={audioReelStyles.zoomPuck}>
                                    <Feather name="search" size={15} color="#524440" />
                                </View>
                            </GestureDetector>
                        </AnimatedView>
                    )}
                </View>
            ) : null}

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
                            sectionBands={sectionBands}
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
        borderRadius: radii.round,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        borderWidth: 1,
    },
    visualizerLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    /** Sits UNDER the wave layer (which fades in over it) and never takes touches —
     *  scrub/seek belong to the visualizer even while the picture is pending. */
    pendingLayer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        zIndex: 0,
    },
    /** A broken centre line: unmistakably "nothing here yet" — no amplitude anywhere to
     *  misread as the shape of the audio. */
    pendingDashRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: 0.35,
    },
    pendingDash: {
        width: 3,
        height: 1.5,
        borderRadius: radii.xs,
    },
    /** Floated just below the centre line rather than stacked with it, so the dashes stay
     *  exactly where the wave's baseline lands. */
    pendingCaption: {
        position: "absolute",
        alignSelf: "center",
        top: "58%",
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 11,
        letterSpacing: 0.3,
        opacity: 0.9,
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
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    timingTextCompact: {
        fontSize: 12,
    },
    zoomOverlay: {
        position: "absolute",
        right: 6,
    },
    zoomOverlayPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
        paddingHorizontal: 3,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: "#D7C2BD",
        backgroundColor: "rgba(253,251,247,0.96)",
    },
    zoomOverlayButton: {
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    zoomOverlayDivider: {
        width: 0.5,
        height: 16,
        backgroundColor: "#D7C2BD",
        marginHorizontal: 1,
    },
    zoomPuck: {
        width: 30,
        height: 30,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: "#D7C2BD",
        backgroundColor: "rgba(253,251,247,0.96)",
        alignItems: "center",
        justifyContent: "center",
    },
    zoomOverlayText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 11,
        color: "#524440",
        minWidth: 22,
        textAlign: "center",
        fontVariant: ["tabular-nums"],
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
        borderRadius: radii.round,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    zoomButtonCompact: {
        width: 28,
        height: 28,
        borderRadius: radii.round,
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
        fontFamily: "PlusJakartaSans_600SemiBold",
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
        borderRadius: radii.round,
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
        borderRadius: radii.round,
        justifyContent: "center",
        alignItems: "center",
    },
    playButtonCompact: {
        height: 42,
        width: 68,
        borderRadius: radii.round,
    },
});
