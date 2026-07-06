import React, { useEffect, useRef } from "react";
import { Animated, View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
import { haptic } from "../../design/haptics";

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
    const pulse = useRef(new Animated.Value(0)).current;
    const isDownbeatRef = useRef(isDownbeat);
    isDownbeatRef.current = isDownbeat;

    useEffect(() => {
        if (!beatActive || beatToken === 0) return;
        const peak = isDownbeatRef.current ? 1 : 0.55;
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

    const haloStyle = {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
    };

    return (
        <View style={[styles.recordingControlsBar, compact ? styles.recordingControlsBarCompact : null]}>
            <View style={[styles.recordingControlsSaveColumn, onRedo ? local.sideColumn : null]}>
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
                    accessibilityLabel="Discard recording"
                >
                    <Ionicons
                        name="trash-outline"
                        size={compact ? 18 : 22}
                        color={!canDiscard || isArming ? colors.textMuted : "#B5483A"}
                    />
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
                        accessibilityLabel="Redo take"
                    >
                        <Ionicons
                            name="refresh-outline"
                            size={compact ? 18 : 22}
                            color={!canRedo ? colors.textMuted : colors.textStrong}
                        />
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

            <View style={[styles.recordingControlsSaveColumn, onRedo ? local.sideColumn : null]}>
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
                >
                    <Ionicons
                        name="save-outline"
                        size={compact ? 18 : 24}
                        color={!canSave || isArming ? colors.textMuted : colors.textStrong}
                    />
                </Pressable>
            </View>
        </View>
    );
}

const local = StyleSheet.create({
    // Both side columns share this width so the record button stays centered when the
    // left one carries two buttons (discard + redo).
    sideColumn: {
        width: 100,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
    },
});
