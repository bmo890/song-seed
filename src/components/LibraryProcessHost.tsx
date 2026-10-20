import { useEffect, useRef, useState } from "react";
import { springs } from "../design/motion";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../design/tokens";
import { BackgroundPill } from "./common/BackgroundPill";
import { formatBytes } from "../utils";
import { haptic } from "../design/haptics";
import { useStore } from "../state/useStore";
import {
    getProcessOverallFraction,
    getProcessSteps,
    useProcessStore,
    type LibraryProcess,
} from "../state/useProcessStore";
import { useTranslation } from "react-i18next";
import { i18n } from "../i18n/instance";
import { formatEta } from "../domain/sendProgress";

// Color is scarce (2026-10-20): the work in progress and the finished work
// both read in deep terracotta ink; only a failure takes danger red. The old
// green "success" and second red were outside the palette.
const DEEP = colors.primaryDeep;
const SUCCESS = colors.primaryDeep;
const ERROR = colors.danger;
const TERMINAL_AUTO_DISMISS_MS = 4000;

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
 * Data-processed + TOTAL time-left from the latest progress snapshot. Time left spans the
 * whole operation (via the overall fraction), so it counts down across every remaining pass
 * instead of resetting each phase. Computed fresh each render — the second tick advances it.
 */
function computeLiveStats(process: LibraryProcess) {
    const { completedBytes, totalBytes } = process.progress;
    const elapsedSec = Math.max(0.001, (Date.now() - process.startedAt) / 1000);
    const hasBytes = totalBytes > 0;
    const overall = getProcessOverallFraction(process);

    let etaLabel = "—";
    if (overall != null && overall >= 1) {
        etaLabel = i18n.t("common.almostDone");
    } else if (overall != null && overall > 0.02) {
        etaLabel = formatEta(Math.round((elapsedSec * (1 - overall)) / overall));
    }

    return {
        dataLabel: hasBytes ? `${formatBytes(completedBytes)} / ${formatBytes(totalBytes)}` : "—",
        etaLabel,
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
            {/* All connectors live in one layer BEHIND the nodes, so every opaque node caps the
                line at its edge — otherwise a later step's connector paints over the prior node. */}
            <View style={styles.timelineConnectorLayer} pointerEvents="none">
                {steps.map((step, index) => (
                    <View key={step.label} style={styles.timelineConnectorCell}>
                        {index > 0 ? (
                            <View
                                style={[
                                    styles.timelineConnector,
                                    { backgroundColor: step.state === "upcoming" ? colors.borderSubtle : accent },
                                ]}
                            />
                        ) : null}
                    </View>
                ))}
            </View>
            {steps.map((step, index) => (
                <View key={step.label} style={styles.timelineStepWrap}>
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
                            <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
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
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const reveal = useRef(new Animated.Value(0)).current;
    const terminal = process.status !== "running";
    useSecondTick(!terminal);
    const stats = computeLiveStats(process);
    const overall = getProcessOverallFraction(process);
    const percent = overall != null ? Math.round(overall * 100) : null;
    const accent = accentFor(process);
    const elapsedSec = (Date.now() - process.startedAt) / 1000;

    useEffect(() => {
        Animated.spring(reveal, { toValue: 1, useNativeDriver: true, ...springs.surface }).start();
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
                                    ? t("libraryProcess.done")
                                    : process.status === "error"
                                      ? t("libraryProcess.failed")
                                      : t("libraryProcess.cancelled")
                                : t(`libraryProcess.${process.kind}`)}
                        </Text>
                        <Text style={styles.sheetTitle}>{process.title}</Text>
                    </View>
                </View>

                {terminal ? (
                    <View style={styles.terminalBlock}>
                        <View style={[styles.terminalIcon, { backgroundColor: accent }]}>
                            <Ionicons
                                name={process.status === "success" ? "checkmark" : "close"}
                                size={30}
                                color={colors.onPrimary}
                            />
                        </View>
                        <Text style={styles.terminalMessage}>
                            {process.resultMessage ??
                                (process.status === "success" ? t("libraryProcess.finished") : t("libraryProcess.error"))}
                        </Text>
                        <Pressable style={styles.primaryBtn} onPress={onDismiss}>
                            <Text style={styles.primaryBtnText}>{t("libraryProcess.done")}</Text>
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

                        <View style={styles.statGridFull}>
                            <StatTile label={t("libraryProcess.data")} value={stats.dataLabel} />
                        </View>
                        <View style={styles.statGrid}>
                            <StatTile label={t("libraryProcess.timeLeft")} value={stats.etaLabel} />
                            <StatTile label={t("libraryProcess.elapsed")} value={formatClock(elapsedSec)} />
                        </View>

                        <Text style={styles.takeoverHint}>
                            {process.canCancel
                                ? t("libraryProcess.canMinimize")
                                : t("libraryProcess.finishing")}
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
                            <Text style={styles.minimizeBtnText}>{t("libraryProcess.minimize")}</Text>
                        </Pressable>
                        {process.canCancel ? (
                            <Pressable
                                style={({ pressed }) => [styles.cancelBtn, pressed ? { opacity: 0.7 } : null]}
                                onPress={onCancel}
                            >
                                <Text style={styles.cancelBtnText}>{t("libraryProcess.cancel")}</Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
            </Animated.View>
        </View>
    );
}

/** Root-mounted host: renders the active library process as a full-screen takeover or a minimized pill. */
export function LibraryProcessHost({ drawerOpen = false }: { drawerOpen?: boolean }) {
    const { t } = useTranslation();
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
        // The pill lives above the navigator in paint order, so it would otherwise sit on top
        // of the side menu. Hide it while the drawer is open (the takeover, being full-screen,
        // blocks the drawer from opening in the first place, so it never needs this).
        if (drawerOpen) return null;
        const base = playerDockHeight > 0 ? playerDockHeight + 8 : Math.max(insets.bottom, 14);
        const overall = getProcessOverallFraction(process);
        const terminal = process.status !== "running";
        return (
            <BackgroundPill
                title={`${t(`libraryProcess.${process.kind}`)}${overall != null && !terminal ? ` · ${Math.round(overall * 100)}%` : ""}`}
                subtitle={terminal ? process.resultMessage ?? t("libraryProcess.done") : process.progress.message}
                fraction={overall}
                terminal={terminal ? (process.status === "success" ? "success" : "error") : null}
                bottom={base + importBannerHeight}
                onPress={() => setMinimized(false)}
                accessibilityLabel={`${t(`libraryProcess.${process.kind}`)}. ${t("common.expand")}`}
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
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrow: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 10,
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    sheetTitle: {
        fontFamily: "Lora_600SemiBold",
        fontSize: 24,
        color: colors.textPrimary,
        marginTop: 2,
    },
    timelineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 26 },
    timelineStepWrap: { flex: 1, alignItems: "center" },
    // Background connector layer, aligned to the node row's top so segments sit at node centers.
    timelineConnectorLayer: { position: "absolute", left: 0, right: 0, top: 0, height: 26, flexDirection: "row" },
    timelineConnectorCell: { flex: 1 },
    // Anchored to node centers: right edge at this step's center, width one full step, so the
    // segment reaches back to the previous step's center. Opaque nodes above cap both ends.
    timelineConnector: { position: "absolute", top: 12, right: "50%", width: "100%", height: 2 },
    timelineNode: {
        width: 26,
        height: 26,
        borderRadius: radii.round,
        alignItems: "center",
        justifyContent: "center",
    },
    timelineActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onPrimary },
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
        fontFamily: "Lora_600SemiBold",
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
        backgroundColor: colors.borderSubtle,
        overflow: "hidden",
        marginBottom: 18,
    },
    progressFill: { height: "100%", borderRadius: 999 },
    statGridFull: { marginBottom: 8 },
    statGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
    statTile: {
        flexGrow: 1,
        flexBasis: "47%",
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
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
        borderRadius: radii.round,
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
});
