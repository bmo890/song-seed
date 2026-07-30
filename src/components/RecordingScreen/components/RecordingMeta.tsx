import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { fmtDuration } from "../../../utils";
import { haptic } from "../../../design/haptics";
import { AudioAnalysis } from "@siteed/audio-studio";
import { LiveTapeVisualizer } from "../../visualizers/LiveTapeVisualizer";
import { MetronomeIcon } from "../../common/MetronomeIcon";
import { radii, colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

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
    waveformData?: Pick<AudioAnalysis, "dataPoints" | "segmentDurationMs" | "durationMs">;
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
    liveTakeGrid?: { firstBeatCaptureMs: number; beatMs: number; pulsesPerBar: number } | null;
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
    liveTakeGrid = null,
    onToggleMetronome,
    onOpenMetronome,
    guideJoin = null,
}: Props) {
    const { t } = useTranslation();
    const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    // Stable identity: this screen re-renders on the take clock, and a fresh object here
    // would defeat the tape's memo on every one of those frames.
    const liveTapeTheme = React.useMemo(
        () => ({
            waveColor: colors.textMuted,
            rulerColor: colors.borderMuted,
            // Full record-red once the tape is moving; quieter while parked, so an idle
            // page doesn't announce something that isn't happening yet.
            playheadColor: isRecording ? colors.record : "rgba(192,69,59,0.45)",
        }),
        [isRecording]
    );

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
        joinBeatsLeft == null ? null : joinBeatsLeft > 0 ? t("recording.masterJoins", { count: joinBeatsLeft }) : t("recording.masterJoining");
    const clampedCurrentBar =
        countInBars > 0 ? Math.max(1, Math.min(countInBars, countInCurrentBar)) : 1;
    const clampedCurrentBeat =
        countInBeatsPerBar > 0 ? Math.max(0, Math.min(countInBeatsPerBar, countInCurrentBeat)) : 0;
    const countInDots = buildCountInDots(countInBeatsPerBar, clampedCurrentBeat);
    // During the count-in the big number carries "how many left", so the status
    // line carries the bar instead of repeating the word.
    const statusLabel = isCountIn
        ? countInBars > 1
            ? t("recording.countInProgress", { current: clampedCurrentBar, total: countInBars })
            : t("recording.countIn")
        : !isRecording
            ? t("recording.ready")
            : isPaused
                ? t("recording.paused")
                : t("recording.title");
    const showActiveDot = isCountIn || (isRecording && !isPaused);

    const statusDot = (
        <View
            style={[
                styles.recordingStatusDot,
                showActiveDot ? styles.recordingStatusDotActive : styles.recordingStatusDotIdle,
            ]}
        />
    );

    // Bare glyphs, not tinted circles: the record button is the only circle on
    // this page. The metronome's ON state reads from the terracotta glyph + its
    // summary, not from a pill around it.
    const metronomeChip = onOpenMetronome ? (
        <View style={metaStyles.metroGroup}>
            <Pressable
                style={({ pressed }) => [
                    metaStyles.metroToggle,
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
                accessibilityLabel={metronomeEnabled ? t("recording.turnMetronomeOff") : t("recording.turnMetronomeOn")}
            >
                <MetronomeIcon size={18} color={metronomeEnabled ? colors.primaryDeep : colors.textMuted} />
                {metronomeEnabled && metronomeSummary ? (
                    <Text style={metaStyles.metroChipText}>{metronomeSummary}</Text>
                ) : null}
            </Pressable>
            <Pressable
                style={({ pressed }) => [metaStyles.metroCustomize, pressed ? styles.pressDown : null]}
                onPress={onOpenMetronome}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("recording.metronomeSettings")}
            >
                <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
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
                            {/* The count lands where the clock is, at the clock's size,
                                in record-red — one place to look, and nothing moves
                                when the take starts and the timer takes over. */}
                            <Text
                                style={[
                                    styles.recordingTimer,
                                    compact ? styles.recordingTimerCompact : null,
                                    metaStyles.countInNumber,
                                ]}
                            >
                                {clampedCurrentBeat > 0 ? clampedCurrentBeat : countInBeatsPerBar}
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
                        liveGrid={liveTakeGrid}
                        dataPoints={waveformData.dataPoints || []}
                        captureNowMs={waveformData.durationMs ?? null}
                        intervalMs={waveformData.segmentDurationMs || 50}
                        theme={liveTapeTheme}
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
    countInNumber: {
        color: colors.record,
        fontVariant: ["tabular-nums"],
    },
    metroToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 30,
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
    metroCustomize: {
        minHeight: 30,
        justifyContent: "center",
    },
});
