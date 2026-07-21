import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SegmentedField, ToggleRow } from "../components/SettingsShared";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import {
  METRONOME_COUNT_IN_BAR_OPTIONS,
  METRONOME_METER_PRESETS,
} from "../../../domain/metronome";
import { useTranslation } from "react-i18next";

/**
 * Defaults applied to every new take. The metronome values are the same ones the
 * recording screen and Metronome tool read, so a change here is the starting point
 * everywhere (each take stays adjustable in the moment).
 */
export function SettingsRecordingView() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const bluetoothCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);
  const promptForClipName = useStore((s) => s.promptForClipName);
  const setPromptForClipName = useStore((s) => s.setPromptForClipName);
  const meterId = useStore((s) => s.metronomeMeterId);
  const setMetronomeMeterId = useStore((s) => s.setMetronomeMeterId);
  const countInBars = useStore((s) => s.metronomeCountInBars);
  const setMetronomeCountInBars = useStore((s) => s.setMetronomeCountInBars);
  const outputs = useStore((s) => s.metronomeOutputs);
  const setMetronomeOutputEnabled = useStore((s) => s.setMetronomeOutputEnabled);

  const countInLabel = (bars: number) => bars === 0 ? t("settingsRecording.off") : t("settingsRecording.bars", { count: bars });

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("settings.recording")}
        subtitle={t("settingsRecording.subtitle")}
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsRecording.saving")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <ToggleRow
            title={t("settingsRecording.nameEach")}
            subtitle={t("settingsRecording.nameEachHint")}
            value={promptForClipName}
            onPress={() => {
              haptic.tap();
              setPromptForClipName(!promptForClipName);
            }}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsRecording.devices")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <LibraryActionCard
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
          <Text style={styles.settingsSectionHint}>
            {t("settingsRecording.microphoneHint")}
          </Text>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("navigation.metronome")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <SegmentedField
            title={t("settingsRecording.countIn")}
            subtitle={t("settingsRecording.countInHint")}
            value={countInBars}
            options={METRONOME_COUNT_IN_BAR_OPTIONS.map((bars) => ({
              value: bars,
              label: countInLabel(bars),
            }))}
            onChange={(next) => {
              haptic.tap();
              setMetronomeCountInBars(next);
            }}
          />
          <SegmentedField
            title={t("settingsRecording.timeSignature")}
            value={meterId}
            options={METRONOME_METER_PRESETS.map((preset) => ({
              value: preset.id,
              label: preset.label,
            }))}
            onChange={(next) => {
              haptic.tap();
              setMetronomeMeterId(next);
            }}
          />
          <ToggleRow
            title={t("settingsRecording.clickSound")}
            subtitle={t("settingsRecording.clickSoundHint")}
            value={outputs.beep}
            onPress={() => {
              haptic.tap();
              setMetronomeOutputEnabled("beep", !outputs.beep);
            }}
          />
          <ToggleRow
            title={t("settingsRecording.hapticPulse")}
            subtitle={t("settingsRecording.hapticPulseHint")}
            value={outputs.haptic}
            onPress={() => {
              haptic.tap();
              setMetronomeOutputEnabled("haptic", !outputs.haptic);
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
