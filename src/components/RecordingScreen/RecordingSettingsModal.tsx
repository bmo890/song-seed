import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { BottomSheet } from "../common/BottomSheet";
import { RecordingInputPicker } from "./RecordingInputPicker";

type RecordingSettingsModalProps = {
  visible: boolean;
  disabled: boolean;
  preferredInputId: string | null;
  outputLabel?: string | null;
  isBluetoothOutput?: boolean;
  onClose: () => void;
  onChangePreferredInputId: (value: string | null) => void;
};

export function RecordingSettingsModal({
  visible,
  disabled,
  preferredInputId,
  outputLabel = null,
  isBluetoothOutput = false,
  onClose,
  onChangePreferredInputId,
}: RecordingSettingsModalProps) {
  const outputIcon = isBluetoothOutput
    ? "bluetooth"
    : outputLabel && /head|airpod|buds|ear/i.test(outputLabel)
      ? "headset-outline"
      : "volume-high-outline";

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.recordingSettingsTitle}>Recording Settings</Text>
      <Text style={styles.recordingSettingsMeta}>
        Choose the microphone here. Playback follows your phone&apos;s current output route.
      </Text>

      <RecordingInputPicker
        disabled={disabled}
        preferredInputId={preferredInputId}
        onChangePreferredInputId={onChangePreferredInputId}
      />

      <View style={styles.recordingOutputRow}>
        <Ionicons name={outputIcon} size={18} color="#84736f" />
        <View style={styles.recordingOutputCopy}>
          <Text style={styles.recordingOutputLabel}>Output</Text>
          <Text style={styles.recordingOutputValue} numberOfLines={1}>
            {outputLabel || "Phone speaker"}
          </Text>
        </View>
        <Text style={styles.recordingOutputAuto}>Auto</Text>
      </View>
    </BottomSheet>
  );
}
