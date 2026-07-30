import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import {
    Canvas,
    Path,
    Group,
    Skia,
    Rect,
    RoundedRect,
    Text as SkiaText,
    Paragraph,
    useFont,
    useFonts,
} from "@shopify/react-native-skia";
import {
    useSharedValue,
    withDecay,
    useDerivedValue,
    runOnJS,
    SharedValue,
    cancelAnimation,
    useFrameCallback,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import type { SkParagraph } from "@shopify/react-native-skia";
import type { PracticeMarker } from "../../types";
import type { SectionBand } from "../../domain/playerSections";
import type { GridRulerModel } from "../../domain/gridRuler";
import { advanceTracker } from "../../domain/motionTracking";
import {
    assignPinRows,
    estimatePinBadgeWidth,
    getPinBadgeEdges,
    resolvePinBadgeAnchor,
    pinRowTop,
    PIN_BADGE_HEIGHT,
    PIN_DOT_SIZE,
} from "../../domain/practicePinLayout";
import { colors } from "../../design/tokens";

type Props = {
    waveformPeaks: number[];
    durationMs: number;
    currentTimeMs: number;
    resetKey?: string | number | null;
    sharedCurrentTimeMs?: SharedValue<number>;
    sharedDurationMs?: SharedValue<number>;
    sharedTransportUpdateToken?: SharedValue<number>;
    /** Bumped when a seek actually LANDED (the engine's clock reached the target). Ends the
     *  post-scrub hold on the event instead of on a timer. */
    sharedSeekLandedToken?: SharedValue<number>;
    isPlaying?: boolean;
    sharedIsPlaying?: SharedValue<boolean>;
    playbackRate?: number;
    sharedPlaybackRate?: SharedValue<number>;
    isScrubbing?: boolean;
    onSeek: (timeMs: number) => void;
    selectedRanges?: { id: string; start: number; end: number; type: "keep" | "remove" }[];
    practiceMarkers?: (Pick<PracticeMarker, "id" | "atMs"> & { label?: string; note?: string })[];
    /** Set while a pin badge is being dragged: that badge's Skia twin hides and the RN
     *  gesture layer (under the finger) shows instead. */
    sharedDraggingMarkerId?: SharedValue<string>;
    sectionBands?: SectionBand[];
    /** Beat-grid ruler primitives (file-ms space) — manuscript lines under the wave. */
    gridRuler?: GridRulerModel | null;
    /** Numeric twin of `sharedScale`. The bar numbers are laid out with it rather than
     *  reading the animated value per label — scaling the layer would scale the glyphs,
     *  and it only moves during a brief overscale tween. */
    gridLabelScale?: number;
    /** Ink for the bar numbers. */
    gridLabelColor?: string;
    sharedSelectedRangeStartMs?: SharedValue<number>;
    sharedSelectedRangeEndMs?: SharedValue<number>;
    selectedRangeType?: "keep" | "remove";
    theme?: {
        waveColor?: string;
        /** Terracotta fill for the played (behind-the-playhead) portion of the wave. */
        wavePlayedColor?: string;
        rulerColor?: string;
        playheadColor?: string;
        backgroundColor?: string;
    };
    sharedTranslateX?: SharedValue<number>;
    sharedScale?: SharedValue<number>;
    /** Live surface height (animated by AudioReel on expand/compact). When provided,
     *  all vertical geometry is driven off this shared value via Skia transforms, so a
     *  height animation never rebuilds paths or re-renders — it stays on the UI thread. */
    sharedSurfaceHeight?: SharedValue<number>;
    sharedAudioProgress?: SharedValue<number>;
    sharedPauseHoldMs?: SharedValue<number>;
    sharedPauseHoldToken?: SharedValue<number>;
    onScrubStateChange?: (isScrubbing: boolean) => void;
    freezeSelectedRangeWhenFullyVisible?: boolean;
};

type PinMarkerOverlayProps = {
    /** Live surface height; the pin insets a few px top/bottom from it. */
    heightValue: SharedValue<number>;
    markers: Pick<PracticeMarker, "id" | "atMs">[];
    pixelsPerMs: number;
};

type LoopRangeOverlayProps = {
    durationMs: number;
    baseContentWidth: number;
    heightValue: SharedValue<number>;
    scale: SharedValue<number>;
    translateX: SharedValue<number>;
    sharedStartMs: SharedValue<number>;
    sharedEndMs: SharedValue<number>;
    rangeType: "keep" | "remove";
};

const LOOP_HANDLE_WIDTH = 2;
const LOOP_PILL_WIDTH = 14;
const LOOP_PILL_HEIGHT = 28;
const PLAY_START_STATUS_GRACE_MS = 450;
const PLAY_START_CORRECTION_FACTOR = 0.06;
const PLAY_START_STALE_FORWARD_MS = 40;
const HARD_FORWARD_SNAP_MS = 650;
const BACKWARD_SNAP_MS = 80;
// How long the reel keeps showing the scrub target after a seek is committed, before it
// resumes following position reports. Covers the native seek latency (the source is still
// repositioning) so a stale in-flight report can't flash the playhead to the old spot the
// instant the lock releases. ≈260ms was too short (stale flash); ≈470ms held the playhead
// visibly still after a scrub. 330ms is the middle ground. Measured in MILLISECONDS, not
// frames: the old frame countdown ran half as long on a 120Hz display, which is where the
// stale flash came back.
const SCRUB_SETTLE_MS = 330;
const PAUSE_VISUAL_HOLD_MS = 220;
// How far the frame-rate predictor may coast ahead of the last reported position
// before it stops and waits. Position reports arrive ~every 50ms but the JS thread
// often delivers them late/bursty while the player tree reconciles; if this cap is
// tighter than that jitter the scroll advances then FREEZES at the cap until the next
// report lands — the visible "move, pause, move" stutter. Local playback never
// buffer-stalls, so a generous cap just lets the reel coast smoothly through report
// gaps (a genuine stall still snaps back via HARD_FORWARD/BACKWARD_SNAP).
const PREDICTOR_MAX_LEAD_MS = 300;
// The reel scrolls on an α-β tracking filter (the standard radar/A-V-sync tracker):
// it carries its own VELOCITY estimate and folds each position report in as a small
// residual, instead of re-anchoring the ramp to the last painted position on every
// report. Re-anchoring was the judder: each report restarted the ramp at ~zero
// velocity, so the tape accelerated from a near-stop 20×/second. The waveform hides
// that (one candle looks like the next); an isolated bar line, pin, or section edge
// does not — which is exactly where the stepping was visible.
//
// TAU is the convergence time constant. Deriving alpha from the real frame delta keeps
// the feel identical at 60Hz and 120Hz (a fixed per-frame gain does not — it converges
// twice as slowly on ProMotion).
const TRACKING_TAU_MS = 130;
/** Ceiling on the tracker's velocity estimate, as a multiple of the nominal rate. */
const MAX_TRACKING_VELOCITY_FACTOR = 3;
/**
 * Ceiling on how fast the tape may actually travel, as a multiple of the nominal rate.
 *
 * The velocity ceiling above does not bound the per-frame correction term, so a residual
 * closes at roughly `residual/TRACKING_TAU_MS` ON TOP of nominal — a 400ms debt ran the tape
 * at ~4× for a quarter second, which is the sprint people saw after scrubbing. Genuine
 * discontinuities (a seek landing) are adopted in one frame instead, so nothing legitimate
 * needs this headroom; what is left is drift, and drift closing at 1.4× is invisible.
 */
const MAX_CATCHUP_VELOCITY_FACTOR = 1.4;
/** Residual past which tracking is pointless — jump and re-seed the velocity. */
const TRACKING_RESYNC_PROGRESS = 0.03;
// The bar numbers are drawn INSIDE the canvas, under the same transform as the tape, so
// they are part of the same picture rather than RN views chasing it. Two renderers painting
// one moving scene can never be kept in step — measured, on iOS, with no React commits at
// all (docs/product-plan/reel-smoothness-findings.md). Glued by construction instead.
const GRID_LABEL_FONT_SIZE = 8.5;
/** Baseline for the numbers along the reel's top edge. */
const GRID_LABEL_BASELINE_Y = 11;
/** Left inset from the bar line the number names. */
const GRID_LABEL_INSET_X = 3;
const GRID_BAR_LABEL_OPACITY = 0.55;
// Beat ticks, matched to the recording tape (LiveTapeVisualizer): a mark on BOTH edges,
// 8pt long, at the same weight as the bar lines. They used to be a single 1px hairline on
// the bottom edge at 0.28 — technically present, invisible in practice, and drawn under the
// wave — so playback read as "measure lines only" against a recording tape that shows every
// beat. One visual language across both, or the grid isn't a grid.
const GRID_BEAT_TICK_LENGTH = 8;
const GRID_BEAT_TICK_WIDTH = 1;
const GRID_BEAT_TICK_OPACITY = 0.42;
const GRID_CHANGE_LABEL_OPACITY = 0.85;

function LoopRangeOverlay({
    durationMs,
    baseContentWidth,
    heightValue,
    scale,
    translateX,
    sharedStartMs,
    sharedEndMs,
    rangeType,
}: LoopRangeOverlayProps) {
    // Looper sits above section bands. Terracotta for a keep loop, muted rust for a
    // remove range — both read clearly over a tinted section underneath.
    const fillColor = rangeType === "keep" ? "rgba(184, 125, 107, 0.28)" : "rgba(161, 92, 74, 0.16)";
    const lineColor = rangeType === "keep" ? "rgba(139, 79, 59, 0.95)" : "rgba(161, 92, 74, 0.85)";

    const leftX = useDerivedValue(() => {
        if (durationMs <= 0) return 0;
        const baseX = (sharedStartMs.value / durationMs) * baseContentWidth;
        return baseX * scale.value + translateX.value;
    });

    const rightX = useDerivedValue(() => {
        if (durationMs <= 0) return 0;
        const baseX = (sharedEndMs.value / durationMs) * baseContentWidth;
        return baseX * scale.value + translateX.value;
    });

    const fillWidth = useDerivedValue(() => Math.max(1, rightX.value - leftX.value));
    const rightLineX = useDerivedValue(() => rightX.value - LOOP_HANDLE_WIDTH);
    const leftPillX = useDerivedValue(() => leftX.value - LOOP_PILL_WIDTH / 2 + 1);
    const rightPillX = useDerivedValue(() => rightX.value - LOOP_PILL_WIDTH / 2 - 1);
    const pillY = useDerivedValue(() => heightValue.value / 2 - LOOP_PILL_HEIGHT / 2);

    return (
        <>
            <Rect x={leftX} y={0} width={fillWidth} height={heightValue} color={fillColor} />
            <Rect x={leftX} y={0} width={LOOP_HANDLE_WIDTH} height={heightValue} color={lineColor} />
            <Rect x={rightLineX} y={0} width={LOOP_HANDLE_WIDTH} height={heightValue} color={lineColor} />
            <RoundedRect
                x={leftPillX}
                y={pillY}
                width={LOOP_PILL_WIDTH}
                height={LOOP_PILL_HEIGHT}
                r={LOOP_PILL_WIDTH / 2}
                color={lineColor}
            />
            <RoundedRect
                x={rightPillX}
                y={pillY}
                width={LOOP_PILL_WIDTH}
                height={LOOP_PILL_HEIGHT}
                r={LOOP_PILL_WIDTH / 2}
                color={lineColor}
            />
        </>
    );
}

/**
 * Manuscript ruling: hairline bar lines, short beat ticks along the bottom edge, a
 * slightly stronger line where the tempo/meter changes, and a whisper of shading over
 * retained pre-roll. Drawn in base-content coordinates inside the scaled group, so it
 * scrolls and zooms with the wave. Where the grid stopped being trustworthy
 * (`validToMs`) the model simply carries no primitives — absence is the signal.
 */
/**
 * Pin badge visuals, drawn INSIDE the canvas for the same reason as the section chips and
 * bar numbers: RN twins chasing the tape slip a frame whenever React commits. The RN layer
 * keeps ONLY the gestures (invisible hitboxes) — except mid-drag, when its badge becomes
 * visible under the finger and this one hides.
 */
function PinBadgeChipsOverlay({
    markers,
    pixelsPerMs,
    labelScale,
    durationMs,
    fontProvider,
    sharedDraggingMarkerId,
}: {
    markers: (Pick<PracticeMarker, "id" | "atMs"> & { label?: string; note?: string })[];
    pixelsPerMs: number;
    labelScale: number;
    durationMs: number;
    fontProvider: NonNullable<ReturnType<typeof useFonts>>;
    sharedDraggingMarkerId?: SharedValue<string>;
}) {
    const chips = useMemo(() => {
        const rows = assignPinRows(markers, pixelsPerMs, labelScale, durationMs);
        const contentWidth = durationMs * pixelsPerMs * labelScale;
        return rows.map(({ marker, row }) => {
            const centerX = marker.atMs * pixelsPerMs * labelScale;
            const width = estimatePinBadgeWidth(marker.label);
            const anchor = resolvePinBadgeAnchor(centerX, width, contentWidth);
            const left = getPinBadgeEdges(centerX, width, anchor).left;
            const top = pinRowTop(row);
            let paragraph: SkParagraph | null = null;
            if (marker.label) {
                paragraph = Skia.ParagraphBuilder.Make({ maxLines: 1, ellipsis: "\u2026" }, fontProvider)
                    .pushStyle({
                        fontFamilies: ["Plus Jakarta Sans", "Heebo"],
                        fontSize: 10,
                        fontStyle: { weight: 600 },
                        color: Skia.Color(colors.onPrimary),
                    })
                    .addText(marker.label)
                    .build();
                paragraph.layout(Math.max(1, width - 12));
            }
            return { marker, left, top, width, paragraph };
        });
    }, [markers, pixelsPerMs, labelScale, durationMs, fontProvider]);

    return (
        <>
            {chips.map((chip) => (
                <PinBadgeChip key={chip.marker.id} chip={chip} sharedDraggingMarkerId={sharedDraggingMarkerId} />
            ))}
        </>
    );
}

function PinBadgeChip({
    chip,
    sharedDraggingMarkerId,
}: {
    chip: {
        marker: Pick<PracticeMarker, "id" | "atMs"> & { label?: string; note?: string };
        left: number;
        top: number;
        width: number;
        paragraph: SkParagraph | null;
    };
    sharedDraggingMarkerId?: SharedValue<string>;
}) {
    const { marker, left, top, width, paragraph } = chip;
    const opacity = useDerivedValue(() =>
        sharedDraggingMarkerId && sharedDraggingMarkerId.value === marker.id ? 0 : 1
    );
    if (!marker.label) {
        return (
            <Group opacity={opacity}>
                <RoundedRect
                    x={left + (PIN_BADGE_HEIGHT - PIN_DOT_SIZE) / 2}
                    y={top + 2}
                    width={PIN_DOT_SIZE}
                    height={PIN_DOT_SIZE}
                    r={PIN_DOT_SIZE / 2}
                    color={colors.primary}
                />
                {marker.note ? (
                    <RoundedRect
                        x={left + (PIN_BADGE_HEIGHT - PIN_DOT_SIZE) / 2 + 2}
                        y={top + 4}
                        width={PIN_DOT_SIZE - 4}
                        height={PIN_DOT_SIZE - 4}
                        r={(PIN_DOT_SIZE - 4) / 2}
                        color={colors.onPrimary}
                        opacity={0.85}
                    />
                ) : null}
            </Group>
        );
    }
    return (
        <Group opacity={opacity}>
            <RoundedRect x={left} y={top} width={width} height={PIN_BADGE_HEIGHT} r={2} color={colors.primary} />
            {paragraph ? (
                <Paragraph paragraph={paragraph} x={left + 6} y={top + 3} width={width - 12} />
            ) : null}
            {marker.note ? (
                <RoundedRect
                    x={left + width - 8}
                    y={top + PIN_BADGE_HEIGHT / 2 - 2}
                    width={4}
                    height={4}
                    r={2}
                    color={colors.onPrimary}
                    opacity={0.85}
                />
            ) : null}
        </Group>
    );
}

const SECTION_CHIP_HEIGHT = 16;
const SECTION_CHIP_PAD_X = 5;
const SECTION_CHIP_EDGE_PAD = 2;
const SECTION_CHIP_BOTTOM_INSET = 3;
const SECTION_CHIP_FONT_SIZE = 9.5;

/**
 * Section name chips, drawn INSIDE the canvas so they are part of the same picture as the
 * bands they name — the RN twin of this layer was the last place section labels could slip
 * against the tape (any React commit costs the UI thread a frame, and two renderers come
 * back in different frames; see docs/product-plan/reel-smoothness-findings.md). User text
 * goes through the Paragraph API: it shapes Hebrew (Heebo is registered as the fallback
 * face, matching the app-level RTL font remap), which Skia's basic Text cannot.
 *
 * Each chip pins to the reel's left edge while its band scrolls off — the same left-edge
 * slide the RN layer had — via a per-band UI-thread transform reading the tape's
 * translateX. Same renderer, same frame, glued.
 */
function SectionLabelChipsOverlay({
    bands,
    pixelsPerMs,
    labelScale,
    translateX,
    heightValue,
    fontProvider,
}: {
    bands: SectionBand[];
    pixelsPerMs: number;
    labelScale: number;
    translateX: SharedValue<number>;
    heightValue: SharedValue<number>;
    fontProvider: NonNullable<ReturnType<typeof useFonts>>;
}) {
    const chips = useMemo(
        () =>
            bands.map((band) => {
                const startX = band.startMs * pixelsPerMs * labelScale;
                const bandWidth = Math.max(0, (band.endMs - band.startMs) * pixelsPerMs * labelScale);
                const paragraph = Skia.ParagraphBuilder.Make(
                    { maxLines: 1, ellipsis: "\u2026" },
                    fontProvider
                )
                    .pushStyle({
                        fontFamilies: ["Plus Jakarta Sans", "Heebo"],
                        fontSize: SECTION_CHIP_FONT_SIZE,
                        fontStyle: { weight: 600 },
                        color: Skia.Color(colors.surface),
                    })
                    .addText(band.label)
                    .build();
                paragraph.layout(Math.max(1, bandWidth - SECTION_CHIP_PAD_X * 2));
                const textWidth = Math.ceil(paragraph.getLongestLine());
                const textHeight = paragraph.getHeight();
                const chipWidth = Math.min(
                    Math.max(1, bandWidth - SECTION_CHIP_EDGE_PAD * 2),
                    textWidth + SECTION_CHIP_PAD_X * 2
                );
                return { band, startX, bandWidth, paragraph, chipWidth, textHeight };
            }),
        [bands, pixelsPerMs, labelScale, fontProvider]
    );

    return (
        <>
            {chips.map((chip) => (
                <SectionLabelChip key={chip.band.id} chip={chip} translateX={translateX} heightValue={heightValue} />
            ))}
        </>
    );
}

function SectionLabelChip({
    chip,
    translateX,
    heightValue,
}: {
    chip: {
        band: SectionBand;
        startX: number;
        bandWidth: number;
        paragraph: SkParagraph;
        chipWidth: number;
        textHeight: number;
    };
    translateX: SharedValue<number>;
    heightValue: SharedValue<number>;
}) {
    const { band, startX, bandWidth, paragraph, chipWidth, textHeight } = chip;
    // Slide along the band so the chip holds the reel's left edge while the band scrolls
    // off; vanish when the remaining band can no longer hold it.
    const slide = useDerivedValue(() => {
        const offscreen = SECTION_CHIP_EDGE_PAD - (startX + translateX.value);
        return Math.max(0, Math.min(offscreen, bandWidth - chipWidth - SECTION_CHIP_EDGE_PAD));
    });
    const transform = useDerivedValue(() => [{ translateX: startX + SECTION_CHIP_EDGE_PAD + slide.value }]);
    const opacity = useDerivedValue(() => {
        const offscreen = SECTION_CHIP_EDGE_PAD - (startX + translateX.value);
        return offscreen <= bandWidth - chipWidth - SECTION_CHIP_EDGE_PAD ? 1 : 0;
    });
    const chipY = useDerivedValue(
        () => heightValue.value - SECTION_CHIP_BOTTOM_INSET - SECTION_CHIP_HEIGHT
    );
    const textY = useDerivedValue(() => chipY.value + (SECTION_CHIP_HEIGHT - textHeight) / 2);

    return (
        <Group transform={transform} opacity={opacity}>
            <RoundedRect
                x={0}
                y={chipY}
                width={chipWidth}
                height={SECTION_CHIP_HEIGHT}
                r={3}
                color={band.railColor}
            />
            <Paragraph paragraph={paragraph} x={SECTION_CHIP_PAD_X} y={textY} width={chipWidth} />
        </Group>
    );
}

function GridRulerOverlay({
    heightValue,
    model,
    pixelsPerMs,
    inkColor,
}: {
    heightValue: SharedValue<number>;
    model: GridRulerModel;
    pixelsPerMs: number;
    inkColor: string;
}) {
    const beatTickY = useDerivedValue(() => Math.max(0, heightValue.value - GRID_BEAT_TICK_LENGTH));
    return (
        <>
            {model.preRollEndMs != null ? (
                <Rect
                    x={0}
                    y={0}
                    width={model.preRollEndMs * pixelsPerMs}
                    height={heightValue}
                    color={inkColor}
                    opacity={0.1}
                />
            ) : null}
            {model.barLines.map((line) => (
                <Rect
                    key={`bar-${line.bar}`}
                    x={line.ms * pixelsPerMs}
                    y={0}
                    width={1}
                    height={heightValue}
                    color={inkColor}
                    opacity={0.38}
                />
            ))}
            {model.beatTicks.map((tickMs) => (
                <React.Fragment key={`beat-${tickMs}`}>
                    <Rect
                        x={tickMs * pixelsPerMs}
                        y={0}
                        width={GRID_BEAT_TICK_WIDTH}
                        height={GRID_BEAT_TICK_LENGTH}
                        color={inkColor}
                        opacity={GRID_BEAT_TICK_OPACITY}
                    />
                    <Rect
                        x={tickMs * pixelsPerMs}
                        y={beatTickY}
                        width={GRID_BEAT_TICK_WIDTH}
                        height={GRID_BEAT_TICK_LENGTH}
                        color={inkColor}
                        opacity={GRID_BEAT_TICK_OPACITY}
                    />
                </React.Fragment>
            ))}
            {model.changeMarkers.map((marker) => (
                <Rect
                    key={`change-${marker.bar}`}
                    x={marker.ms * pixelsPerMs}
                    y={0}
                    width={1.5}
                    height={heightValue}
                    color={inkColor}
                    opacity={0.6}
                />
            ))}
        </>
    );
}

function SectionBandOverlay({
    heightValue,
    bands,
    pixelsPerMs,
}: {
    heightValue: SharedValue<number>;
    bands: SectionBand[];
    pixelsPerMs: number;
}) {
    return (
        <>
            {bands.map((band) => {
                const x = band.startMs * pixelsPerMs;
                const width = Math.max(0, (band.endMs - band.startMs) * pixelsPerMs);
                if (width <= 0) return null;
                return (
                    <Group key={band.id}>
                        <Rect x={x} y={0} width={width} height={heightValue} color={band.color} />
                        <Rect x={x} y={0} width={width} height={2.5} color={band.railColor} />
                    </Group>
                );
            })}
        </>
    );
}

function PinMarkerOverlay({
    heightValue,
    markers,
    pixelsPerMs,
}: PinMarkerOverlayProps) {
    const pinHeight = useDerivedValue(() => Math.max(0, heightValue.value - 6));
    return (
        <>
            {markers.map((marker) => (
                <Rect
                    key={marker.id}
                    x={marker.atMs * pixelsPerMs}
                    y={3}
                    width={2.5}
                    height={pinHeight}
                    color="#8b4f3b"
                />
            ))}
        </>
    );
}

// Display-only waveform shaping (purely visual — the stored peaks are unchanged).
// Stored amplitudes for typical material cluster in a compressed mid band, which
// reads flat. We expand that window across the full bar height so quiet→loud
// variation is pronounced and detailed. Tune these to taste.
const WAVEFORM_DISPLAY_FLOOR = 0.16; // amplitudes at/below this read as ~silent (bottom contrast)
const WAVEFORM_DISPLAY_GAIN = 1.0; // no ceiling push — >1 saturated loud/mastered material
const WAVEFORM_DISPLAY_MIN = 0.02; // faint hairline so silent passages still register
const WAVEFORM_EDGE_MARGIN_PX = 6; // top/bottom px margin
// Vertical headroom: even the loudest content tops out at this fraction of the
// half-height, so a loud/mastered track reads as a full-but-breathing band rather
// than bars slamming the top and bottom edges.
const WAVEFORM_HEADROOM = 0.84;

export function PlaybackTapeVisualizer({
    waveformPeaks,
    durationMs,
    currentTimeMs,
    resetKey,
    sharedCurrentTimeMs,
    sharedDurationMs,
    sharedTransportUpdateToken,
    sharedSeekLandedToken,
    isPlaying = false,
    sharedIsPlaying,
    playbackRate = 1,
    sharedPlaybackRate,
    isScrubbing = false,
    onSeek,
    selectedRanges,
    practiceMarkers,
    sectionBands,
    gridRuler,
    gridLabelScale = 1,
    gridLabelColor,
    sharedDraggingMarkerId,
    sharedSelectedRangeStartMs,
    sharedSelectedRangeEndMs,
    selectedRangeType = "keep",
    theme,
    sharedTranslateX,
    sharedScale,
    sharedAudioProgress,
    sharedPauseHoldMs,
    sharedPauseHoldToken,
    sharedSurfaceHeight,
    onScrubStateChange,
    freezeSelectedRangeWhenFullyVisible = false,
}: Props) {
    const [canvasWidth, setCanvasWidth] = useState(0);
    // Height is a shared value, never React state: expand/compact animates it on the UI
    // thread and drives all vertical geometry through Skia transforms, so no path
    // rebuild or re-render happens per frame. Falls back to onLayout when the parent
    // doesn't supply an animated height.
    const localSurfaceHeight = useSharedValue(0);
    const heightSV = sharedSurfaceHeight || localSurfaceHeight;

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
    const localCurrentTimeMs = useSharedValue(currentTimeMs);
    const currentTimeMsValue = sharedCurrentTimeMs || localCurrentTimeMs;
    const localDurationMs = useSharedValue(durationMs);
    const durationMsValue = sharedDurationMs || localDurationMs;
    const localTransportUpdateToken = useSharedValue(0);
    const localSeekLandedToken = useSharedValue(0);
    const lastSeenSeekLanded = useSharedValue(0);
    const transportUpdateToken = sharedTransportUpdateToken || localTransportUpdateToken;
    const seekLandedToken = sharedSeekLandedToken || localSeekLandedToken;
    const localIsPlaying = useSharedValue(isPlaying);
    const isPlayingShared = sharedIsPlaying || localIsPlaying;
    const isScrubbingShared = useSharedValue(isScrubbing);
    const localPlaybackRate = useSharedValue(playbackRate);
    const playbackRateShared = sharedPlaybackRate || localPlaybackRate;
    const lastSeenTransportUpdate = useSharedValue(0);
    const reportBaseProgress = useSharedValue(0);
    const reportFrameTimestamp = useSharedValue(0);
    /** Progress units per ms — the tracker's own estimate of how fast the tape runs. */
    const progressVelocity = useSharedValue(0);
    /** True while scrub/pause/count-in owns the playhead and the tracker is parked. */
    const trackingSuspended = useSharedValue(true);
    const lastPlayingState = useSharedValue(isPlaying);
    const playingStateChangedAt = useSharedValue(0);
    const scrubSettleUntil = useSharedValue(0);
    /**
     * A seek was committed: the next report the tape is allowed to believe is a LANDING, and
     * it should be adopted outright rather than handed to the tracker as a residual.
     *
     * A seek is a discontinuity. While the tape holds the scrub position — through the settle
     * window, and then through the play-start grace — the engine seeks, resumes, and starts
     * advancing, so by the time the holds expire the tape owes a debt of a few hundred ms.
     * Feeding that to the α-β tracker closes it by ACCELERATION (roughly gap/tau on top of
     * the nominal rate), which is the "speeds up to catch up" after a scrub. Landing on it in
     * one frame is both cheaper to look at and what actually happened.
     */
    const adoptNextReport = useSharedValue(false);
    /** Last frame timestamp, so gesture worklets can schedule against the same clock. */
    const frameNow = useSharedValue(0);
    const awaitingPlayStartClock = useSharedValue(false);
    const pauseHoldUntil = useSharedValue(0);
    const pauseHoldProgress = useSharedValue(0);
    const pauseAnchorActive = useSharedValue(false);
    const lastSeenPauseHoldToken = useSharedValue(0);

    const contentWidth = useDerivedValue(() => baseContentWidth * scale.value);

    // The exact pixel distance from the start of the audio to the playhead time
    const targetX = useDerivedValue(() => {
        return audioProgress.value * contentWidth.value;
    });
    // Initial Zoom: Fit the entire waveform fully onto the screen exactly 100% wide
    useEffect(() => {
        if (!sharedCurrentTimeMs) {
            currentTimeMsValue.value = currentTimeMs;
            transportUpdateToken.value += 1;
        }
    }, [currentTimeMs, currentTimeMsValue, sharedCurrentTimeMs, transportUpdateToken]);

    useEffect(() => {
        if (!sharedDurationMs) {
            durationMsValue.value = durationMs;
        }
    }, [durationMs, durationMsValue, sharedDurationMs]);

    useEffect(() => {
        if (!sharedIsPlaying) {
            isPlayingShared.value = isPlaying;
        }
    }, [isPlaying, isPlayingShared, sharedIsPlaying]);

    useEffect(() => {
        if (!sharedPlaybackRate) {
            playbackRateShared.value = playbackRate;
        }
    }, [playbackRate, playbackRateShared, sharedPlaybackRate]);

    useEffect(() => {
        isScrubbingShared.value = isScrubbing;
    }, [isScrubbing, isScrubbingShared]);

    useEffect(() => {
        const resetProgress = durationMs > 0 ? Math.max(0, Math.min(1, currentTimeMs / durationMs)) : 0;
        cancelAnimation(audioProgress);
        audioProgress.value = resetProgress;
        reportBaseProgress.value = resetProgress;
        reportFrameTimestamp.value = 0;
        progressVelocity.value = 0;
        // A JS effect can't stamp the UI clock, so the zero above reads as "the last
        // report was at time zero" — i.e. hours ago. Parking the tracker makes the next
        // frame re-seed both from the real clock instead of extrapolating from that.
        trackingSuspended.value = true;
        lastSeenTransportUpdate.value = transportUpdateToken.value;
        awaitingPlayStartClock.value = false;
        // A settle window left over from the outgoing clip would otherwise keep the new
        // one's reports locked out for its remainder.
        scrubSettleUntil.value = 0;
        pauseHoldUntil.value = 0;
        pauseHoldProgress.value = resetProgress;
        pauseAnchorActive.value = false;
    }, [resetKey]);

    useEffect(() => {
        if (canvasWidth > 0 && baseContentWidth > 0) {
            // Fit the whole wave to the canvas — only when the parent doesn't drive the
            // scale itself (AudioReel does; a bare visualizer doesn't).
            if (!sharedScale) {
                scale.value = canvasWidth / baseContentWidth;
            }
        }
    }, [canvasWidth, baseContentWidth]);

    useFrameCallback((frameInfo) => {
        // Stamped before the duration guard: gesture worklets schedule against this
        // clock, and a scrub that settles while the duration is still unknown would
        // otherwise anchor its settle window to zero and never hold.
        frameNow.value = frameInfo.timestamp;

        const duration = durationMsValue.value;
        if (duration <= 0) return;

        // The post-scrub hold exists to cover the native seek latency, and the engine tells
        // us when that is over: the source-position gate publishes the seek TARGET until the
        // engine's own clock reaches it, and bumps this token on the report where it does.
        // Holding for a fixed 330ms after that is just the tape standing still while audio
        // plays — a debt it then has to pay off. SCRUB_SETTLE_MS stays as the timeout for a
        // landing that never comes (or a transport the channel doesn't drive).
        if (seekLandedToken.value !== lastSeenSeekLanded.value) {
            lastSeenSeekLanded.value = seekLandedToken.value;
            if (frameInfo.timestamp < scrubSettleUntil.value) {
                scrubSettleUntil.value = 0;
            }
        }

        const scrubVisualLockActive =
            isDragging.value ||
            isScrubbingShared.value ||
            frameInfo.timestamp < scrubSettleUntil.value;

        if (
            sharedPauseHoldMs &&
            sharedPauseHoldToken &&
            sharedPauseHoldToken.value !== lastSeenPauseHoldToken.value
        ) {
            lastSeenPauseHoldToken.value = sharedPauseHoldToken.value;
            const holdMs = sharedPauseHoldMs.value;
            if (holdMs >= 0) {
                const holdProgress = Math.max(0, Math.min(1, holdMs / duration));
                cancelAnimation(audioProgress);
                audioProgress.value = holdProgress;
                reportBaseProgress.value = holdProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                pauseHoldProgress.value = holdProgress;
                pauseHoldUntil.value = frameInfo.timestamp + PAUSE_VISUAL_HOLD_MS;
                pauseAnchorActive.value = true;
                awaitingPlayStartClock.value = false;
                progressVelocity.value = 0;
            }
        }

        if (isPlayingShared.value !== lastPlayingState.value) {
            lastPlayingState.value = isPlayingShared.value;
            playingStateChangedAt.value = frameInfo.timestamp;
            awaitingPlayStartClock.value = isPlayingShared.value;

            if (scrubVisualLockActive) {
                pauseHoldUntil.value = 0;
                pauseAnchorActive.value = false;
                reportBaseProgress.value = audioProgress.value;
                reportFrameTimestamp.value = frameInfo.timestamp;
                progressVelocity.value = 0;
            } else if (!isPlayingShared.value) {
                const heldProgress = audioProgress.value;
                awaitingPlayStartClock.value = false;
                pauseHoldProgress.value = heldProgress;
                pauseHoldUntil.value = frameInfo.timestamp + PAUSE_VISUAL_HOLD_MS;
                pauseAnchorActive.value = true;
                cancelAnimation(audioProgress);
                audioProgress.value = heldProgress;
                reportBaseProgress.value = heldProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                progressVelocity.value = 0;
            } else {
                pauseAnchorActive.value = false;
                pauseHoldUntil.value = 0;
                // Read before cancelling any in-flight fling, so the resume anchors on
                // the position the tape is actually showing.
                const resumeProgress = audioProgress.value;
                cancelAnimation(audioProgress);
                audioProgress.value = resumeProgress;
                reportBaseProgress.value = resumeProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                // Seed the tracker at the nominal rate so the first frames of playback
                // move at speed instead of accelerating up from a standstill.
                progressVelocity.value = playbackRateShared.value / duration;
            }
        }

        // The pause anchor is a WINDOW, not a latch. It exists to swallow the report
        // storm from the corrective seek the player fires at pause time (PlayerScreen's
        // pauseFullPlayerAtVisiblePosition), and then it has to let go. Without this the
        // anchor stayed set for the whole pause and every later report was ignored — so a
        // seek while paused that doesn't write audioProgress itself (the transport skip
        // buttons, a marker or loop jump) left the playhead sitting where the pause left
        // it. PAUSE_VISUAL_HOLD_MS has never actually run; treat it as a starting point
        // for the device pass, not a tuned number.
        if (pauseAnchorActive.value && frameInfo.timestamp >= pauseHoldUntil.value) {
            pauseAnchorActive.value = false;
            pauseHoldUntil.value = 0;
        }

        if (transportUpdateToken.value !== lastSeenTransportUpdate.value) {
            lastSeenTransportUpdate.value = transportUpdateToken.value;
            if (scrubVisualLockActive) {
                reportBaseProgress.value = audioProgress.value;
                reportFrameTimestamp.value = frameInfo.timestamp;
                return;
            }

            const reportedProgress = Math.max(0, Math.min(1, currentTimeMsValue.value / duration));
            const previousProgress = audioProgress.value;
            const progressDelta = reportedProgress - previousProgress;
            const recentlyStartedPlaying =
                isPlayingShared.value &&
                frameInfo.timestamp - playingStateChangedAt.value < PLAY_START_STATUS_GRACE_MS;
            const stalePlayStartForwardProgress = Math.min(0.08, PLAY_START_STALE_FORWARD_MS / duration);

            if (pauseAnchorActive.value) {
                reportBaseProgress.value = pauseHoldProgress.value;
                reportFrameTimestamp.value = frameInfo.timestamp;
                return;
            }

            // First believable report after a seek: LAND on it. The engine-side hold has
            // been publishing the seek target until a genuine landing arrived, so this
            // value is where the audio actually is — not something to converge toward.
            if (adoptNextReport.value) {
                adoptNextReport.value = false;
                awaitingPlayStartClock.value = false;
                cancelAnimation(audioProgress);
                audioProgress.value = reportedProgress;
                reportBaseProgress.value = reportedProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                progressVelocity.value = isPlayingShared.value
                    ? playbackRateShared.value / duration
                    : 0;
                return;
            }

            if (awaitingPlayStartClock.value && isPlayingShared.value) {
                const minimumAdvancingProgress = Math.min(0.01, Math.max(0.0005, 12 / duration));
                const resumeAlignmentProgress = Math.max(0.0005, 18 / duration);
                const playStartWaitMs = frameInfo.timestamp - playingStateChangedAt.value;
                const isAtStart = previousProgress <= minimumAdvancingProgress;
                const clockHasAdvanced =
                    isAtStart
                        ? reportedProgress > minimumAdvancingProgress
                        : reportedProgress + resumeAlignmentProgress >= previousProgress;
                const waitTimedOut = playStartWaitMs >= PLAY_START_STATUS_GRACE_MS;

                if (!clockHasAdvanced && !waitTimedOut) {
                    reportBaseProgress.value = previousProgress;
                    reportFrameTimestamp.value = frameInfo.timestamp;
                    return;
                }

                awaitingPlayStartClock.value = false;
                const releaseProgress = isAtStart ? reportedProgress : previousProgress;
                cancelAnimation(audioProgress);
                audioProgress.value = releaseProgress;
                reportBaseProgress.value = releaseProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                progressVelocity.value = playbackRateShared.value / duration;
                return;
            }

            awaitingPlayStartClock.value = false;
            if (recentlyStartedPlaying && progressDelta > stalePlayStartForwardProgress) {
                reportBaseProgress.value = previousProgress;
                reportFrameTimestamp.value = frameInfo.timestamp;
                return;
            }

            const hardForwardSnapProgress = Math.min(0.18, HARD_FORWARD_SNAP_MS / duration);
            const backwardSnapProgress = Math.min(0.02, BACKWARD_SNAP_MS / duration);
            const shouldSnap =
                !isPlayingShared.value ||
                progressDelta < -backwardSnapProgress ||
                (!recentlyStartedPlaying && progressDelta > hardForwardSnapProgress);

            reportFrameTimestamp.value = frameInfo.timestamp;

            if (shouldSnap) {
                cancelAnimation(audioProgress);
                audioProgress.value = reportedProgress;
                reportBaseProgress.value = reportedProgress;
                progressVelocity.value = isPlayingShared.value
                    ? playbackRateShared.value / duration
                    : 0;
            } else if (recentlyStartedPlaying) {
                // The first reports after pressing play are often stale by a frame or
                // two; ease onto them rather than believing them outright.
                const correctedProgress = Math.max(
                    0,
                    Math.min(1, previousProgress + progressDelta * PLAY_START_CORRECTION_FACTOR)
                );
                reportBaseProgress.value = correctedProgress;
            } else {
                // Steady state: the report IS the target. It arrives as a staircase, but
                // the tracker below extrapolates it back into the ramp the audio is
                // actually walking and folds the difference in as a small residual — so
                // no report ever restarts the scroll from a standstill.
                reportBaseProgress.value = reportedProgress;
            }
        }

        if (
            scrubVisualLockActive ||
            pauseAnchorActive.value ||
            !isPlayingShared.value ||
            awaitingPlayStartClock.value
        ) {
            trackingSuspended.value = true;
            progressVelocity.value = 0;
            return;
        }

        const frameDeltaMs = frameInfo.timeSincePreviousFrame ?? 16;
        if (frameDeltaMs <= 0) return;

        // First frame back after a scrub, a pause, or a count-in: hand the tracker the
        // nominal rate and the position it is already showing. Letting it build velocity
        // from zero instead would read as the tape easing in every time.
        if (trackingSuspended.value) {
            trackingSuspended.value = false;
            progressVelocity.value = playbackRateShared.value / duration;
            reportBaseProgress.value = audioProgress.value;
            reportFrameTimestamp.value = frameInfo.timestamp;
            return;
        }

        const nominalVelocity = playbackRateShared.value / duration;
        const elapsedSinceReport = Math.max(0, frameInfo.timestamp - reportFrameTimestamp.value);
        const reportedProgress = Math.max(0, Math.min(1, currentTimeMsValue.value / duration));
        // The reported clock, extrapolated forward at the nominal rate: a straight line,
        // which is what the audio is actually doing between reports.
        const targetProgress = Math.min(
            1,
            reportBaseProgress.value + elapsedSinceReport * nominalVelocity
        );
        const tracked = advanceTracker(
            audioProgress.value,
            progressVelocity.value,
            targetProgress,
            frameDeltaMs,
            {
                tauMs: TRACKING_TAU_MS,
                maxVelocity: nominalVelocity * MAX_TRACKING_VELOCITY_FACTOR,
                maxStepRate: nominalVelocity * MAX_CATCHUP_VELOCITY_FACTOR,
                // A residual this large isn't tracking error, it's a jump (a stall
                // recovering, a seek the report branch didn't catch).
                resyncDistance: TRACKING_RESYNC_PROGRESS,
                resyncVelocity: nominalVelocity,
            }
        );
        progressVelocity.value = tracked.velocity;
        // Coasting is bounded: a genuine stall parks the tape instead of running away.
        const leadCeiling = reportedProgress + PREDICTOR_MAX_LEAD_MS / duration;
        audioProgress.value = Math.max(0, Math.min(1, Math.min(tracked.position, leadCeiling)));
    });

    // Handle Scrubbing Gestures
    const pan = Gesture.Pan()
        .onStart(() => {
            cancelAnimation(audioProgress);
            isDragging.value = true;
            awaitingPlayStartClock.value = false;
            pauseHoldUntil.value = 0;
            pauseAnchorActive.value = false;
            scrubSettleUntil.value = 0;
            adoptNextReport.value = false;
            progressVelocity.value = 0;
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
                scrubSettleUntil.value = frameNow.value + SCRUB_SETTLE_MS;
                // The seek about to be committed is a discontinuity: land on where the
                // engine reports from, don't chase it.
                adoptNextReport.value = true;
                progressVelocity.value = 0;
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

    // Dynamic bounded rules — the tape's scroll offset.
    //
    // A frame callback rather than a derived value, to close an ordering hazard. Reanimated
    // orders mappers by the inputs and outputs they DECLARE, and `translateX` is written
    // below as a side effect, so it is not this unit's declared output: nothing orders the
    // mappers that read it (the Skia canvas transform, `playheadX`, and every overlay's
    // `useAnimatedStyle`) after the one that writes it. A reader sorted before the writer
    // is marked dirty too late and repaints on the NEXT frame, so different consumers of
    // one value could sit a frame apart. Frame callbacks run before the mapper pass, so a
    // value written here is visible to every consumer in the same frame — and that holds
    // whichever order the two frame callbacks take, since either way all consumers read
    // one identical translateX per frame.
    //
    // Measured neutral on the overlay jitter (2026-07-29, iOS sim, frame-by-frame): that
    // has a different cause — see docs/product-plan/reel-smoothness-findings.md. This closes the hazard, nothing more.
    useFrameCallback(() => {
        if (canvasWidth === 0) return;
        // Read from the raw inputs rather than the `contentWidth`/`targetX` mappers, which
        // have not run yet this frame.
        const cw = baseContentWidth * scale.value;
        const tx = audioProgress.value * cw;
        const halfScreen = canvasWidth / 2;

        if (
            freezeSelectedRangeWhenFullyVisible &&
            sharedSelectedRangeStartMs &&
            sharedSelectedRangeEndMs &&
            durationMs > 0
        ) {
            const rangeStartX = (sharedSelectedRangeStartMs.value / durationMs) * cw;
            const rangeEndX = (sharedSelectedRangeEndMs.value / durationMs) * cw;
            const rangeWidth = Math.max(0, rangeEndX - rangeStartX);
            const currentMs = currentTimeMsValue.value;
            const isInsideRange =
                sharedSelectedRangeEndMs.value > sharedSelectedRangeStartMs.value &&
                currentMs >= sharedSelectedRangeStartMs.value &&
                currentMs <= sharedSelectedRangeEndMs.value;

            if (isInsideRange && rangeWidth > 0 && rangeWidth <= canvasWidth) {
                const desiredTranslate = canvasWidth / 2 - (rangeStartX + rangeWidth / 2);
                translateX.value = Math.max(Math.min(desiredTranslate, 0), canvasWidth - cw);
                return;
            }
        }

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

        if (
            freezeSelectedRangeWhenFullyVisible &&
            sharedSelectedRangeStartMs &&
            sharedSelectedRangeEndMs &&
            durationMs > 0
        ) {
            const rangeStartX = (sharedSelectedRangeStartMs.value / durationMs) * cw;
            const rangeEndX = (sharedSelectedRangeEndMs.value / durationMs) * cw;
            const rangeWidth = Math.max(0, rangeEndX - rangeStartX);
            const currentMs = currentTimeMsValue.value;
            const isInsideRange =
                sharedSelectedRangeEndMs.value > sharedSelectedRangeStartMs.value &&
                currentMs >= sharedSelectedRangeStartMs.value &&
                currentMs <= sharedSelectedRangeEndMs.value;

            if (isInsideRange && rangeWidth > 0 && rangeWidth <= canvasWidth) {
                return tx + translateX.value;
            }
        }

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

    const playheadRectX = useDerivedValue(() => playheadX.value - 2);

    // Same face the RN labels used (text.annotation). Null until loaded — the labels
    // simply aren't drawn for those first frames rather than popping in at a wrong size.
    // Content-space px per file-ms, matching what the ruler primitives use.
    const gridLabelPixelsPerMs = durationMs > 0 ? baseContentWidth / durationMs : 0;
    const gridLabelFont = useFont(
        require("@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf"),
        GRID_LABEL_FONT_SIZE
    );
    // Paragraph faces for USER text (section names). Heebo is the Hebrew fallback,
    // mirroring the app-level RTL font remap. Null until loaded; the chips wait.
    const sectionFontProvider = useFonts({
        "Plus Jakarta Sans": [
            require("@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf"),
        ],
        Heebo: [require("@expo-google-fonts/heebo/600SemiBold/Heebo_600SemiBold.ttf")],
    });

    const translateTransform = useDerivedValue(() => {
        return [{ translateX: translateX.value }];
    });

    const scaleTransform = useDerivedValue(() => {
        return [{ scaleX: scale.value }];
    });

    // Counter-scale stroke widths so lines don't get fat when zoomed
    const waveStrokeWidth = useDerivedValue(() => 2 / scale.value);
    const rulerStrokeWidth = useDerivedValue(() => 1.5 / scale.value);

    // Vertical geometry lives in a normalized space (amplitude -1..1 around y=0) and is
    // mapped to pixels by this transform. A height change is therefore a pure UI-thread
    // transform — it never rebuilds the wave path or re-renders the component.
    const waveVerticalTransform = useDerivedValue(() => {
        const centerY = heightSV.value / 2;
        const waveMaxHeight = Math.max(10, (centerY - WAVEFORM_EDGE_MARGIN_PX) * WAVEFORM_HEADROOM);
        return [{ translateY: centerY }, { scaleY: waveMaxHeight }];
    });
    const baselineY = useDerivedValue(() => heightSV.value / 2 - 0.5);
    // Reveals only the played (behind-the-playhead) portion, in content coordinates so
    // the two-tone split lands exactly under the playhead at any zoom/scroll.
    const playedClip = useDerivedValue(
        () => Skia.XYWHRect(0, 0, audioProgress.value * baseContentWidth, 100000),
        [baseContentWidth]
    );

    const { wavePath, rulerPath } = useMemo(() => {
        const wave = Skia.Path.Make();
        const ruler = Skia.Path.Make();

        // waveformPeaks is ALREADY absolute normalized amplitudes (0..1) from
        // `metersToWaveformPeaks` using absolute dBFS. Do NOT normalize against its own
        // max, or a silent room-tone clip would expand to full-height blocks. We apply a
        // fixed (clip-independent) display expansion so the compressed mid band reads with
        // dynamic range, then emit the wave in NORMALIZED amplitude (-1..1); the pixel
        // height + centering is applied by waveVerticalTransform.
        waveformPeaks.forEach((amp, i) => {
            const x = i * baseChunkWidth;
            const clamped = Math.max(0, Math.min(1, amp));
            const expanded =
                clamped <= WAVEFORM_DISPLAY_FLOOR
                    ? 0
                    : (clamped - WAVEFORM_DISPLAY_FLOOR) / (1 - WAVEFORM_DISPLAY_FLOOR);
            const scaleFactor = Math.min(1, Math.max(WAVEFORM_DISPLAY_MIN, expanded * WAVEFORM_DISPLAY_GAIN));
            wave.moveTo(x, -scaleFactor);
            wave.lineTo(x, scaleFactor);
        });

        // Quiet grid: sparse MAJOR ticks only, along the top edge. The interval is chosen
        // so majors stay >= MIN_MAJOR_VISUAL_PX apart at the fitted (1x) scale — zooming in
        // only spreads them further, so the old length/zoom-dependent picket fence is gone.
        const totalSeconds = durationMs / 1000 || 1;
        const pixelsPerSecondBase = baseContentWidth / totalSeconds;
        const visualPxPerSecond = canvasWidth > 0 ? canvasWidth / totalSeconds : pixelsPerSecondBase;
        const MIN_MAJOR_VISUAL_PX = 54;
        const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
        let tickInterval = intervals[intervals.length - 1];
        for (const iv of intervals) {
            if (iv * visualPxPerSecond >= MIN_MAJOR_VISUAL_PX) {
                tickInterval = iv;
                break;
            }
        }
        const TICK_HEIGHT = 7;
        for (let s = 0; s <= Math.ceil(totalSeconds); s += tickInterval) {
            const x = s * pixelsPerSecondBase;
            ruler.moveTo(x, 0);
            ruler.lineTo(x, TICK_HEIGHT);
        }

        return { wavePath: wave, rulerPath: ruler };
    }, [waveformPeaks, baseChunkWidth, durationMs, canvasWidth, baseContentWidth]);

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        setCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
        // Only used as a fallback when the parent doesn't drive an animated height.
        if (!sharedSurfaceHeight) {
            localSurfaceHeight.value = e.nativeEvent.layout.height;
        }
    };

    const waveColor = theme?.waveColor || "#C7B9AF";
    const wavePlayedColor = theme?.wavePlayedColor || colors.primary;
    const rulerColor = theme?.rulerColor || colors.borderMuted;
    const playheadColor = theme?.playheadColor || "#8b4f3b";
    const backgroundColor = theme?.backgroundColor || "transparent";

    return (
        <View style={[styles.container, { backgroundColor }]} onLayout={onLayout}>
            <GestureDetector gesture={pan}>
                <View style={StyleSheet.absoluteFill}>
                    {canvasWidth > 0 && (
                        <Canvas style={{ flex: 1 }}>
                            {/* Faint center baseline — uniform, so it neither scrolls nor rebuilds. */}
                            <Rect x={0} y={baselineY} width={canvasWidth} height={1} color={rulerColor} opacity={0.4} />
                            <Group transform={translateTransform}>
                                <Group transform={scaleTransform}>
                                    {sectionBands && sectionBands.length > 0 ? (
                                        <SectionBandOverlay
                                            heightValue={heightSV}
                                            bands={sectionBands}
                                            pixelsPerMs={durationMs > 0 ? baseContentWidth / durationMs : 0}
                                        />
                                    ) : null}
                                    {gridRuler ? (
                                        <GridRulerOverlay
                                            heightValue={heightSV}
                                            model={gridRuler}
                                            pixelsPerMs={durationMs > 0 ? baseContentWidth / durationMs : 0}
                                            inkColor={rulerColor}
                                        />
                                    ) : (
                                        // Clock ticks are the fallback ruler; when the take has a
                                        // beat grid, bars ARE the ruler — two rulers is noise.
                                        <Path
                                            path={rulerPath}
                                            color={rulerColor}
                                            style="stroke"
                                            strokeWidth={rulerStrokeWidth}
                                            opacity={0.7}
                                        />
                                    )}
                                    {/* Two-tone wave: muted ahead-of-playhead, terracotta played (clipped). */}
                                    <Group transform={waveVerticalTransform}>
                                        <Path
                                            path={wavePath}
                                            color={waveColor}
                                            style="stroke"
                                            strokeWidth={waveStrokeWidth}
                                        />
                                    </Group>
                                    <Group clip={playedClip}>
                                        <Group transform={waveVerticalTransform}>
                                            <Path
                                                path={wavePath}
                                                color={wavePlayedColor}
                                                style="stroke"
                                                strokeWidth={waveStrokeWidth}
                                            />
                                        </Group>
                                    </Group>
                                    {practiceMarkers && practiceMarkers.length > 0 ? (
                                        <PinMarkerOverlay
                                            heightValue={heightSV}
                                            markers={practiceMarkers}
                                            pixelsPerMs={durationMs > 0 ? baseContentWidth / durationMs : 0}
                                        />
                                    ) : null}
                                </Group>
                                {/* Bar numbers ride the tape's own transform — inside the
                                    translate, outside the scale so the glyphs keep their
                                    shape while their positions follow the zoom. */}
                                {gridRuler && gridLabelFont ? (
                                    <>
                                        <Group opacity={GRID_BAR_LABEL_OPACITY}>
                                            {gridRuler.barLabels.map((label) => (
                                                <SkiaText
                                                    key={`bar-${label.bar}`}
                                                    x={label.ms * gridLabelPixelsPerMs * gridLabelScale + GRID_LABEL_INSET_X}
                                                    y={GRID_LABEL_BASELINE_Y}
                                                    text={String(label.bar)}
                                                    font={gridLabelFont}
                                                    color={gridLabelColor ?? rulerColor}
                                                />
                                            ))}
                                        </Group>
                                        <Group opacity={GRID_CHANGE_LABEL_OPACITY}>
                                            {gridRuler.changeMarkers.map((marker) => (
                                                <SkiaText
                                                    key={`change-${marker.bar}`}
                                                    x={marker.ms * gridLabelPixelsPerMs * gridLabelScale + GRID_LABEL_INSET_X}
                                                    y={GRID_LABEL_BASELINE_Y}
                                                    text={marker.label}
                                                    font={gridLabelFont}
                                                    color={gridLabelColor ?? rulerColor}
                                                />
                                            ))}
                                        </Group>
                                    </>
                                ) : null}
                                {sectionBands && sectionBands.length > 0 && sectionFontProvider ? (
                                    <SectionLabelChipsOverlay
                                        bands={sectionBands}
                                        pixelsPerMs={durationMs > 0 ? baseContentWidth / durationMs : 0}
                                        labelScale={gridLabelScale}
                                        translateX={translateX}
                                        heightValue={heightSV}
                                        fontProvider={sectionFontProvider}
                                    />
                                ) : null}
                                {practiceMarkers && practiceMarkers.length > 0 && sectionFontProvider ? (
                                    <PinBadgeChipsOverlay
                                        markers={practiceMarkers}
                                        pixelsPerMs={durationMs > 0 ? baseContentWidth / durationMs : 0}
                                        labelScale={gridLabelScale}
                                        durationMs={durationMs}
                                        fontProvider={sectionFontProvider}
                                        sharedDraggingMarkerId={sharedDraggingMarkerId}
                                    />
                                ) : null}
                            </Group>
                            {sharedSelectedRangeStartMs && sharedSelectedRangeEndMs && selectedRanges?.[0] ? (
                                <LoopRangeOverlay
                                    durationMs={durationMs}
                                    baseContentWidth={baseContentWidth}
                                    heightValue={heightSV}
                                    scale={scale}
                                    translateX={translateX}
                                    sharedStartMs={sharedSelectedRangeStartMs}
                                    sharedEndMs={sharedSelectedRangeEndMs}
                                    rangeType={selectedRangeType}
                                />
                            ) : null}
                            <Rect
                                x={playheadRectX}
                                y={0}
                                width={4}
                                height={heightSV}
                                color={playheadColor}
                            />
                        </Canvas>
                    )}
                </View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "hidden",
        position: "relative",
    },
});
