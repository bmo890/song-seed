import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioDevices } from "@siteed/expo-audio-studio";
import { styles } from "../../styles";

type Props = {
    disabled: boolean;
    preferredInputId: string | null;
    onChangePreferredInputId: (id: string | null) => void;
};

function formatDeviceLabel(name: string) {
    return name.trim() || "Unnamed input";
}

export function RecordingInputPicker({ disabled, preferredInputId, onChangePreferredInputId }: Props) {
    const { devices, currentDevice, loading, error, refreshDevices, resetToDefaultDevice, selectDevice } = useAudioDevices();
    const [isApplying, setIsApplying] = useState(false);

    const availableDevices = useMemo(
        () => devices.filter((device) => device.isAvailable),
        [devices]
    );

    const activeSelectionId = preferredInputId ?? currentDevice?.id ?? null;

    async function handleSelectDefault() {
        if (disabled || isApplying) return;
        setIsApplying(true);
        try {
            const success = await resetToDefaultDevice();
            if (success) {
                onChangePreferredInputId(null);
            }
        } finally {
            setIsApplying(false);
        }
    }

    async function handleSelectDevice(deviceId: string) {
        if (disabled || isApplying) return;
        setIsApplying(true);
        try {
            const success = await selectDevice(deviceId);
            if (success) {
                onChangePreferredInputId(deviceId);
            }
        } finally {
            setIsApplying(false);
        }
    }

    return (
        <View style={styles.recordingInputCard}>
            <View style={styles.recordingInputHeader}>
                <View style={styles.recordingInputHeaderCopy}>
                    <Text style={styles.recordingInputTitle}>Recording Input</Text>
                    <Text style={styles.recordingInputMeta}>
                        Output follows your phone&apos;s current route (speaker, wired headphones, or Bluetooth).
                    </Text>
                </View>
                <Pressable
                    style={({ pressed }) => [
                        styles.recordingInputRefreshBtn,
                        pressed ? styles.pressDown : null,
                    ]}
                    onPress={refreshDevices}
                    disabled={loading || isApplying}
                >
                    {loading || isApplying ? (
                        <ActivityIndicator size="small" color="#1f2937" />
                    ) : (
                        <Ionicons name="refresh" size={16} color="#1f2937" />
                    )}
                </Pressable>
            </View>

            <Text style={styles.recordingInputCurrentLabel}>
                Current input: {currentDevice ? formatDeviceLabel(currentDevice.name) : "System default"}
            </Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recordingInputChipRow}
            >
                <Pressable
                    style={({ pressed }) => [
                        styles.recordingInputChip,
                        activeSelectionId === null ? styles.recordingInputChipActive : null,
                        disabled ? styles.recordingInputChipDisabled : null,
                        pressed ? styles.pressDown : null,
                    ]}
                    onPress={handleSelectDefault}
                    disabled={disabled || isApplying}
                >
                    <Text
                        style={[
                            styles.recordingInputChipText,
                            activeSelectionId === null ? styles.recordingInputChipTextActive : null,
                        ]}
                    >
                        System
                    </Text>
                </Pressable>

                {availableDevices.map((device) => {
                    const isActive = activeSelectionId === device.id;
                    return (
                        <Pressable
                            key={device.id}
                            style={({ pressed }) => [
                                styles.recordingInputChip,
                                isActive ? styles.recordingInputChipActive : null,
                                disabled ? styles.recordingInputChipDisabled : null,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={() => handleSelectDevice(device.id)}
                            disabled={disabled || isApplying}
                        >
                            <Text
                                style={[
                                    styles.recordingInputChipText,
                                    isActive ? styles.recordingInputChipTextActive : null,
                                ]}
                            >
                                {formatDeviceLabel(device.name)}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            <Text style={styles.recordingInputHint}>
                Choose a built-in microphone here if you want to keep recording from the phone while listening on Bluetooth.
            </Text>

            {disabled ? (
                <Text style={styles.recordingInputDisabledNote}>Pause or stop recording to change the input device.</Text>
            ) : null}

            {error ? <Text style={styles.recordingInputError}>{error.message}</Text> : null}
        </View>
    );
}
