import React from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { fmtDuration } from "../../utils";
import { haptic } from "../../design/haptics";
import { AudioAnalysis } from "@siteed/audio-studio";
import { LiveTapeVisualizer } from "../visualizers/LiveTapeVisualizer";
import { MetronomeIcon } from "../common/MetronomeIcon";

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
    /** Let the meta section grow to fill (and center within) the leftover space. */
    fill?: boolean;
    /** Whether the project has lyrics — drives the reel height: no-lyrics gets a
     * tall centered reel, collapsed-lyrics fills, expanded gets the slim monitor. */
    hasLyrics?: boolean;
    /** Metronome control in the Ready row: the chip itself is the on/off toggle
     * (quiet icon when off, tempo chip when on); the small companion button opens
     * the settings sheet. */
    metronomeEnabled?: boolean;
    metronomeSummary?: string;
    metronomeToggleDisabled?: boolean;
    onToggleMetronome?: () => void;
    onOpenMetronome?: () => void;
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
    fill = false,
    hasLyrics = false,
    metronomeEnabled = false,
    metronomeSummary,
    metronomeToggleDisabled = false,
    onToggleMetronome,
    onOpenMetronome,
}: Props) {
    const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const clampedCurrentBar =
        countInBars > 0 ? Math.max(1, Math.min(countInBars, countInCurrentBar)) : 1;
    const clampedCurrentBeat =
        countInBeatsPerBar > 0 ? Math.max(0, Math.min(countInBeatsPerBar, countInCurrentBeat)) : 0;
    const countInDots = buildCountInDots(countInBeatsPerBar, clampedCurrentBeat);
    const statusLabel = isCountIn ? "Count-in" : !isRecording ? "Ready" : isPaused ? "Paused" : "Recording";
    const showActiveDot = isCountIn || (isRecording && !isPaused);

    const statusDot = (
        <View
            style={[
                styles.recordingStatusDot,
                showActiveDot ? styles.recordingStatusDotActive : styles.recordingStatusDotIdle,
            ]}
        />
    );

    const metronomeChip = onOpenMetronome ? (
        <View style={metaStyles.metroGroup}>
            <Pressable
                style={({ pressed }) => [
                    metronomeEnabled ? metaStyles.metroChipOn : metaStyles.metroChipOff,
                    metronomeToggleDisabled ? metaStyles.metroChipDisabled : null,
                    pressed ? styles.pressDown : null,
                ]}
                onPress={() => {
                    haptic.tap();
                    onToggleMetronome?.();
                }}
                disabled={metronomeToggleDisabled || !onToggleMetronome}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: metronomeEnabled }}
                accessibilityLabel={metronomeEnabled ? "Turn metronome off" : "Turn metronome on"}
            >
                <MetronomeIcon size={15} color={metronomeEnabled ? "#824f3f" : "#b6a79f"} />
                {metronomeEnabled && metronomeSummary ? (
                    <Text style={metaStyles.metroChipText}>{metronomeSummary}</Text>
                ) : null}
            </Pressable>
            <Pressable
                style={({ pressed }) => [metaStyles.metroCustomizeBtn, pressed ? styles.pressDown : null]}
                onPress={onOpenMetronome}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Metronome settings"
            >
                <Ionicons name="options-outline" size={14} color="#84736f" />
            </Pressable>
        </View>
    ) : null;

    return (
        <View style={[styles.recordingMetaSection, fill ? styles.recordingMetaSectionFill : null]}>
            {ideaTitle ? <Text style={styles.recordingIdeaLabel}>{ideaTitle}</Text> : null}

            {compact && !isCountIn ? (
                // Perform layout: timer · status · metronome consolidated to one row.
                <View style={metaStyles.compactHeaderRow}>
                    <Text style={[styles.recordingTimer, metaStyles.compactTimer]}>
                        {fmtDuration(safeElapsedMs)}
                    </Text>
                    <View style={metaStyles.compactStatus}>
                        {statusDot}
                        <Text style={styles.recordingStatusText}>{statusLabel}</Text>
                    </View>
                    <View style={metaStyles.compactSpacer} />
                    {metronomeChip}
                </View>
            ) : (
                <>
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

                    <View style={[styles.recordingStatusRow, metaStyles.statusRow]}>
                        <View style={metaStyles.statusLeft}>
                            {statusDot}
                            <Text style={styles.recordingStatusText}>{statusLabel}</Text>
                        </View>
                        {metronomeChip}
                    </View>
                </>
            )}

            <View
                style={[
                    styles.liveWaveWrap,
                    compact
                        ? styles.liveWaveWrapCompact
                        : hasLyrics
                        ? styles.liveWaveWrapFill
                        : styles.liveWaveWrapDefault,
                ]}
            >
                {waveformData ? (
                    <LiveTapeVisualizer
                        dataPoints={waveformData.dataPoints || []}
                        currentTimeMs={safeElapsedMs}
                        intervalMs={waveformData.segmentDurationMs || 50}
                        theme={{
                            waveColor: "#a89994",
                            rulerColor: "#D7C2BD",
                            playheadColor: "#B5483A",
                        }}
                    />
                ) : null}
            </View>
        </View>
    );
}

const metaStyles = StyleSheet.create({
    statusRow: {
        justifyContent: "space-between",
    },
    statusLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    compactHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        // Push the metronome chip out to the right screen edge, aligned with the
        // full-bleed reel below (which breaks out of the 28px gutter).
        marginRight: -28,
        paddingRight: 8,
    },
    compactTimer: {
        fontSize: 30,
        letterSpacing: -0.6,
    },
    compactStatus: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
    compactSpacer: {
        flex: 1,
    },
    metroChipOn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "#F2E4DF",
    },
    metroChipOff: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F4F1ED",
    },
    metroChipText: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 11,
        color: "#824f3f",
        fontVariant: ["tabular-nums"],
    },
    metroGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    metroChipDisabled: {
        opacity: 0.5,
    },
    metroCustomizeBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F4F1ED",
    },
});
