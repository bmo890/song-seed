import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View, type LayoutChangeEvent } from "react-native";
import { colors } from "../../design/tokens";

type ScrubBarProps = {
    /** 0..1 playback position. */
    progress?: number;
    /** Commit-on-release with the final 0..1 fraction. */
    onScrub?: (fraction: number) => void;
    onScrubStart?: () => void;
    onScrubCancel?: () => void;
};

const TRACK_HEIGHT = 3;
const THUMB = 11;

/**
 * A thin, warm, draggable playback line — the compact card's inline scrubber.
 * Comfortable cards scrub on the waveform itself; compact has no waveform, so
 * the row extends to reveal this on-brand track (terracotta played fill + thumb
 * on a quiet technical-line rail), mirroring WaveformStrip / MiniProgress's
 * commit-pending PanResponder so releasing never snaps back.
 */
export const ScrubBar = React.memo(function ScrubBar({
    progress,
    onScrub,
    onScrubStart,
    onScrubCancel,
}: ScrubBarProps) {
    const [width, setWidth] = useState(0);
    const [dragFraction, setDragFraction] = useState<number | null>(null);
    const [isCommitPending, setIsCommitPending] = useState(false);

    const onLayout = (evt: LayoutChangeEvent) => {
        const next = evt.nativeEvent.layout.width;
        setWidth((prev) => (prev === next ? prev : next));
    };

    const scrubRef = useRef({ width, onScrub, onScrubStart, onScrubCancel });
    scrubRef.current = { width, onScrub, onScrubStart, onScrubCancel };

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

    const fraction = Math.max(0, Math.min(1, dragFraction ?? progress ?? 0));
    const filledWidth = width > 0 ? fraction * width : 0;

    return (
        <View
            style={{ height: THUMB + 8, justifyContent: "center" }}
            hitSlop={{ top: 10, bottom: 10 }}
            onLayout={onLayout}
            {...panResponder.panHandlers}
        >
            <View
                style={{
                    height: TRACK_HEIGHT,
                    borderRadius: TRACK_HEIGHT,
                    backgroundColor: colors.borderSubtle,
                    overflow: "hidden",
                }}
            >
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: filledWidth,
                        backgroundColor: colors.primary,
                        borderRadius: TRACK_HEIGHT,
                    }}
                />
            </View>
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    left: Math.max(0, filledWidth - THUMB / 2),
                    width: THUMB,
                    height: THUMB,
                    borderRadius: THUMB,
                    backgroundColor: colors.primary,
                    borderWidth: 2,
                    borderColor: colors.surface,
                }}
            />
        </View>
    );
});
