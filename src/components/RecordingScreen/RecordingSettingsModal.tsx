import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { RecordingInputPicker } from "./RecordingInputPicker";

type RecordingSettingsModalProps = {
  visible: boolean;
  disabled: boolean;
  preferredInputId: string | null;
  onClose: () => void;
  onChangePreferredInputId: (value: string | null) => void;
};

export function RecordingSettingsModal({
  visible,
  disabled,
  preferredInputId,
  onClose,
  onChangePreferredInputId,
}: RecordingSettingsModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.recordingSettingsModalCard]}>
          <View style={styles.recordingSettingsHeader}>
            <View style={styles.recordingSettingsHeaderCopy}>
              <Text style={styles.recordingSettingsTitle}>Recording Settings</Text>
              <Text style={styles.recordingSettingsMeta}>
                Choose the microphone here. Playback output still follows your phone&apos;s current route.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.recordingSettingsCloseBtn,
                pressed ? styles.pressDown : null,
              ]}
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color="#111827" />
            </Pressable>
          </View>

          <RecordingInputPicker
            disabled={disabled}
            preferredInputId={preferredInputId}
            onChangePreferredInputId={onChangePreferredInputId}
          />
        </View>
      </View>
    </Modal>
  );
}
