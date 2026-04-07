import React from "react";
import { View, Text } from "react-native";
import { styles } from "../../styles";
import { fmtDuration } from "../../utils";
import { AudioAnalysis } from "@siteed/audio-studio";
import { LiveTapeVisualizer } from "../visualizers/LiveTapeVisualizer";

type Props = {
    ideaTitle: string;
    isRecording: boolean;
    isPaused: boolean;
    elapsedMs: number;
    isCountIn?: boolean;
    countInBars?: number;
    countInCurrentBar?: number;
    countInCurrentBeat?: number;
    countInBeatsPerBar?: number;
    waveformData?: Pick<AudioAnalysis, "dataPoints" | "segmentDurationMs">;
    compact?: boolean;
};

function buildCountInDots(beatsPerBar: number, currentBeat: number) {
    return Array.from({ length: Math.max(0, beatsPerBar) }, (_, index) => index < currentBeat);
}

export function RecordingMeta({
    ideaTitle,
    isRecording,
    isPaused,
    elapsedMs,
    isCountIn = false,
    countInBars = 0,
    countInCurrentBar = 1,
    countInCurrentBeat = 0,
    countInBeatsPerBar = 0,
    waveformData,
    compact = false,
}: Props) {
    const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const clampedCurrentBar =
        countInBars > 0 ? Math.max(1, Math.min(countInBars, countInCurrentBar)) : 1;
    const clampedCurrentBeat =
        countInBeatsPerBar > 0 ? Math.max(0, Math.min(countInBeatsPerBar, countInCurrentBeat)) : 0;
    const countInDots = buildCountInDots(countInBeatsPerBar, clampedCurrentBeat);
    const statusLabel = isCountIn ? "Count-in" : !isRecording ? "Ready" : isPaused ? "Paused" : "Recording";
    const showActiveDot = isCountIn || (isRecording && !isPaused);

    return (
        <View style={styles.recordingMetaSection}>
            {ideaTitle ? <Text style={styles.recordingIdeaLabel}>{ideaTitle}</Text> : null}

            {isCountIn ? (
                <View style={styles.recordingCountInBlock}>
                    <Text style={[styles.recordingCountInTitle, compact ? styles.recordingCountInTitleCompact : null]}>
                        {countInBars > 1 ? `Count-in ${clampedCurrentBar}/${countInBars}` : "Count-in"}
                    </Text>
                    <View style={styles.recordingCountInDotsRow}>
                        {countInDots.map((isFilled, index) => (
                            <View
                                key={`count-in-dot-${index}`}
                                style={[
                                    styles.recordingCountInDot,
                                    compact ? styles.recordingCountInDotCompact : null,
                                    isFilled ? styles.recordingCountInDotActive : null,
                                ]}
                            />
                        ))}
                    </View>
                </View>
            ) : (
                <Text style={[styles.recordingTimer, compact ? styles.recordingTimerCompact : null]}>
                    {fmtDuration(safeElapsedMs)}
                </Text>
            )}

            <View style={styles.recordingStatusRow}>
                <View
                    style={[
                        styles.recordingStatusDot,
                        showActiveDot ? styles.recordingStatusDotActive : styles.recordingStatusDotIdle,
                    ]}
                />
                <Text style={styles.recordingStatusText}>{statusLabel}</Text>
            </View>

            <View style={[styles.liveWaveWrap, compact ? styles.liveWaveWrapCompact : null]}>
                {waveformData ? (
                    <LiveTapeVisualizer
                        dataPoints={waveformData.dataPoints || []}
                        currentTimeMs={safeElapsedMs}
                        intervalMs={waveformData.segmentDurationMs || 50}
                        theme={{
                            waveColor: "#6b7280",
                            rulerColor: "#a8afb8",
                            playheadColor: "#e45757",
                        }}
                    />
                ) : null}
            </View>
        </View>
    );
}
