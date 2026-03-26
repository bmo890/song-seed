import React from "react";
import { View, Text } from "react-native";
import { styles } from "../../styles";
import { fmtTenths } from "../../utils";
import { AudioAnalysis } from "@siteed/audio-studio";
import { LiveTapeVisualizer } from "../visualizers/LiveTapeVisualizer";

type Props = {
    ideaTitle: string;
    isRecording: boolean;
    isPaused: boolean;
    elapsedMs: number;
    waveformData?: Pick<AudioAnalysis, "dataPoints" | "segmentDurationMs">;
    compact?: boolean;
};

export function RecordingMeta({ ideaTitle, isRecording, isPaused, elapsedMs, waveformData, compact = false }: Props) {
    const statusLabel = !isRecording ? "Ready" : isPaused ? "Paused" : "Recording";
    const showActiveDot = isRecording && !isPaused;

    return (
        <View style={styles.recordingMetaSection}>
            {ideaTitle ? <Text style={styles.recordingIdeaLabel}>{ideaTitle}</Text> : null}

            <Text style={[styles.recordingTimer, compact ? styles.recordingTimerCompact : null]}>{fmtTenths(elapsedMs)}</Text>

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
                        currentTimeMs={elapsedMs}
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
