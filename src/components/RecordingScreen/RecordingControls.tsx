import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type Props = {
    isRecording: boolean;
    isPaused: boolean;
    compact?: boolean;
    canSave?: boolean;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
};

export function RecordingControls({
    isRecording,
    isPaused,
    compact = false,
    canSave = true,
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
                    isPaused ? styles.circleControlBtnActive : null,
                    !isRecording || isPaused ? styles.circleControlBtnDisabled : null,
                    pressed ? styles.pressDown : null,
                ]}
                onPress={onPause}
                disabled={!isRecording || isPaused}
            >
                <Ionicons name="pause" size={compact ? 20 : 24} color={!isRecording || isPaused ? "#9ca3af" : "#374151"} />
            </Pressable>

            <Pressable
                style={({ pressed }) => [
                    styles.circleRecordBtn,
                    compact ? styles.circleRecordBtnCompact : null,
                    !isPaused ? styles.circleRecordBtnActive : null,
                    pressed ? styles.pressDownStrong : null,
                ]}
                onPress={async () => {
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
            >
                <Ionicons name={!isRecording || isPaused ? "mic" : "pause"} size={compact ? 28 : 34} color="#fff" />
            </Pressable>

            <Pressable
                style={[
                    styles.circleControlBtn,
                    compact ? styles.circleControlBtnCompact : null,
                    !canSave ? styles.circleControlBtnDisabled : null,
                ]}
                onPress={onRequestSave}
                disabled={!canSave}
            >
                <Ionicons name="save-outline" size={compact ? 20 : 24} color={!canSave ? "#9ca3af" : "#374151"} />
            </Pressable>
        </View>
    );
}
