import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";

type Props = {
    isRecording: boolean;
    isPaused: boolean;
    isArming?: boolean;
    recordToggleDisabled?: boolean;
    compact?: boolean;
    canSave?: boolean;
    canDiscard?: boolean;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
    onDiscard: () => void;
};

export function RecordingControls({
    isRecording,
    isPaused,
    isArming = false,
    recordToggleDisabled = false,
    compact = false,
    canSave = true,
    canDiscard = true,
    onPause,
    onResume,
    onStart,
    onRequestSave,
    onDiscard,
}: Props) {
    return (
        <View style={[styles.recordingControlsBar, compact ? styles.recordingControlsBarCompact : null]}>
            <View style={styles.recordingControlsSaveColumn}>
                <Pressable
                    style={[
                        styles.circleControlBtn,
                        compact ? styles.circleControlBtnCompact : null,
                        !canDiscard || isArming ? styles.circleControlBtnDisabled : null,
                    ]}
                    onPress={onDiscard}
                    disabled={!canDiscard || isArming}
                    accessibilityRole="button"
                    accessibilityLabel="Discard recording"
                >
                    <Ionicons
                        name="trash-outline"
                        size={compact ? 20 : 22}
                        color={!canDiscard || isArming ? colors.textMuted : "#B5483A"}
                    />
                </Pressable>
            </View>

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
                    size={compact ? 28 : 34}
                    color={recordToggleDisabled ? colors.surfaceHigh : colors.onPrimary}
                />
            </Pressable>

            <View style={styles.recordingControlsSaveColumn}>
                <Pressable
                    style={[
                        styles.circleControlBtn,
                        compact ? styles.circleControlBtnCompact : null,
                        !canSave || isArming ? styles.circleControlBtnDisabled : null,
                    ]}
                    onPress={onRequestSave}
                    disabled={!canSave || isArming}
                >
                    <Ionicons
                        name="save-outline"
                        size={compact ? 20 : 24}
                        color={!canSave || isArming ? colors.textMuted : colors.textStrong}
                    />
                </Pressable>
            </View>
        </View>
    );
}
