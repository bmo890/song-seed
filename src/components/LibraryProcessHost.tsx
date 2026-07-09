import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../design/tokens";
import { formatBytes } from "../utils";
import { haptic } from "../design/haptics";
import { useStore } from "../state/useStore";
import {
    getProcessPercent,
    getProcessSteps,
    useProcessStore,
    type LibraryProcess,
} from "../state/useProcessStore";

const DEEP = "#8b4f3b";
const SUCCESS = "#3F9C82";
const ERROR = "#B4574A";
const TERMINAL_AUTO_DISMISS_MS = 4000;

const EYEBROW: Record<LibraryProcess["kind"], string> = {
    backup: "Backing up",
    export: "Exporting",
    restore: "Restoring",
};

function accentFor(process: LibraryProcess): string {
    if (process.status === "success") return SUCCESS;
    if (process.status === "error") return ERROR;
    return DEEP;
}

/** Re-render once a second so Elapsed / Time left keep moving between progress commits. */
function useSecondTick(enabled: boolean) {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!enabled) return;
        const id = setInterval(() => setTick((value) => value + 1), 1000);
        return () => clearInterval(id);
    }, [enabled]);
}

function formatClock(totalSeconds: number) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Cumulative-average speed + ETA from the latest progress snapshot. Computed fresh on
 * every render — the second tick advances elapsed/ETA between progress commits.
 */
function computeLiveStats(process: LibraryProcess) {
    const { completedBytes, totalBytes } = process.progress;
    const elapsedSec = Math.max(0.001, (Date.now() - process.startedAt) / 1000);
    const hasBytes = totalBytes > 0;
    const bytesPerSec = hasBytes ? completedBytes / elapsedSec : 0;
    const remainingBytes = Math.max(0, totalBytes - completedBytes);
    const etaSec = bytesPerSec > 0 ? Math.round(remainingBytes / bytesPerSec) : null;
    return {
        hasBytes,
        dataLabel: hasBytes ? `${formatBytes(completedBytes)} / ${formatBytes(totalBytes)}` : "—",
        speedLabel: hasBytes && bytesPerSec > 0 ? `${formatBytes(bytesPerSec)}/s` : "—",
        etaLabel: etaSec != null ? (etaSec >= 60 ? `~${Math.ceil(etaSec / 60)} min` : `~${etaSec}s`) : "—",
    };
}

function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.statTile}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

function Timeline({ process }: { process: LibraryProcess }) {
    const steps = getProcessSteps(process);
    const accent = accentFor(process);
    return (
        <View style={styles.timelineRow}>
            {steps.map((step, index) => (
                <View key={step.label} style={styles.timelineStepWrap}>
                    {index > 0 ? (
                        <View
                            style={[
                                styles.timelineConnector,
                                { backgroundColor: step.state === "upcoming" ? "#E0D6CE" : accent },
                            ]}
                        />
                    ) : (
                        <View style={styles.timelineConnectorSpacer} />
                    )}
                    <View
                        style={[
                            styles.timelineNode,
                            step.state === "done" ? { backgroundColor: accent } : null,
                            step.state === "active" ? { backgroundColor: colors.primary } : null,
                            step.state === "upcoming"
                                ? { backgroundColor: colors.page, borderWidth: 1.5, borderColor: colors.borderMuted }
                                : null,
                        ]}
                    >
                        {step.state === "done" ? (
                            <Ionicons name="checkmark" size={15} color="#fff" />
                        ) : step.state === "active" ? (
                            <View style={styles.timelineActiveDot} />
                        ) : (
                            <Text style={styles.timelineNodeNum}>{index + 1}</Text>
                        )}
                    </View>
                    <Text
                        style={[
                            styles.timelineLabel,
                            step.state === "active" ? { color: DEEP, fontFamily: "PlusJakartaSans_700Bold" } : null,
                            step.state === "done" ? { color: colors.textStrong } : null,
                        ]}
                        numberOfLines={1}
                    >
                        {step.label}
                    </Text>
                </View>
            ))}
        </View>
    );
}

/**
 * Full-screen takeover for the running operation. Backup/export/restore contend for
 * storage and the JS thread, so while one runs the takeover is the honest default —
 * Minimize collapses it to the monitor pill for users who want to keep working.
 */
function ProcessTakeover({
    process,
    onMinimize,
    onCancel,
    onDismiss,
}: {
    process: LibraryProcess;
    onMinimize: () => void;
    onCancel: () => void;
    onDismiss: () => void;
}) {
    const insets = useSafeAreaInsets();
    const reveal = useRef(new Animated.Value(0)).current;
    const terminal = process.status !== "running";
    useSecondTick(!terminal);
    const stats = computeLiveStats(process);
    const percent = getProcessPercent(process);
    const accent = accentFor(process);
    const elapsedSec = (Date.now() - process.startedAt) / 1000;

    useEffect(() => {
        Animated.spring(reveal, { toValue: 1, useNativeDriver: true, tension: 80, friction: 14 }).start();
    }, [reveal]);

    const translateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

    return (
        <View style={[StyleSheet.absoluteFill, styles.takeoverRoot]}>
            <Animated.View
                style={[
                    styles.takeoverBody,
                    {
                        paddingTop: insets.top + 18,
                        paddingBottom: Math.max(insets.bottom, 14) + 6,
                        opacity: reveal,
                        transform: [{ translateY }],
                    },
                ]}
            >
                <View style={styles.sheetHeaderRow}>
                    <View style={styles.headerCopy}>
                        <Text style={[styles.eyebrow, { color: accent }]}>
                            {terminal
                                ? process.status === "success"
                                    ? "Done"
                                    : process.status === "error"
                                      ? "Couldn't finish"
                                      : "Cancelled"
                                : EYEBROW[process.kind]}
                        </Text>
                        <Text style={styles.sheetTitle}>{process.title}</Text>
                    </View>
                    {!terminal ? (
                        <Pressable
                            style={({ pressed }) => [styles.headerBtn, pressed ? { opacity: 0.6 } : null]}
                            onPress={onMinimize}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Minimize"
                        >
                            <Ionicons name="chevron-down" size={18} color={colors.textStrong} />
                        </Pressable>
                    ) : null}
                </View>

                {terminal ? (
                    <View style={styles.terminalBlock}>
                        <View style={[styles.terminalIcon, { backgroundColor: accent }]}>
                            <Ionicons
                                name={process.status === "success" ? "checkmark" : "close"}
                                size={30}
                                color="#fff"
                            />
                        </View>
                        <Text style={styles.terminalMessage}>
                            {process.resultMessage ??
                                (process.status === "success" ? "Finished." : "Something went wrong.")}
                        </Text>
                        <Pressable style={styles.primaryBtn} onPress={onDismiss}>
                            <Text style={styles.primaryBtnText}>Done</Text>
                        </Pressable>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.takeoverScroll}
                        contentContainerStyle={styles.takeoverScrollContent}
                        bounces={false}
                    >
                        <Timeline process={process} />

                        <View style={styles.bigPercentBlock}>
                            <Text style={[styles.bigPercent, { color: DEEP }]}>
                                {percent != null ? `${percent}%` : "…"}
                            </Text>
                            <Text style={styles.progressMessage} numberOfLines={1}>
                                {process.progress.message}
                            </Text>
                        </View>

                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: colors.primary, width: `${percent ?? 12}%` },
                                    percent == null ? { opacity: 0.5 } : null,
                                ]}
                            />
                        </View>

                        <View style={styles.statGrid}>
                            <StatTile label="Data" value={stats.dataLabel} />
                            <StatTile label="Speed" value={stats.speedLabel} />
                            <StatTile label="Time left" value={stats.etaLabel} />
                            <StatTile label="Elapsed" value={formatClock(elapsedSec)} />
                        </View>

                        <Text style={styles.takeoverHint}>
                            {process.canCancel
                                ? "Minimize to keep using the app — the process keeps running and you can return to it from the pill."
                                : "Finishing a step that can't be interrupted…"}
                        </Text>
                    </ScrollView>
                )}

                {!terminal ? (
                    <View style={styles.actionRow}>
                        <Pressable
                            style={({ pressed }) => [styles.minimizeBtn, pressed ? { opacity: 0.7 } : null]}
                            onPress={onMinimize}
                        >
                            <Ionicons name="chevron-down" size={16} color={colors.textStrong} />
                            <Text style={styles.minimizeBtnText}>Minimize</Text>
                        </Pressable>
                        {process.canCancel ? (
                            <Pressable
                                style={({ pressed }) => [styles.cancelBtn, pressed ? { opacity: 0.7 } : null]}
                                onPress={onCancel}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
            </Animated.View>
        </View>
    );
}

function MonitorPill({
    process,
    onExpand,
    bottom,
}: {
    process: LibraryProcess;
    onExpand: () => void;
    bottom: number;
}) {
    const percent = getProcessPercent(process);
    const accent = accentFor(process);
    const terminal = process.status !== "running";
    const R = 13;
    const CIRC = 2 * Math.PI * R;
    const pct = percent ?? 0;

    return (
        // box-none + a self-sized pill: taps outside the pill itself must pass through to
        // the app (record button, drawer, tabs) — the pill only ever owns its own pixels.
        <View style={[styles.pillWrap, { bottom }]} pointerEvents="box-none">
            <Pressable
                style={({ pressed }) => [styles.pill, pressed ? { opacity: 0.85 } : null]}
                onPress={onExpand}
                accessibilityRole="button"
                accessibilityLabel={`${EYEBROW[process.kind]}, tap to expand`}
            >
                <View style={styles.pillRing}>
                    {terminal ? (
                        <View style={[styles.pillTerminalDot, { backgroundColor: accent }]}>
                            <Ionicons
                                name={process.status === "success" ? "checkmark" : "close"}
                                size={16}
                                color="#fff"
                            />
                        </View>
                    ) : (
                        <Svg width={30} height={30}>
                            <Circle cx={15} cy={15} r={R} stroke="#EDE4DE" strokeWidth={4} fill="none" />
                            <Circle
                                cx={15}
                                cy={15}
                                r={R}
                                stroke={colors.primary}
                                strokeWidth={4}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={CIRC}
                                strokeDashoffset={CIRC * (1 - Math.max(0.04, pct / 100))}
                                transform="rotate(-90 15 15)"
                            />
                        </Svg>
                    )}
                </View>
                <View style={styles.pillCopy}>
                    <Text style={styles.pillTitle} numberOfLines={1}>
                        {EYEBROW[process.kind]}
                        {percent != null && !terminal ? ` · ${percent}%` : ""}
                    </Text>
                    <Text style={styles.pillSubtitle} numberOfLines={1}>
                        {terminal ? process.resultMessage ?? "Done" : process.progress.message}
                    </Text>
                </View>
                <Ionicons name="chevron-up" size={16} color={colors.textStrong} />
            </Pressable>
        </View>
    );
}

/** Root-mounted host: renders the active library process as a full-screen takeover or a minimized pill. */
export function LibraryProcessHost() {
    const process = useProcessStore((s) => s.process);
    const setMinimized = useProcessStore((s) => s.setMinimized);
    const requestCancel = useProcessStore((s) => s.requestCancel);
    const dismiss = useProcessStore((s) => s.dismiss);
    const playerDockHeight = useStore((s) => s.playerDockHeight);
    const importBannerHeight = useStore((s) => s.importBannerHeight);
    const insets = useSafeAreaInsets();

    // Terminal states linger briefly as confirmation, then clear themselves.
    useEffect(() => {
        if (!process || process.status === "running") return;
        const id = process.id;
        const timer = setTimeout(() => dismiss(id), TERMINAL_AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [process, dismiss]);

    if (!process) return null;

    if (process.minimized) {
        const base = playerDockHeight > 0 ? playerDockHeight + 8 : Math.max(insets.bottom, 14);
        return (
            <MonitorPill
                process={process}
                bottom={base + importBannerHeight}
                onExpand={() => {
                    haptic.tap();
                    setMinimized(false);
                }}
            />
        );
    }

    return (
        <ProcessTakeover
            process={process}
            onMinimize={() => {
                haptic.tap();
                setMinimized(true);
            }}
            onCancel={() => {
                haptic.light();
                requestCancel();
            }}
            onDismiss={() => dismiss(process.id)}
        />
    );
}

const styles = StyleSheet.create({
    takeoverRoot: { backgroundColor: colors.page, zIndex: 60 },
    takeoverBody: { flex: 1, paddingHorizontal: 20 },
    takeoverScroll: { flex: 1 },
    takeoverScrollContent: { paddingTop: 10, paddingBottom: 12 },
    sheetHeaderRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 18,
    },
    headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
    eyebrow: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 10,
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    sheetTitle: {
        fontFamily: "PlayfairDisplay_600SemiBold",
        fontSize: 24,
        color: colors.textPrimary,
        marginTop: 2,
    },
    headerBtn: {
        width: 32,
        height: 32,
        borderRadius: radii.round,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        alignItems: "center",
        justifyContent: "center",
    },
    timelineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 26, marginHorizontal: 2 },
    timelineStepWrap: { flex: 1, alignItems: "center" },
    timelineConnector: { position: "absolute", top: 12, left: -50, right: 50, height: 2 },
    timelineConnectorSpacer: { height: 2 },
    timelineNode: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
    },
    timelineActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
    timelineNodeNum: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 11,
        color: colors.textMuted,
    },
    timelineLabel: {
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 4,
    },
    bigPercentBlock: { alignItems: "center", marginBottom: 14 },
    bigPercent: {
        fontFamily: "PlayfairDisplay_600SemiBold",
        fontSize: 52,
        lineHeight: 60,
        fontVariant: ["tabular-nums"],
    },
    progressMessage: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    progressTrack: {
        height: 6,
        borderRadius: 999,
        backgroundColor: "#E3D9D0",
        overflow: "hidden",
        marginBottom: 18,
    },
    progressFill: { height: "100%", borderRadius: 999 },
    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    statTile: {
        flexGrow: 1,
        flexBasis: "47%",
        backgroundColor: colors.surface,
        borderRadius: 10,
        paddingVertical: 11,
        paddingHorizontal: 12,
    },
    statLabel: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 10,
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    statValue: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 15,
        color: colors.textPrimary,
        fontVariant: ["tabular-nums"],
        marginTop: 1,
    },
    takeoverHint: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 12,
        lineHeight: 17,
        color: colors.textMuted,
        textAlign: "center",
        paddingHorizontal: 18,
    },
    actionRow: { flexDirection: "row", gap: 8, paddingTop: 8 },
    minimizeBtn: {
        flex: 1,
        height: 46,
        borderRadius: radii.lg,
        backgroundColor: colors.surfaceHigh,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    minimizeBtnText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 14,
        color: colors.textStrong,
    },
    cancelBtn: {
        flex: 1,
        height: 46,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtnText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 14,
        color: colors.textSecondary,
    },
    terminalBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 60 },
    terminalIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    terminalMessage: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    primaryBtn: {
        alignSelf: "stretch",
        height: 48,
        borderRadius: radii.lg,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
    },
    primaryBtnText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 15, color: colors.onPrimary },
    // Self-sizing pill: the wrapper is box-none and the pill centers itself, so nothing
    // outside the pill's own bounds intercepts touches.
    pillWrap: { position: "absolute", left: 16, right: 16, zIndex: 55, alignItems: "center" },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        maxWidth: "100%",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        borderRadius: 14,
        paddingVertical: 9,
        paddingHorizontal: 12,
        shadowColor: "#3D3732",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    pillRing: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
    pillTerminalDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    pillCopy: { flexShrink: 1, minWidth: 0 },
    pillTitle: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        color: colors.textPrimary,
    },
    pillSubtitle: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 11,
        color: colors.textSecondary,
    },
});
