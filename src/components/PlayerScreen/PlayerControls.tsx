import React, { ReactNode } from "react";
import { AudioReel } from "../common/AudioReel";

type Props = {
    playerPosition: number;
    playerDuration: number;
    waveformPeaks: number[];
    isPlayerPlaying: boolean;
    isScrubbing?: boolean;
    compact?: boolean;
    topLeftContent?: ReactNode;
    onSeekTo: (ms: number) => void | Promise<void>;
    onTogglePlay: () => void;
    onScrubStateChange?: (scrubbing: boolean) => void;
};

export function PlayerControls({
    playerPosition,
    playerDuration,
    waveformPeaks,
    isPlayerPlaying,
    isScrubbing,
    compact,
    topLeftContent,
    onSeekTo,
    onTogglePlay,
    onScrubStateChange,
}: Props) {
    return (
        <AudioReel
            waveformPeaks={waveformPeaks}
            durationMs={playerDuration}
            currentTimeMs={playerPosition}
            isPlaying={isPlayerPlaying}
            isScrubbing={isScrubbing}
            compact={compact}
            zoomPlacement="top"
            topLeftContent={topLeftContent}
            onSeek={onSeekTo}
            onTogglePlay={onTogglePlay}
            onSeekToStart={() => onSeekTo(0)}
            onSeekToEnd={() => onSeekTo(playerDuration)}
            onScrubStateChange={onScrubStateChange}
        />
    );
}
