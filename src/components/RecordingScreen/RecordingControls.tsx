import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type Props = {
    isRecording: boolean;
    isPaused: boolean;
    isArming?: boolean;
    recordToggleDisabled?: boolean;
    compact?: boolean;
    canSave?: boolean;
    onOpenInput: () => void;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
};

export function RecordingControls({
    isRecording,
    isPaused,
    isArming = false,
    recordToggleDisabled = false,
    compact = false,
    canSave = true,
    onOpenInput,
    onPause,
    onResume,
    onStart,
    onRequestSave,
}: Props) {
    return (
        <View style={[styles.recordingControlsBar, compact ? styles.recordingControlsBarCompact : null]}>
            <Pressable
                style={({ pressed }) => [
                    styles.circleControlBtn,
                    compact ? styles.circleControlBtnCompact : null,
                    isArming || (isRecording && !isPaused) ? styles.circleControlBtnDisabled : null,
                    pressed ? styles.pressDown : null,
                ]}
                onPress={onOpenInput}
                disabled={isArming || (isRecording && !isPaused)}
            >
                <Ionicons
                    name="headset-outline"
                    size={compact ? 20 : 24}
                    color={isArming || (isRecording && !isPaused) ? "#9ca3af" : "#374151"}
                />
            </Pressable>

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
                    color={recordToggleDisabled ? "#f1e8e4" : "#fff"}
                />
            </Pressable>

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
                    color={!canSave || isArming ? "#9ca3af" : "#374151"}
                />
            </Pressable>
        </View>
    );
}
