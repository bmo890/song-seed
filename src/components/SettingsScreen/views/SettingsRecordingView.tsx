import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { SegmentedField, ToggleRow } from "../components/SettingsShared";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import {
  METRONOME_COUNT_IN_BAR_OPTIONS,
  METRONOME_METER_PRESETS,
} from "../../../domain/metronome";

/**
 * Defaults applied to every new take. The metronome values are the same ones the
 * recording screen and Metronome tool read, so a change here is the starting point
 * everywhere (each take stays adjustable in the moment).
 */
export function SettingsRecordingView() {
  const promptForClipName = useStore((s) => s.promptForClipName);
  const setPromptForClipName = useStore((s) => s.setPromptForClipName);
  const meterId = useStore((s) => s.metronomeMeterId);
  const setMetronomeMeterId = useStore((s) => s.setMetronomeMeterId);
  const countInBars = useStore((s) => s.metronomeCountInBars);
  const setMetronomeCountInBars = useStore((s) => s.setMetronomeCountInBars);
  const outputs = useStore((s) => s.metronomeOutputs);
  const setMetronomeOutputEnabled = useStore((s) => s.setMetronomeOutputEnabled);

  const countInLabel = (bars: number) => (bars === 0 ? "Off" : bars === 1 ? "1 bar" : `${bars} bars`);

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title="Recording"
        subtitle="Defaults for new takes — how the metronome starts and how recordings are named."
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Saving</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <ToggleRow
            title="Name each recording"
            subtitle="Ask for a title after every take. Off saves with the suggested name."
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
          <Text style={styles.settingsSectionLabel}>Metronome</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <SegmentedField
            title="Count-in"
            subtitle="Bars to count before recording starts."
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
            title="Time signature"
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
            title="Click sound"
            subtitle="Play an audible click on each beat."
            value={outputs.beep}
            onPress={() => {
              haptic.tap();
              setMetronomeOutputEnabled("beep", !outputs.beep);
            }}
          />
          <ToggleRow
            title="Haptic pulse"
            subtitle="Feel each beat as a tap while recording."
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
