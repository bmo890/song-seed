import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import type { TempoMap } from "../../../domain/tempoMap";
import { fmtDuration } from "../../../utils";
import { haptic } from "../../../design/haptics";
import { LiveTapeVisualizer } from "../../visualizers/LiveTapeVisualizer";
import { getActiveRecordingTakeSession, useTakeLiveWaveform } from "../../../services/recordingTakeSession";
import { MetronomeIcon } from "../../common/MetronomeIcon";
import { radii, colors, shadows } from "../../../design/tokens";
import { Press } from "../../common/Press";
import { useTranslation } from "react-i18next";
import { PIN_ICON, PIN_ICON_OUTLINE } from "../../../design/markIcons";

type Props = {
    ideaTitle: string;
    isRecording: boolean;
    isPaused: boolean;
    elapsedMs: number;
    isCountIn?: boolean;
    /** A punched layer's run-up: the song plays toward the start, nothing kept yet. */
    isPreRoll?: boolean;
    /** A layer's last seconds before the song ends and it stops itself. */
    layerTimeLeftMs?: number | null;
    countInBars?: number;
    countInCurrentBar?: number;
    countInCurrentBeat?: number;
    countInBeatsPerBar?: number;
    compact?: boolean;
    /** Let the meta section grow to fill (and center within) the leftover space. */
    fill?: boolean;
    /** Whether the project has lyrics — drives the reel height: no-lyrics gets a
     * tall centered reel, collapsed-lyrics fills, expanded gets the slim monitor. */
    hasLyrics?: boolean;
    /** A layer take: the take is written into the guide's own reel (TakeRegister),
     *  so this section draws no tape and no pin key of its own. */
    hasGuide?: boolean;
    /** Metronome control in the Ready row: the chip itself is the on/off toggle
     * (quiet icon when off, tempo chip when on); the small companion button opens
     * the settings sheet. */
    metronomeEnabled?: boolean;
    metronomeSummary?: string;
    metronomeToggleDisabled?: boolean;
    liveTakeGrid?: {
        firstBeatCaptureMs: number;
        beatMs: number;
        pulsesPerBar: number;
        tempoMap?: TempoMap | null;
    } | null;
    onToggleMetronome?: () => void;
    onOpenMetronome?: () => void;
    /** Pins dropped so far in this take (capture ms), drawn on the tape, and the
     *  one-tap drop. Absent on screens that can't pin (an overdub guide). */
    livePins?: { atMs: number }[];
    onAddPin?: () => void;
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
    isPreRoll = false,
    layerTimeLeftMs = null,
    countInBars = 0,
    countInCurrentBar = 1,
    countInCurrentBeat = 0,
    countInBeatsPerBar = 0,
    compact = false,
    fill = false,
    hasLyrics = false,
    hasGuide = false,
    metronomeEnabled = false,
    metronomeSummary,
    metronomeToggleDisabled = false,
    liveTakeGrid = null,
    onToggleMetronome,
    onOpenMetronome,
    livePins,
    onAddPin,
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
            pinColor: colors.textStrong,
        }),
        [isRecording]
    );
    // Stable for the same set of pins — the tape memoises on it.
    const pinTimes = React.useMemo(() => livePins?.map((pin) => pin.atMs) ?? [], [livePins]);
    const pinCount = pinTimes.length;

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
                : isPreRoll
                    ? t("recording.preRoll")
                    : layerTimeLeftMs != null
                        ? `${t("recording.title")} · ${t("recording.timeLeft", { time: fmtDuration(layerTimeLeftMs) })}`
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
    const pinButton = (
        <TakePinKey
            isRecording={isRecording}
            isPaused={isPaused}
            isCountIn={isCountIn}
            pinCount={pinCount}
            onAddPin={onAddPin}
        />
    );

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
                style={({ pressed }) => [
                    metaStyles.metroCustomize,
                    metronomeToggleDisabled ? metaStyles.metroChipDisabled : null,
                    pressed ? styles.pressDown : null,
                ]}
                onPress={onOpenMetronome}
                disabled={metronomeToggleDisabled}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("recording.metronomeSettings")}
            >
                <Ionicons
                    name="options-outline"
                    size={18}
                    color={metronomeToggleDisabled ? colors.textMuted : colors.textSecondary}
                />
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

            {hasGuide ? null : (
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
                    <LiveTakeTape liveGrid={liveTakeGrid} theme={liveTapeTheme} pins={pinTimes} />
                    {pinButton}
                </View>
            )}
        </View>
    );
}

/**
 * The pin (2026-10-17, founder: thumb-sized, quick to hit mid-rehearsal with the phone
 * beside you): a round key on the tape's bottom-right corner, where the playhead never
 * is and the thumb already rests. It appears once the take has started and stays through
 * pauses; while paused it's quiet and can't drop a mark (there's no live moment).
 */
export function TakePinKey({
    isRecording,
    isPaused,
    isCountIn,
    pinCount,
    onAddPin,
}: {
    isRecording: boolean;
    isPaused: boolean;
    isCountIn: boolean;
    pinCount: number;
    onAddPin?: () => void;
}) {
    const { t } = useTranslation();
    const canPin = isRecording && !isPaused && !isCountIn;
    const showPin = !!onAddPin && (isRecording || isPaused) && !isCountIn;
    if (!showPin) return null;
    return (
        <Press
            // Haptics vocabulary: light, a small state flip (a mark dropped).
            haptic="light"
            style={[metaStyles.pinKey, !canPin ? metaStyles.pinKeyIdle : null]}
            onPress={onAddPin}
            disabled={!canPin}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("recording.dropPin")}
            testID="recording-drop-pin"
        >
            <Ionicons
                name={pinCount > 0 ? PIN_ICON : PIN_ICON_OUTLINE}
                size={24}
                color={colors.textStrong}
            />
            {pinCount > 0 ? <Text style={metaStyles.pinKeyCount}>{pinCount}</Text> : null}
        </Press>
    );
}

const metaStyles = StyleSheet.create({
    pinKey: {
        position: "absolute",
        right: 16,
        bottom: 12,
        width: 58,
        height: 58,
        borderRadius: radii.round,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderMuted,
        ...shadows.control,
    },
    pinKeyIdle: {
        opacity: 0.5,
    },
    pinKeyCount: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 11,
        lineHeight: 13,
        marginTop: -2,
        color: colors.textSecondary,
        fontVariant: ["tabular-nums"],
    },
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

type LiveTakeTapeProps = {
    liveGrid: React.ComponentProps<typeof LiveTapeVisualizer>["liveGrid"];
    theme: React.ComponentProps<typeof LiveTapeVisualizer>["theme"];
    pins: number[];
};

/**
 * The one leaf that follows the take's live waveform. It subscribes to the take
 * session directly, so a new 40 ms segment re-renders this component and the tape
 * beneath it — not the recorder screen around it (2026-09-24).
 */
const LiveTakeTape = React.memo(function LiveTakeTape({ liveGrid, theme, pins }: LiveTakeTapeProps) {
    const waveform = useTakeLiveWaveform(getActiveRecordingTakeSession());
    return (
        <LiveTapeVisualizer
            liveGrid={liveGrid}
            dataPoints={waveform.dataPoints || []}
            captureNowMs={waveform.durationMs ?? null}
            intervalMs={waveform.segmentDurationMs || 50}
            pins={pins}
            theme={theme}
        />
    );
});
