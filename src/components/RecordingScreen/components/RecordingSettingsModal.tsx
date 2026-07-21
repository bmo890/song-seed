import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { BottomSheet } from "../../common/BottomSheet";
import { RecordingInputPicker } from "./RecordingInputPicker";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const outputIcon = isBluetoothOutput
    ? "bluetooth"
    : outputLabel && /head|airpod|buds|ear/i.test(outputLabel)
      ? "headset-outline"
      : "volume-high-outline";

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.recordingSettingsTitle}>{t("recording.settings")}</Text>
      <Text style={styles.recordingSettingsMeta}>
        {t("recording.settingsHint")}
      </Text>

      <RecordingInputPicker
        disabled={disabled}
        preferredInputId={preferredInputId}
        onChangePreferredInputId={onChangePreferredInputId}
      />

      <View style={styles.recordingOutputRow}>
        <Ionicons name={outputIcon} size={18} color={colors.textSecondary} />
        <View style={styles.recordingOutputCopy}>
          <Text style={styles.recordingOutputLabel}>{t("recording.output")}</Text>
          <Text style={styles.recordingOutputValue} numberOfLines={1}>
            {outputLabel || t("recording.phoneSpeaker")}
          </Text>
        </View>
        <Text style={styles.recordingOutputAuto}>{t("recording.auto")}</Text>
      </View>
    </BottomSheet>
  );
}
