import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors, text } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { styles } from "../../styles";
import { i18n } from "../../i18n/instance";
import { recordCrash } from "../../services/crashLog";
import { clearCrashSetAside, writeCrashSetAside } from "../../services/crashSetAside";
import { buildExactLibraryBackup, saveBuiltLibraryBackup, BACKUP_SAVE_CANCELLED_MESSAGE } from "../../services/libraryBackup";
import { isBackupOperationCancelled } from "../../services/backupOperation";
import { useStore } from "../../state/useStore";

/** This screen renders outside every provider and must survive a broken i18n —
 *  translate when possible, fall back to the English literal when not. */
function safeT(key: string, fallback: string): string {
    try {
        const value = i18n.t(key);
        return typeof value === "string" && value.length > 0 && value !== key ? value : fallback;
    } catch {
        return fallback;
    }
}

/** The workspace on screen when the crash happened, if the store can say. */
function activeWorkspaceIdOrNull(): string | null {
    try {
        const id = useStore.getState().activeWorkspaceId;
        return typeof id === "string" ? id : null;
    } catch {
        return null;
    }
}

/**
 * Root error boundary: a render exception anywhere below this renders a calm
 * recovery screen instead of a white screen.
 *
 * A crash caused by something stored repeats wherever that thing is shown, so
 * Restart alone could loop forever (audit 2026-11-02, 09 H1). The screen offers
 * a way out that needs no other screen:
 *  - Back up: the same exact backup Settings makes (services/libraryBackup), saved
 *    through the system picker. It reads the store directly, no screens.
 *  - Open Home: remounts the app on the primary workspace, or the workspace list,
 *    never the workspace that was open (services/crashSetAside). A cold launch
 *    after a crash does the same.
 *  - Restart: remounts where the person was (for a crash that won't repeat).
 *
 * Deliberately self-contained: React, RN primitives, tokens and shared styles;
 * nothing that could itself be the thing that crashed.
 */

type BackupStatus = "idle" | "running" | "saved" | "failed";

type AppErrorBoundaryState = { error: Error | null; restartToken: number; backup: BackupStatus };

export class AppErrorBoundary extends React.Component<
    { children: React.ReactNode },
    AppErrorBoundaryState
> {
    state: AppErrorBoundaryState = { error: null, restartToken: 0, backup: "idle" };

    static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
        return { error, backup: "idle" };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        void recordCrash("boundary", error, errorInfo.componentStack ?? undefined);
        // A cold launch from here opens somewhere else; Restart takes this back.
        writeCrashSetAside(activeWorkspaceIdOrNull());
    }

    private handleRestart = () => {
        clearCrashSetAside();
        this.setState((prev) => ({ error: null, backup: "idle", restartToken: prev.restartToken + 1 }));
    };

    private handleOpenHome = () => {
        writeCrashSetAside(activeWorkspaceIdOrNull());
        this.setState((prev) => ({ error: null, backup: "idle", restartToken: prev.restartToken + 1 }));
    };

    private handleBackUp = async () => {
        if (this.state.backup === "running") return;
        this.setState({ backup: "running" });
        try {
            const built = await buildExactLibraryBackup(useStore.getState());
            await saveBuiltLibraryBackup(built);
            // Haptics: `success`: a meaningful completion, the library is saved elsewhere.
            haptic.success();
            this.setState({ backup: "saved" });
        } catch (error) {
            const backedOut =
                isBackupOperationCancelled(error) ||
                (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE);
            if (backedOut) {
                this.setState({ backup: "idle" });
                return;
            }
            // Haptics: `error`: failures must fire error.
            haptic.error();
            this.setState({ backup: "failed" });
        }
    };

    private renderKey(label: string, onPress: () => void, tier: "primary" | "secondary" | "quiet", disabled = false) {
        const container =
            tier === "primary" ? styles.primaryBtn : tier === "secondary" ? styles.secondaryBtn : styles.quietBtn;
        const labelStyle =
            tier === "primary" ? styles.primaryBtnText : tier === "secondary" ? styles.secondaryBtnText : styles.quietBtnText;
        return (
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={disabled}
                onPress={onPress}
                style={({ pressed }) => [
                    container,
                    { alignSelf: "stretch" },
                    disabled ? styles.btnDisabled : null,
                    pressed && !disabled ? styles.pressDown : null,
                ]}
            >
                <Text style={labelStyle}>{label}</Text>
            </Pressable>
        );
    }

    render() {
        if (this.state.error) {
            const { backup } = this.state;
            const status =
                backup === "running"
                    ? safeT("errorBoundary.backingUp", "Backing up…")
                    : backup === "saved"
                        ? safeT("errorBoundary.backedUp", "Backup saved")
                        : backup === "failed"
                            ? safeT("errorBoundary.backupFailed", "The backup didn’t finish. Try again.")
                            : null;
            return (
                <View
                    style={{
                        flex: 1,
                        backgroundColor: colors.page,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 32,
                        gap: 14,
                    }}
                >
                    <Text
                        style={{
                            fontFamily: "Lora_600SemiBold",
                            fontSize: 26,
                            color: colors.textPrimary,
                            textAlign: "center",
                        }}
                    >
                        {safeT("recovery.errorTitle", "Something went wrong")}
                    </Text>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_400Regular",
                            fontSize: 14,
                            lineHeight: 22,
                            color: colors.textStrong,
                            textAlign: "center",
                        }}
                    >
                        {safeT(
                            "errorBoundary.safeBody",
                            "Your library is still on this device. Back it up, or open Home without the page that stopped."
                        )}
                    </Text>
                    <View style={{ marginTop: 10, gap: 10, alignSelf: "stretch", maxWidth: 320, width: "100%", alignItems: "center" }}>
                        {this.renderKey(
                            safeT("errorBoundary.backUp", "Back up"),
                            () => void this.handleBackUp(),
                            "primary",
                            backup === "running"
                        )}
                        {this.renderKey(safeT("errorBoundary.openHome", "Open Home"), this.handleOpenHome, "secondary", backup === "running")}
                        {this.renderKey(safeT("recovery.restartApp", "Restart SongNook"), this.handleRestart, "quiet", backup === "running")}
                    </View>
                    {status ? (
                        <Text
                            accessibilityLiveRegion="polite"
                            style={[
                                text.supporting,
                                { color: backup === "failed" ? colors.danger : colors.textStrong, textAlign: "center" },
                            ]}
                        >
                            {status}
                        </Text>
                    ) : null}
                    <Text
                        style={{
                            marginTop: 6,
                            fontFamily: "PlusJakartaSans_400Regular",
                            fontSize: 12,
                            color: colors.textMuted,
                            textAlign: "center",
                        }}
                    >
                        {safeT("errorBoundary.hint", "If this keeps happening, share the diagnostic log from Settings → About.")}
                    </Text>
                </View>
            );
        }

        return <React.Fragment key={this.state.restartToken}>{this.props.children}</React.Fragment>;
    }
}
