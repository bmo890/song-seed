import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { colors } from "../../design/tokens";
import { useHeldScrubGesture } from "./useHeldScrubGesture";

type ScrubBarProps = {
    /** 0..1 playback position. */
    progress?: number;
    /** Commit-on-release with the final 0..1 fraction. */
    onScrub?: (fraction: number) => void;
    onScrubStart?: () => void;
    onScrubCancel?: () => void;
    /** The 0..1 fraction under the finger while it is held; `null` when the drag
     *  ends either way. Lets the row's elapsed caption follow the thumb. */
    onScrubPreview?: (fraction: number | null) => void;
};

const TRACK_HEIGHT = 3;
const THUMB = 11;

/**
 * A thin, warm, draggable playback line — the compact card's inline scrubber.
 * Comfortable cards scrub on the waveform itself; compact has no waveform, so
 * the row extends to reveal this on-brand track (terracotta played fill + thumb
 * on a quiet technical-line rail). The drag holds once grabbed, wherever the
 * thumb goes (useHeldScrubGesture), and the released position stays shown until
 * playback catches up to it, so releasing never snaps back.
 */
export const ScrubBar = React.memo(function ScrubBar({
    progress,
    onScrub,
    onScrubStart,
    onScrubCancel,
    onScrubPreview,
}: ScrubBarProps) {
    const [width, setWidth] = useState(0);
    const widthValue = useSharedValue(0);
    const [dragFraction, setDragFraction] = useState<number | null>(null);
    const [isCommitPending, setIsCommitPending] = useState(false);

    const onLayout = (evt: LayoutChangeEvent) => {
        const next = evt.nativeEvent.layout.width;
        widthValue.value = next;
        setWidth((prev) => (prev === next ? prev : next));
    };

    const scrubRef = useRef({ onScrub, onScrubStart, onScrubCancel, onScrubPreview });
    scrubRef.current = { onScrub, onScrubStart, onScrubCancel, onScrubPreview };

    useEffect(() => {
        if (dragFraction === null || !isCommitPending) return;
        if (progress === undefined || Math.abs(progress - dragFraction) > 0.04) return;
        setDragFraction(null);
        setIsCommitPending(false);
    }, [progress, dragFraction, isCommitPending]);

    const grab = useCallback(() => {
        setIsCommitPending(false);
        scrubRef.current.onScrubStart?.();
    }, []);
    const follow = useCallback((next: number) => {
        setDragFraction(next);
        scrubRef.current.onScrubPreview?.(next);
    }, []);
    const track = useCallback(
        (next: number) => {
            "worklet";
            runOnJS(follow)(next);
        },
        [follow]
    );
    const commit = useCallback((next: number) => {
        setDragFraction(next);
        setIsCommitPending(true);
        scrubRef.current.onScrub?.(next);
        scrubRef.current.onScrubPreview?.(null);
    }, []);
    const cancel = useCallback(() => {
        setDragFraction(null);
        setIsCommitPending(false);
        scrubRef.current.onScrubCancel?.();
        scrubRef.current.onScrubPreview?.(null);
    }, []);
    const pan = useHeldScrubGesture({
        width: widthValue,
        onTrack: track,
        onGrab: grab,
        onCommit: commit,
        onCancel: cancel,
    });

    const fraction = Math.max(0, Math.min(1, dragFraction ?? progress ?? 0));
    const filledWidth = width > 0 ? fraction * width : 0;

    return (
        <GestureDetector gesture={pan}>
        <View
            style={{ height: THUMB + 8, justifyContent: "center" }}
            onLayout={onLayout}
            // Claims the JS responder too, or the card's Pressable would show a
            // press under every scrub.
            onStartShouldSetResponder={claimResponder}
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
        </GestureDetector>
    );
});

const claimResponder = () => true;
