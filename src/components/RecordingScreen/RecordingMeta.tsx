import React from "react";
import { View, Text, ScrollView } from "react-native";
import { styles } from "../../styles";
import { fmt } from "../../utils";
import { AudioAnalysis } from "@siteed/expo-audio-studio";
import { LiveTapeVisualizer } from "../visualizers/LiveTapeVisualizer";

type Props = {
    ideaTitle: string;
    isRecording: boolean;
    isPaused: boolean;
    elapsedMs: number;
    analysisData?: AudioAnalysis;
    compact?: boolean;
};

export function RecordingMeta({ ideaTitle, isRecording, isPaused, elapsedMs, analysisData, compact = false }: Props) {
    const statusLabel = !isRecording ? "Ready" : isPaused ? "Paused" : "Recording...";

    // We don't need `boostedData` math—the AudioVisualizer handles it internally if we provide `amplitudeScaling`.

    return (
        <>
            <View style={[styles.card, compact ? styles.recordingMetaCardCompact : null]}>
                <Text style={styles.cardMeta}>{ideaTitle}</Text>
                <Text style={[styles.recordingTimer, compact ? styles.recordingTimerCompact : null]}>{fmt(elapsedMs)}</Text>
                <Text style={styles.cardMeta}>{statusLabel}</Text>
            </View>

            <View style={[styles.liveWaveWrap, compact ? styles.liveWaveWrapCompact : null]}>
                {analysisData ? (
                    <LiveTapeVisualizer
                        dataPoints={analysisData.dataPoints || []}
                        currentTimeMs={elapsedMs}
                        intervalMs={analysisData.segmentDurationMs || 50}
                        theme={{
                            waveColor: "#64748b",
                            rulerColor: "#9ca3af",
                            playheadColor: "#ef4444",
                        }}
                    />
                ) : null}
            </View>
        </>
    );
}
