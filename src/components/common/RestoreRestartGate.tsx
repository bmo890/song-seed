import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { reloadAppAsync } from "expo";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFullPlayerContext, useMiniPlayerContext } from "../../hooks/FullPlayerProvider";
import { colors, radii, shadows, spacing } from "../../design/tokens";
import { useStore } from "../../state/useStore";
import {
    getRestoreRestartState,
    markRestoreReloadFailed,
    markRestoreReloading,
    subscribeRestoreRestart,
} from "../../state/restoreRuntime";

export function RestoreRestartGate() {
    const restoreState = useSyncExternalStore(
        subscribeRestoreRestart,
        getRestoreRestartState,
        getRestoreRestartState
    );
    const fullPlayer = useFullPlayerContext();
    const miniPlayer = useMiniPlayerContext();
    const restartAttemptedRef = useRef(false);

    const restart = useCallback(async () => {
        if (!getRestoreRestartState() || getRestoreRestartState()?.reloadStatus === "reloading") {
            return;
        }

        markRestoreReloading();
        try {
            await Promise.allSettled([
                fullPlayer.closePlayer(),
                miniPlayer.resetInlinePlayer(),
            ]);
            const store = useStore.getState();
            store.clearPlayerQueue();
            store.clearRecordingContext();
            await reloadAppAsync("disaster-recovery-restore");
        } catch (error) {
            markRestoreReloadFailed(error);
        }
    }, [fullPlayer, miniPlayer]);

    useEffect(() => {
        if (!restoreState || restartAttemptedRef.current) return;
        restartAttemptedRef.current = true;
        void restart();
    }, [restart, restoreState]);

    if (!restoreState) return null;

    const { ideas, workspaces } = restoreState.counts;
    const summary =
        `${ideas} item${ideas === 1 ? "" : "s"} across ${workspaces} ` +
        `workspace${workspaces === 1 ? "" : "s"} restored.`;
    const isFailed = restoreState.reloadStatus === "failed";

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => {}}
        >
            <View style={styles.scrim}>
                <View style={styles.card} accessibilityViewIsModal>
                    <View style={styles.iconWrap}>
                        <Ionicons
                            name={isFailed ? "refresh" : "checkmark"}
                            size={24}
                            color={colors.primary}
                        />
                    </View>
                    <Text style={styles.title}>Restore complete</Text>
                    <Text style={styles.message}>
                        {summary}
                        {restoreState.missingCount > 0
                            ? ` ${restoreState.missingCount} optional file${restoreState.missingCount === 1 ? " was" : "s were"} not included.`
                            : ""}
                    </Text>
                    {isFailed ? (
                        <>
                            <Text style={styles.error}>
                                {restoreState.reloadError} Your restored library is safe, but the app must restart before you continue.
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Restart Song Seed"
                                style={({ pressed }) => [
                                    styles.restartButton,
                                    pressed ? styles.restartButtonPressed : null,
                                ]}
                                onPress={() => {
                                    restartAttemptedRef.current = true;
                                    void restart();
                                }}
                            >
                                <Ionicons name="refresh" size={17} color={colors.onPrimary} />
                                <Text style={styles.restartButtonText}>Restart Song Seed</Text>
                            </Pressable>
                        </>
                    ) : (
                        <View style={styles.restartingRow}>
                            <ActivityIndicator color={colors.primary} />
                            <Text style={styles.restartingText}>Restarting Song Seed...</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 36,
        backgroundColor: "rgba(28,28,25,0.55)",
    },
    card: {
        width: "100%",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xxl,
        borderRadius: radii.xl,
        backgroundColor: colors.page,
        ...shadows.drawer,
    },
    iconWrap: {
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 24,
        backgroundColor: colors.surfaceContainer,
    },
    title: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 18,
        color: colors.textPrimary,
        textAlign: "center",
    },
    message: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 13,
        lineHeight: 19,
        color: colors.textStrong,
        textAlign: "center",
    },
    error: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 12,
        lineHeight: 18,
        color: colors.textSecondary,
        textAlign: "center",
    },
    restartingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    restartingText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        color: colors.textSecondary,
    },
    restartButton: {
        minHeight: 46,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xl,
        borderRadius: radii.lg,
        backgroundColor: colors.primary,
    },
    restartButtonPressed: {
        opacity: 0.82,
    },
    restartButtonText: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 13,
        color: colors.onPrimary,
    },
});
