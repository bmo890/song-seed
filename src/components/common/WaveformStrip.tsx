import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { colors } from "../../design/tokens";

/** ≤ 36 sparse bars reads as "a waveform" at card scale without becoming noise. */
const BAR_COUNT = 36;
/** Hairline bars — the strip is identity, not chrome. */
const BAR_STROKE_WIDTH = 1.5;
/** colors.textPrimary (#1b1c1a) at 0.20 opacity — quiet identity ink,
 *  subordinate texture beneath the title (locked 2026-07-23).
 *  Skia paints need a concrete color string, so the rgba is computed from the token. */
const DEFAULT_BAR_COLOR = "rgba(27,28,26,0.20)";
/** Even silence gets a visible tick so the strip reads as a recorded object. */
const MIN_BAR_HALF_HEIGHT = 0.75;
/** Playhead line width while the strip is the live inline player. */
const PLAYHEAD_STROKE_WIDTH = 1.5;
/** Placeholder dots when no peaks exist yet (analysis pending / legacy clip). */
const PLACEHOLDER_DOTS = Array.from({ length: 28 }, (_, index) => `wave-dot-${index}`);

type WaveformStripProps = {
    peaks?: number[] | null;
    height?: number;
    color?: string;
    /** 0..1 — while set, bars left of the position tint terracotta and a thin
     *  playhead line marks the position (the strip is the live inline player). */
    progress?: number;
    /** Drag-to-scrub commit: called on release with the final 0..1 fraction.
     *  When provided the strip becomes interactive (no pointer pass-through). */
    onScrub?: (fraction: number) => void;
    onScrubStart?: () => void;
    onScrubCancel?: () => void;
};

/**
 * The clip card's waveform strip. At rest it is pure visual identity, never a
 * control — pointerEvents="none" so every tap falls through to the card's own
 * Pressables (settled interaction law: tapping the waveform behaves like
 * tapping the card). While the card is the active inline preview the SAME
 * strip goes live: progress tint + playhead + drag-to-scrub (the one place a
 * card waveform is interactive, mirroring MiniProgress's PanResponder drag).
 */
export const WaveformStrip = React.memo(function WaveformStrip({
    peaks,
    height = 14,
    color = DEFAULT_BAR_COLOR,
    progress,
    onScrub,
    onScrubStart,
    onScrubCancel,
}: WaveformStripProps) {
    const [width, setWidth] = useState(0);
    /** Local drag position while the finger is down (and until the engine's
     *  reported position catches up, so releasing never snaps back). */
    const [dragFraction, setDragFraction] = useState<number | null>(null);
    const [isCommitPending, setIsCommitPending] = useState(false);

    const interactive = !!onScrub;

    const onLayout = (evt: LayoutChangeEvent) => {
        const nextWidth = evt.nativeEvent.layout.width;
        setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    // Latest values for the (stable) PanResponder callbacks.
    const scrubRef = useRef({ width: 0, onScrub, onScrubStart, onScrubCancel });
    scrubRef.current = { width, onScrub, onScrubStart, onScrubCancel };

    // Same commit-pending trick as MiniProgress: hold the drag position after
    // release until the live position lands near it, then hand back to `progress`.
    useEffect(() => {
        if (dragFraction === null || !isCommitPending) return;
        if (progress === undefined || Math.abs(progress - dragFraction) > 0.04) return;
        setDragFraction(null);
        setIsCommitPending(false);
    }, [progress, dragFraction, isCommitPending]);

    const panResponder = useMemo(() => {
        const fractionAt = (locationX: number) => {
            const w = scrubRef.current.width;
            if (w <= 0) return 0;
            return Math.max(0, Math.min(1, locationX / w));
        };
        return PanResponder.create({
            onStartShouldSetPanResponder: () => !!scrubRef.current.onScrub,
            onMoveShouldSetPanResponder: () => !!scrubRef.current.onScrub,
            onStartShouldSetPanResponderCapture: () => !!scrubRef.current.onScrub,
            onMoveShouldSetPanResponderCapture: () => !!scrubRef.current.onScrub,
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,
            onPanResponderGrant: (evt) => {
                setIsCommitPending(false);
                scrubRef.current.onScrubStart?.();
                setDragFraction(fractionAt(evt.nativeEvent.locationX));
            },
            onPanResponderMove: (evt) => {
                setDragFraction(fractionAt(evt.nativeEvent.locationX));
            },
            onPanResponderRelease: (evt) => {
                const fraction = fractionAt(evt.nativeEvent.locationX);
                setDragFraction(fraction);
                setIsCommitPending(true);
                scrubRef.current.onScrub?.(fraction);
            },
            onPanResponderTerminate: () => {
                setDragFraction(null);
                setIsCommitPending(false);
                scrubRef.current.onScrubCancel?.();
            },
        });
    }, []);

    const hasPeaks = !!peaks && peaks.length > 0;
    const displayFraction = dragFraction ?? progress;

    // Stroked paths of vertical ticks — same mechanism as the app's other Skia
    // waveforms (MinimapVisualizer), downsampled by max-per-bucket. Bars start
    // at the strip's left edge so the first tick shares the title's start x.
    const { basePath, playedPath } = useMemo(() => {
        if (!hasPeaks || !peaks || width <= 0) return { basePath: null, playedPath: null };
        const numBars = Math.min(BAR_COUNT, peaks.length);
        const step = width / numBars;
        const peaksPerBar = peaks.length / numBars;
        const centerY = height / 2;
        const maxHalfHeight = height / 2 - 1;
        const base = Skia.Path.Make();
        const played = Skia.Path.Make();
        const progressX = displayFraction !== undefined ? displayFraction * width : null;
        for (let i = 0; i < numBars; i++) {
            const startIdx = Math.floor(i * peaksPerBar);
            const endIdx = Math.min(Math.floor((i + 1) * peaksPerBar), peaks.length);
            let maxAmp = 0;
            for (let j = startIdx; j < endIdx; j++) {
                if (peaks[j] > maxAmp) maxAmp = peaks[j];
            }
            const amp = Math.max(0, Math.min(1, maxAmp));
            const halfHeight = Math.max(MIN_BAR_HALF_HEIGHT, amp * maxHalfHeight);
            // Left-aligned pitch: first bar hugs the left edge (title start x).
            const x = i * step + BAR_STROKE_WIDTH / 2;
            const target = progressX !== null && x <= progressX ? played : base;
            target.moveTo(x, centerY - halfHeight);
            target.lineTo(x, centerY + halfHeight);
        }
        return { basePath: base, playedPath: played };
    }, [hasPeaks, peaks, width, height, displayFraction]);

    const playheadPath = useMemo(() => {
        if (displayFraction === undefined || width <= 0) return null;
        const x = Math.max(
            PLAYHEAD_STROKE_WIDTH / 2,
            Math.min(width - PLAYHEAD_STROKE_WIDTH / 2, displayFraction * width)
        );
        const line = Skia.Path.Make();
        line.moveTo(x, 0);
        line.lineTo(x, height);
        return line;
    }, [displayFraction, width, height]);

    return (
        <View
            style={{ height, width: "100%", justifyContent: "center" }}
            // Only the resting strip is pass-through; the live strip owns its drags.
            pointerEvents={interactive ? "auto" : "none"}
            onLayout={onLayout}
            hitSlop={interactive ? { top: 10, bottom: 10 } : undefined}
            {...(interactive ? panResponder.panHandlers : null)}
        >
            {hasPeaks && basePath != null ? (
                <Canvas style={{ width: "100%", height }}>
                    <Path
                        path={basePath}
                        color={color}
                        style="stroke"
                        strokeWidth={BAR_STROKE_WIDTH}
                        strokeCap="round"
                    />
                    {playedPath != null && displayFraction !== undefined ? (
                        <Path
                            path={playedPath}
                            color={colors.primary}
                            style="stroke"
                            strokeWidth={BAR_STROKE_WIDTH}
                            strokeCap="round"
                        />
                    ) : null}
                    {playheadPath != null ? (
                        <Path
                            path={playheadPath}
                            color={colors.playhead}
                            style="stroke"
                            strokeWidth={PLAYHEAD_STROKE_WIDTH}
                            strokeCap="butt"
                        />
                    ) : null}
                </Canvas>
            ) : (
                // Flat hairline of dots at the same height so cards stay aligned
                // while peaks are still being analyzed (or never will be).
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    {PLACEHOLDER_DOTS.map((key) => (
                        <View
                            key={key}
                            style={{
                                width: 2,
                                height: 2,
                                borderRadius: 1,
                                // 0.55 of the 0.22 bar ink ≈ 0.12 — fainter than real peaks.
                                backgroundColor: color,
                                opacity: 0.55,
                            }}
                        />
                    ))}
                </View>
            )}
        </View>
    );
});
