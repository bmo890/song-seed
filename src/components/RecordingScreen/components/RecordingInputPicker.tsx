import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioDevices } from "@siteed/audio-studio";
import { styles } from "../../../styles";
import { colors } from "../../../design/tokens";
import { AppAlert } from "../../common/AppAlert";

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
        const available = devices.filter((device) => device.isAvailable);
        const hasBuiltinMic = available.some((device) => device.type === "builtin_mic");

        const seenTypes = new Set<string>();
        return available.filter((device) => {
            // The OS commonly surfaces the built-in mic twice: once as a typed `builtin_mic`
            // entry and once as an unrecognized-type "default" entry named by the phone model
            // (e.g. "SM-S921U1"). Collapse that duplicate into the single Built-in Mic option,
            // but only when a real builtin_mic exists so we never end up hiding the only device.
            const isUnknownType = !(device.type in FRIENDLY_LABELS);
            if (isUnknownType && hasBuiltinMic) return false;

            if (seenTypes.has(device.type)) return false;
            seenTypes.add(device.type);
            return true;
        });
    }, [devices]);

    // If no preference is saved, default to the first available device.
    const activeSelectionId = preferredInputId ?? availableDevices[0]?.id ?? null;
    const activeDevice = availableDevices.find((d) => d.id === activeSelectionId);
    const activeLabel = activeDevice ? formatDeviceLabel(activeDevice) : "Built-in Mic";

    useEffect(() => {
        if (loading) return;
        if (!preferredInputId) return;
        if (availableDevices.some((device) => device.id === preferredInputId)) return;
        onChangePreferredInputId(null);
    }, [availableDevices, loading, onChangePreferredInputId, preferredInputId]);

    async function applySelectedDevice(deviceId: string) {
        setIsApplying(true);
        onChangePreferredInputId(deviceId);
        try {
            await selectDevice(deviceId);
        } finally {
            setIsApplying(false);
        }
    }

    function handleSelectDevice(device: { id: string; type: string }) {
        if (disabled || isApplying) return;
        if (device.id === activeSelectionId) return;
        // Bluetooth mics ride the phone-call (HFP) link: the same headphones' playback
        // drops to that quality too, and the mic's delay is variable — no calibration can
        // correct it. Make the trade-off explicit before switching.
        if (device.type === "bluetooth") {
            AppAlert.confirm(
                "Use Bluetooth microphone?",
                "While a Bluetooth mic is active, playback in those headphones drops to phone-call quality, and the mic's delay can't be corrected — overdubs may land off the beat.",
                () => {
                    void applySelectedDevice(device.id);
                },
                { confirmLabel: "Use Bluetooth Mic" }
            );
            return;
        }
        void applySelectedDevice(device.id);
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
                        <ActivityIndicator size="small" color={colors.textStrong} />
                    ) : (
                        <Ionicons name="refresh" size={16} color={colors.textStrong} />
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
                            onPress={() => handleSelectDevice(device)}
                            disabled={disabled || isApplying}
                        >
                            <Ionicons
                                name={iconForType(device.type)}
                                size={18}
                                color={isActive ? colors.surface : colors.textStrong}
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
                                <Ionicons name="checkmark" size={16} color={colors.surface} style={styles.recordingInputOptionCheck} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>

            {activeDevice?.type === "bluetooth" ? (
                <Text style={styles.recordingInputDisabledNote}>
                    Bluetooth mic active — headphone playback is reduced to phone-call quality and overdub timing can drift.
                </Text>
            ) : null}

            {disabled ? (
                <Text style={styles.recordingInputDisabledNote}>Pause or stop recording to change the input device.</Text>
            ) : null}

            {error ? (
                <Text style={styles.recordingInputError}>Couldn&apos;t list audio inputs — using the default mic.</Text>
            ) : null}
        </View>
    );
}
