import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioDevices } from "@siteed/audio-studio";
import { styles } from "../../styles";

type Props = {
    disabled: boolean;
    preferredInputId: string | null;
    onChangePreferredInputId: (id: string | null) => void;
};

const FRIENDLY_LABELS: Record<string, string> = {
    builtin_mic: "Built-in Mic",
    bluetooth: "Bluetooth",
    wired_headset: "Wired Headset",
    wired_headphones: "Wired Headphones",
    usb: "USB Microphone",
    speaker: "Speaker",
};

function formatDeviceLabel(device: { name: string; type: string }) {
    const prefix = FRIENDLY_LABELS[device.type];
    if (!prefix) return device.name.trim() || "Unnamed input";
    if (device.type !== "builtin_mic") {
        const trimmed = device.name.trim();
        if (trimmed) return `${prefix} · ${trimmed}`;
    }
    return prefix;
}

function iconForType(type: string): keyof typeof Ionicons.glyphMap {
    switch (type) {
        case "bluetooth": return "bluetooth";
        case "wired_headset":
        case "wired_headphones": return "headset-outline";
        case "usb": return "swap-horizontal-outline";
        case "speaker": return "volume-high-outline";
        default: return "mic-outline";
    }
}

export function RecordingInputPicker({ disabled, preferredInputId, onChangePreferredInputId }: Props) {
    const { devices, loading, error, refreshDevices, selectDevice } = useAudioDevices();
    const [isApplying, setIsApplying] = useState(false);

    const availableDevices = useMemo(() => {
        const seenTypes = new Set<string>();
        return devices.filter((device) => {
            if (!device.isAvailable) return false;
            if (seenTypes.has(device.type)) return false;
            seenTypes.add(device.type);
            return true;
        });
    }, [devices]);

    // If no preference is saved, default to the first available device.
    const activeSelectionId = preferredInputId ?? availableDevices[0]?.id ?? null;
    const activeDevice = availableDevices.find((d) => d.id === activeSelectionId);
    const activeLabel = activeDevice ? formatDeviceLabel(activeDevice) : "Built-in Mic";

    async function handleSelectDevice(deviceId: string) {
        if (disabled || isApplying) return;
        setIsApplying(true);
        onChangePreferredInputId(deviceId);
        try {
            await selectDevice(deviceId);
        } finally {
            setIsApplying(false);
        }
    }

    return (
        <View style={styles.recordingInputCard}>
            <View style={styles.recordingInputHeader}>
                <View style={styles.recordingInputHeaderCopy}>
                    <Text style={styles.recordingInputTitle}>Recording Input</Text>
                    <Text style={styles.recordingInputActiveLabel}>{activeLabel}</Text>
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

            <View style={styles.recordingInputOptionList}>
                {availableDevices.map((device) => {
                    const isActive = activeSelectionId === device.id;
                    return (
                        <Pressable
                            key={device.id}
                            style={({ pressed }) => [
                                styles.recordingInputOption,
                                isActive ? styles.recordingInputOptionActive : null,
                                disabled ? styles.recordingInputOptionDisabled : null,
                                pressed && !disabled ? styles.pressDown : null,
                            ]}
                            onPress={() => handleSelectDevice(device.id)}
                            disabled={disabled || isApplying}
                        >
                            <Ionicons
                                name={iconForType(device.type)}
                                size={18}
                                color={isActive ? "#fff" : "#374151"}
                            />
                            <Text
                                style={[
                                    styles.recordingInputOptionText,
                                    isActive ? styles.recordingInputOptionTextActive : null,
                                ]}
                            >
                                {formatDeviceLabel(device)}
                            </Text>
                            {isActive ? (
                                <Ionicons name="checkmark" size={16} color="#fff" style={styles.recordingInputOptionCheck} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>

            {disabled ? (
                <Text style={styles.recordingInputDisabledNote}>Pause or stop recording to change the input device.</Text>
            ) : null}

            {error ? <Text style={styles.recordingInputError}>{error.message}</Text> : null}
        </View>
    );
}
