import React, { useEffect, useRef } from "react";
import { Animated, View, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { colors } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

type Props = {
    isRecording: boolean;
    isPaused: boolean;
    isArming?: boolean;
    recordToggleDisabled?: boolean;
    compact?: boolean;
    canSave?: boolean;
    canDiscard?: boolean;
    /** Redo scraps the take but keeps the session armed — enabled during count-in too. */
    canRedo?: boolean;
    /** Per-beat counter — pulses a halo behind the record button (the visual metronome). */
    beatToken?: number;
    isDownbeat?: boolean;
    beatActive?: boolean;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
    onDiscard: () => void;
    onRedo?: () => void;
};

export function RecordingControls({
    isRecording,
    isPaused,
    isArming = false,
    recordToggleDisabled = false,
    compact = false,
    canSave = true,
    canDiscard = true,
    canRedo = false,
    beatToken = 0,
    isDownbeat = false,
    beatActive = false,
    onPause,
    onResume,
    onStart,
    onRequestSave,
    onDiscard,
    onRedo,
}: Props) {
    const { t } = useTranslation();
    const pulse = useRef(new Animated.Value(0)).current;
    const isDownbeatRef = useRef(isDownbeat);
    isDownbeatRef.current = isDownbeat;

    useEffect(() => {
        if (!beatActive || beatToken === 0) return;
        const peak = isDownbeatRef.current ? 1 : 0.6;
        pulse.stopAnimation();
        Animated.sequence([
            Animated.timing(pulse, { toValue: peak, duration: 60, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]).start();
    }, [beatToken, beatActive, pulse]);

    useEffect(() => {
        if (!beatActive) {
            pulse.stopAnimation();
            pulse.setValue(0);
        }
    }, [beatActive, pulse]);

    // Loud on purpose — this halo IS the visual metronome while recording, so it
    // flares well past the button (downbeats peak harder via `peak` above).
    const haloStyle = {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
    };

    return (
        <View style={[styles.recordingControlsBar, compact ? styles.recordingControlsBarCompact : null]}>
            <View style={local.sideColumn}>
                <Pressable
                    style={[
                        styles.circleControlBtn,
                        compact ? styles.circleControlBtnCompact : null,
                        !canDiscard || isArming ? styles.circleControlBtnDisabled : null,
                    ]}
                    onPress={() => {
                        haptic.tap();
                        onDiscard();
                    }}
                    disabled={!canDiscard || isArming}
                    accessibilityRole="button"
                    accessibilityLabel={t("recording.discardA11y")}
                >
                    <Ionicons
                        name="trash-outline"
                        size={compact ? 18 : 21}
                        color={!canDiscard || isArming ? colors.textMuted : colors.danger}
                    />
                    {compact ? null : (
                        <Text style={[styles.controlBtnLabel, styles.controlBtnLabelDanger]}>
                            {t("recording.discard")}
                        </Text>
                    )}
                </Pressable>
                {onRedo ? (
                    <Pressable
                        style={[
                            styles.circleControlBtn,
                            compact ? styles.circleControlBtnCompact : null,
                            !canRedo ? styles.circleControlBtnDisabled : null,
                        ]}
                        onPress={() => {
                            haptic.tap();
                            onRedo();
                        }}
                        disabled={!canRedo}
                        accessibilityRole="button"
                        accessibilityLabel={t("recording.redoA11y")}
                    >
                        <Ionicons
                            name="refresh-outline"
                            size={compact ? 18 : 21}
                            color={!canRedo ? colors.textMuted : colors.textSecondary}
                        />
                        {compact ? null : (
                            <Text style={styles.controlBtnLabel}>{t("recording.redo")}</Text>
                        )}
                    </Pressable>
                ) : null}
            </View>

            <View style={styles.recordBtnWrap}>
                <Animated.View
                    pointerEvents="none"
                    style={[styles.recordBeatHalo, compact ? styles.recordBeatHaloCompact : null, haloStyle]}
                />
                <Pressable
                    style={({ pressed }) => [
                        styles.circleRecordBtn,
                        compact ? styles.circleRecordBtnCompact : null,
                        isArming || !isPaused ? styles.circleRecordBtnActive : null,
                        recordToggleDisabled ? styles.circleRecordBtnDisabled : null,
                        pressed ? styles.pressDownStrong : null,
                    ]}
                    onPress={async () => {
                        if (isArming || recordToggleDisabled) {
                            return;
                        }
                        // The most tactile moment in the app — every record-state
                        // change gets a firm pulse.
                        haptic.grab();
                        if (!isRecording) {
                            await onStart();
                            return;
                        }
                        if (isPaused) {
                            await onResume();
                            return;
                        }
                        await onPause();
                    }}
                    disabled={isArming || recordToggleDisabled}
                >
                    <Ionicons
                        name={isArming ? "timer-outline" : !isRecording || isPaused ? "mic" : "pause"}
                        size={compact ? 24 : 34}
                        color={recordToggleDisabled ? colors.surfaceHigh : colors.onPrimary}
                    />
                </Pressable>
            </View>

            <View style={local.sideColumn}>
                <Pressable
                    style={[
                        styles.circleControlBtn,
                        compact ? styles.circleControlBtnCompact : null,
                        !canSave || isArming ? styles.circleControlBtnDisabled : null,
                    ]}
                    onPress={() => {
                        haptic.tap();
                        onRequestSave();
                    }}
                    disabled={!canSave || isArming}
                    accessibilityRole="button"
                    accessibilityLabel={t("mediaDock.saveRecording")}
                >
                    <Ionicons
                        name="save-outline"
                        size={compact ? 18 : 21}
                        color={!canSave || isArming ? colors.textMuted : colors.primaryDeep}
                    />
                    {compact ? null : (
                        <Text style={[styles.controlBtnLabel, canSave && !isArming ? local.saveLabel : null]}>
                            {t("common.save")}
                        </Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const local = StyleSheet.create({
    // Save takes the terracotta ink once there's something to save — it's the one
    // thing you came here to do.
    saveLabel: {
        color: colors.primaryDeep,
    },
    // Both side columns flex equally so the record button sits dead centre
    // whatever the left one is carrying (discard alone, or discard + redo).
    sideColumn: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
    },
});
