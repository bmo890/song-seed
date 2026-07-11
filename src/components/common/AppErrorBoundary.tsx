import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors, radii } from "../../design/tokens";
import { recordCrash } from "../../services/crashLog";

/**
 * Root error boundary: a render exception anywhere below this renders a calm,
 * on-brand recovery screen instead of a white screen. The library is SQLite-backed
 * and rehydrates on remount, so "Restart" (which remounts the subtree via a key
 * bump) genuinely recovers — the copy promising the user's recordings are safe
 * is literally true.
 *
 * Deliberately self-contained: only React, RN primitives, and design tokens —
 * nothing that could itself be the thing that crashed.
 */

type AppErrorBoundaryState = { error: Error | null; restartToken: number };

export class AppErrorBoundary extends React.Component<
    { children: React.ReactNode },
    AppErrorBoundaryState
> {
    state: AppErrorBoundaryState = { error: null, restartToken: 0 };

    static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        void recordCrash("boundary", error, errorInfo.componentStack ?? undefined);
    }

    private handleRestart = () => {
        this.setState((prev) => ({ error: null, restartToken: prev.restartToken + 1 }));
    };

    render() {
        if (this.state.error) {
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
                            fontFamily: "PlayfairDisplay_600SemiBold",
                            fontSize: 26,
                            color: colors.textPrimary,
                            textAlign: "center",
                        }}
                    >
                        Something went wrong
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
                        Songstead hit an unexpected error. Your recordings and library are safe on
                        this device — restarting will bring everything back.
                    </Text>
                    <Pressable
                        onPress={this.handleRestart}
                        style={({ pressed }) => ({
                            marginTop: 10,
                            backgroundColor: colors.primary,
                            borderRadius: radii.round,
                            paddingVertical: 13,
                            paddingHorizontal: 28,
                            opacity: pressed ? 0.85 : 1,
                        })}
                    >
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_600SemiBold",
                                fontSize: 14,
                                color: colors.onPrimary,
                            }}
                        >
                            Restart Songstead
                        </Text>
                    </Pressable>
                    <Text
                        style={{
                            marginTop: 6,
                            fontFamily: "PlusJakartaSans_400Regular",
                            fontSize: 12,
                            color: colors.textMuted,
                            textAlign: "center",
                        }}
                    >
                        If this keeps happening, share the diagnostic log from Settings → About.
                    </Text>
                </View>
            );
        }

        return <React.Fragment key={this.state.restartToken}>{this.props.children}</React.Fragment>;
    }
}
