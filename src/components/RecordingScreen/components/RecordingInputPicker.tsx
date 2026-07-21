import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioDevices } from "@siteed/audio-studio";
import { styles } from "../../../styles";
import { colors } from "../../../design/tokens";
import { AppAlert } from "../../common/AppAlert";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

type Props = {
    disabled: boolean;
    preferredInputId: string | null;
    onChangePreferredInputId: (id: string | null) => void;
};

const FRIENDLY_LABEL_KEYS: Record<string, string> = {
    builtin_mic: "recording.builtInMic",
    bluetooth: "recording.bluetooth",
    wired_headset: "recording.wiredHeadset",
    wired_headphones: "recording.wiredHeadphones",
    usb: "recording.usbMic",
    speaker: "recording.speaker",
};

function formatDeviceLabel(device: { name: string; type: string }, t: TFunction) {
    const key = FRIENDLY_LABEL_KEYS[device.type];
    const prefix = key ? t(key) : null;
    if (!prefix) return device.name.trim() || t("recording.unnamedInput");
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
    const { t } = useTranslation();
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
            const isUnknownType = !(device.type in FRIENDLY_LABEL_KEYS);
            if (isUnknownType && hasBuiltinMic) return false;

            if (seenTypes.has(device.type)) return false;
            seenTypes.add(device.type);
            return true;
        });
    }, [devices]);

    // If no preference is saved, default to the first available device.
    const activeSelectionId = preferredInputId ?? availableDevices[0]?.id ?? null;
    const activeDevice = availableDevices.find((d) => d.id === activeSelectionId);
    const activeLabel = activeDevice ? formatDeviceLabel(activeDevice, t) : t("recording.builtInMic");

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
                t("recording.useBluetoothMicTitle"),
                t("recording.useBluetoothMicBody"),
                () => {
                    void applySelectedDevice(device.id);
                },
                { confirmLabel: t("recording.useBluetoothMic") }
            );
            return;
        }
        void applySelectedDevice(device.id);
    }

    return (
        <View style={styles.recordingInputCard}>
            <View style={styles.recordingInputHeader}>
                <View style={styles.recordingInputHeaderCopy}>
                    <Text style={styles.recordingInputTitle}>{t("recording.input")}</Text>
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
                                {formatDeviceLabel(device, t)}
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
                    {t("recording.bluetoothMicActive")}
                </Text>
            ) : null}

            {disabled ? (
                <Text style={styles.recordingInputDisabledNote}>{t("recording.inputLocked")}</Text>
            ) : null}

            {error ? (
                <Text style={styles.recordingInputError}>{t("recording.inputListFailed")}</Text>
            ) : null}
        </View>
    );
}
