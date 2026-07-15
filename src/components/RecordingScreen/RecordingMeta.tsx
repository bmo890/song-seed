import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { fmtDuration } from "../../utils";
import { haptic } from "../../design/haptics";
import { AudioAnalysis } from "@siteed/audio-studio";
import { LiveTapeVisualizer } from "../visualizers/LiveTapeVisualizer";
import { MetronomeIcon } from "../common/MetronomeIcon";
import { radii, colors } from "../../design/tokens";

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
    /** No-count-in overdub: the master joins at the next bar line. Non-null while that
     * wait is pending; drives a visible beat countdown so the implicit lead-in reads as
     * intentional instead of a ghost count-in. */
    guideJoin?: { joinAtEpochMs: number; beatMs: number } | null;
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
    guideJoin = null,
}: Props) {
    const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;

    const [joinBeatsLeft, setJoinBeatsLeft] = useState<number | null>(null);
    useEffect(() => {
        if (!guideJoin) {
            setJoinBeatsLeft(null);
            return;
        }
        const tick = () => {
            const beats = Math.ceil(
                (guideJoin.joinAtEpochMs - Date.now()) / Math.max(1, guideJoin.beatMs)
            );
            setJoinBeatsLeft(Math.max(0, beats));
        };
        tick();
        const interval = setInterval(tick, 100);
        return () => clearInterval(interval);
    }, [guideJoin]);
    const joinLabel =
        joinBeatsLeft == null ? null : joinBeatsLeft > 0 ? `Master joins in ${joinBeatsLeft}` : "Master joining…";
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
                <MetronomeIcon size={15} color={metronomeEnabled ? colors.primaryDeep : "#b6a79f"} />
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
                <Ionicons name="options-outline" size={14} color={colors.textSecondary} />
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
                    {joinLabel ? <Text style={metaStyles.joinLabel}>{joinLabel}</Text> : null}
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
                            {joinLabel ? <Text style={metaStyles.joinLabel}>{joinLabel}</Text> : null}
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
                            waveColor: colors.textMuted,
                            rulerColor: colors.borderMuted,
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
        borderRadius: radii.round,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceContainer,
    },
    metroChipText: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 11,
        color: colors.primaryDeep,
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
    joinLabel: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 12,
        color: colors.primaryDeep,
        fontVariant: ["tabular-nums"],
    },
    metroCustomizeBtn: {
        width: 26,
        height: 26,
        borderRadius: radii.round,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceContainer,
    },
});
