import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SettingsGroup, ToggleRow } from "../components/SettingsShared";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

/**
 * Durable recording behavior belongs here. Live metronome and input choices stay
 * on the recording and metronome surfaces where their effect is immediately clear.
 */
export function SettingsRecordingView() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const bluetoothCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);
  const promptForClipName = useStore((s) => s.promptForClipName);
  const setPromptForClipName = useStore((s) => s.setPromptForClipName);

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("settings.recordingAudio")}
        subtitle={t("settingsRecording.subtitle")}
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsRecording.saving")}</Text>
        </View>
        <SettingsGroup>
          <ToggleRow
            flat
            title={t("settingsRecording.nameEach")}
            subtitle={t("settingsRecording.nameEachHint")}
            value={promptForClipName}
            onPress={() => {
              haptic.tap();
              setPromptForClipName(!promptForClipName);
            }}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsRecording.devices")}</Text>
        </View>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="bluetooth"
            title={t("settingsRecording.bluetooth")}
            meta={
              bluetoothCalibrations.length === 0
                ? t("settingsRecording.bluetoothHint")
                : t("settingsRecording.calibrations", { count: bluetoothCalibrations.length })
            }
            onPress={() => {
              haptic.tap();
              navigation.navigate("BluetoothCalibration" as never);
            }}
          />
          <View style={settingsScreenStyles.inlineNoteRow}>
            <Text style={styles.settingsSectionHint}>{t("settingsRecording.microphoneHint")}</Text>
          </View>
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
