import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { colors } from "../../design/tokens";
import { computeStripBarAmps } from "../../domain/cardWaveform";
import type { InlinePlayerClock } from "../../types";

/** ≤ 56 hairline bars (~3.5pt pitch at card width) — enough to show the envelope's
 *  phrases and pauses while still reading as texture, not a meter. */
const BAR_COUNT = 56;
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
/** Sentinel for "no finger down" in the drag shared value. */
const NOT_DRAGGING = -1;

type WaveformStripProps = {
    peaks?: number[] | null;
    /** True when `peaks` are synthetic (pending placeholder / past the analysis
     *  cap). Synthetic peaks are drawn as-is — never contrast-stretched, or the
     *  seeded jitter would become a convincing fake performance. */
    synthetic?: boolean;
    height?: number;
    color?: string;
    /** While set, the strip is the live inline player: bars left of the position
     *  tint terracotta and a thin playhead marks it. Read on the UI thread — the
     *  playhead glides at the engine's report rate with no React commit per tick. */
    clock?: InlinePlayerClock;
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
    synthetic = false,
    height = 18,
    color = DEFAULT_BAR_COLOR,
    clock,
    onScrub,
    onScrubStart,
    onScrubCancel,
}: WaveformStripProps) {
    const [width, setWidth] = useState(0);
    // Mirrors `width` for the UI-thread playhead math.
    const widthValue = useSharedValue(0);
    // Finger position while dragging (0..1), NOT_DRAGGING otherwise. Written from the
    // PanResponder on the JS thread; the playhead follows it without a render.
    const dragFraction = useSharedValue(NOT_DRAGGING);

    const interactive = !!onScrub;

    const onLayout = (evt: LayoutChangeEvent) => {
        const nextWidth = evt.nativeEvent.layout.width;
        widthValue.value = nextWidth;
        setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    // Latest values for the (stable) PanResponder callbacks.
    const scrubRef = useRef({ width: 0, onScrub, onScrubStart, onScrubCancel });
    scrubRef.current = { width, onScrub, onScrubStart, onScrubCancel };

    // A finger that is still down when the strip stops being the player must not
    // leave the drag value parked.
    useEffect(() => {
        if (!interactive) dragFraction.value = NOT_DRAGGING;
    }, [interactive, dragFraction]);

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
                scrubRef.current.onScrubStart?.();
                dragFraction.value = fractionAt(evt.nativeEvent.locationX);
            },
            onPanResponderMove: (evt) => {
                dragFraction.value = fractionAt(evt.nativeEvent.locationX);
            },
            onPanResponderRelease: (evt) => {
                const fraction = fractionAt(evt.nativeEvent.locationX);
                // The commit lands the shared clock on the release position
                // synchronously (setDisplayPositionMs) — so handing the playhead
                // back to the clock on the next line never snaps it backwards.
                scrubRef.current.onScrub?.(fraction);
                dragFraction.value = NOT_DRAGGING;
            },
            onPanResponderTerminate: () => {
                dragFraction.value = NOT_DRAGGING;
                scrubRef.current.onScrubCancel?.();
            },
        });
    }, [dragFraction]);

    const hasPeaks = !!peaks && peaks.length > 0;

    // Bar amplitudes — see computeStripBarAmps for the per-clip contrast stretch.
    // Independent of width so a re-layout doesn't re-bucket.
    const barAmps = useMemo(
        () => (hasPeaks && peaks ? computeStripBarAmps(peaks, BAR_COUNT, synthetic) : null),
        [hasPeaks, peaks, synthetic]
    );

    // One stroked path of vertical ticks (same mechanism as the app's other Skia
    // waveforms). Bars start at the strip's left edge so the first tick shares the
    // title's start x. The played tint is the SAME path under a clip, not a second
    // path split at the playhead — so playback never rebuilds geometry.
    const barsPath = useMemo(() => {
        if (!barAmps || width <= 0) return null;
        const numBars = barAmps.length;
        const step = width / numBars;
        const centerY = height / 2;
        const maxHalfHeight = height / 2 - 1;
        const path = Skia.Path.Make();
        for (let i = 0; i < numBars; i++) {
            const halfHeight = Math.max(MIN_BAR_HALF_HEIGHT, barAmps[i] * maxHalfHeight);
            // Left-aligned pitch: first bar hugs the left edge (title start x).
            const x = i * step + BAR_STROKE_WIDTH / 2;
            path.moveTo(x, centerY - halfHeight);
            path.lineTo(x, centerY + halfHeight);
        }
        return path;
    }, [barAmps, width, height]);

    // ── UI-thread playhead ────────────────────────────────────────────────────
    // Hooks must run unconditionally, so a resting strip reads inert fallbacks.
    const idlePosition = useSharedValue(0);
    const idleDuration = useSharedValue(0);
    const positionMs = clock?.sharedPositionMs ?? idlePosition;
    const durationMs = clock?.sharedDurationMs ?? idleDuration;
    const live = !!clock;

    /** Playhead x in strip pixels, or -1 when there is nothing to draw. */
    const headX = useDerivedValue(() => {
        if (!live) return -1;
        const w = widthValue.value;
        if (w <= 0) return -1;
        const drag = dragFraction.value;
        let fraction: number;
        if (drag >= 0) {
            fraction = drag;
        } else {
            const duration = durationMs.value;
            if (duration <= 0) return -1;
            fraction = Math.max(0, Math.min(1, positionMs.value / duration));
        }
        return fraction * w;
    }, [live]);

    const playedClip = useDerivedValue(
        () => Skia.XYWHRect(0, 0, Math.max(0, headX.value), height),
        [height]
    );
    const playheadX = useDerivedValue(() => {
        const w = widthValue.value;
        const x = headX.value;
        if (x < 0) return -PLAYHEAD_STROKE_WIDTH * 2; // parked off-canvas
        return Math.max(0, Math.min(w - PLAYHEAD_STROKE_WIDTH, x - PLAYHEAD_STROKE_WIDTH / 2));
    });

    return (
        <View
            style={{ height, width: "100%", justifyContent: "center" }}
            // Only the resting strip is pass-through; the live strip owns its drags.
            pointerEvents={interactive ? "auto" : "none"}
            onLayout={onLayout}
            hitSlop={interactive ? { top: 10, bottom: 10 } : undefined}
            {...(interactive ? panResponder.panHandlers : null)}
        >
            {hasPeaks && barsPath != null ? (
                <Canvas style={{ width: "100%", height }}>
                    <Path
                        path={barsPath}
                        color={color}
                        style="stroke"
                        strokeWidth={BAR_STROKE_WIDTH}
                        strokeCap="round"
                    />
                    {live ? (
                        <>
                            <Group clip={playedClip}>
                                <Path
                                    path={barsPath}
                                    color={colors.primary}
                                    style="stroke"
                                    strokeWidth={BAR_STROKE_WIDTH}
                                    strokeCap="round"
                                />
                            </Group>
                            <Rect
                                x={playheadX}
                                y={0}
                                width={PLAYHEAD_STROKE_WIDTH}
                                height={height}
                                color={colors.playhead}
                            />
                        </>
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
