import React, { ReactNode } from "react";
import { SharedValue } from "react-native-reanimated";
import { AudioReel } from "../common/AudioReel";

type Props = {
    playerPosition: number;
    playerDuration: number;
    waveformPeaks: number[];
    isPlayerPlaying: boolean;
    isScrubbing?: boolean;
    compact?: boolean;
    topLeftContent?: ReactNode;
    chrome?: "dark" | "light";
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
    selectedRanges?: { id: string; start: number; end: number; type: "keep" | "remove" }[];
    renderOverlay?: (args: {
        pixelsPerMs: number;
        timelineTranslateX: SharedValue<number>;
        timelineScale: SharedValue<number>;
        sharedAudioProgress: SharedValue<number>;
    }) => ReactNode;
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
    chrome,
    showTransportControls,
    showExpandToggle,
    showZoomControls,
    showTimingRow,
    defaultExpanded,
    surfaceRadius,
    timelineHorizontalPadding,
    collapsedHeightOverride,
    expandedHeightOverride,
    showMinimapMode,
    minimapInteractive,
    selectedRanges,
    renderOverlay,
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
            chrome={chrome}
            showTransportControls={showTransportControls}
            showExpandToggle={showExpandToggle}
            showZoomControls={showZoomControls}
            showTimingRow={showTimingRow}
            defaultExpanded={defaultExpanded}
            surfaceRadius={surfaceRadius}
            timelineHorizontalPadding={timelineHorizontalPadding}
            collapsedHeightOverride={collapsedHeightOverride}
            expandedHeightOverride={expandedHeightOverride}
            showMinimapMode={showMinimapMode}
            minimapInteractive={minimapInteractive}
            selectedRanges={selectedRanges}
            renderOverlay={renderOverlay}
            onSeek={onSeekTo}
            onTogglePlay={onTogglePlay}
            onSeekToStart={() => onSeekTo(0)}
            onSeekToEnd={() => onSeekTo(playerDuration)}
            onScrubStateChange={onScrubStateChange}
        />
    );
}
