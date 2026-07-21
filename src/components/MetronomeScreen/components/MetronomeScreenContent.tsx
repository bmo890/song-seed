import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";
import { METRONOME_METER_PRESETS } from "../../../domain/metronome";
import {
  BeepLevelControl,
  CueTiles,
  HapticStrengthControl,
  MeterChips,
  TempoBlock,
  ms,
} from "../../common/metronome/MetronomeBlocks";
import { MetronomeBeatBar } from "../../common/metronome/MetronomeBeatBar";
import { styles as s } from "../styles";
import { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";
import { useTranslation } from "react-i18next";

/**
 * Standalone metronome — the in-recorder sheet's control vocabulary on a full
 * page, one screen tall (the ScrollView only engages on very short devices).
 * Where the sheet has Count-in (a recording-only concept), the page has what
 * the sheet never needed: Start/Stop and a big visual beat.
 */
export function MetronomeScreenContent() {
  const { t } = useTranslation();
  const model = useMetronomeScreenModel();
  const isRunning = model.isRunning;
  const beatBarActive = isRunning && model.outputs.visual;
  const meterLabel =
    METRONOME_METER_PRESETS.find((p) => p.id === model.meterId)?.label ?? "";
  const statusLabel = !model.isNativeAvailable
    ? t("metronome.unavailable")
    : isRunning && model.activeOutputCount === 0
      ? t("metronome.noCues")
      : null;

  return (
    <SafeAreaView style={s.screen}>
      <ScreenHeader title={t("screens.metronome")} leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.pageContent}
        bounces={false}
      >
        {/* Hero — the standalone-only zone: beat pulse, BPM readout, start/stop */}
        <View style={s.hero}>
          <View style={s.pulseStack}>
            <Animated.View
              pointerEvents="none"
              style={[
                s.pulseHalo,
                { opacity: model.pulseOpacity, transform: [{ scale: model.pulseScale }] },
              ]}
            />
            <View
              style={[
                s.pulseCore,
                isRunning ? s.pulseCoreActive : null,
                isRunning && !model.outputs.visual ? s.pulseCoreMuted : null,
              ]}
            />
          </View>

          <Text style={s.bpmValue}>{model.bpm}</Text>
          <Text style={s.bpmUnit}>BPM</Text>

          <MetronomeBeatBar
            beatsPerBar={model.meterPreset.pulsesPerBar}
            currentBeat={model.currentBeatInBar}
            pulseToken={model.pulseToken}
            active={beatBarActive}
            variant="hero"
          />

          <Pressable
            style={({ pressed }) => [
              s.primaryAction,
              isRunning ? s.primaryActionStop : null,
              model.isPreparing || !model.isNativeAvailable ? s.primaryActionDisabled : null,
              pressed ? ms.pressed : null,
            ]}
            onPress={() => {
              haptic.tap();
              model.toggleRunning();
            }}
            disabled={model.isPreparing || !model.isNativeAvailable}
            accessibilityRole="button"
            accessibilityLabel={isRunning ? t("metronome.stopA11y") : t("metronome.startA11y")}
          >
            <Text style={[s.primaryActionText, isRunning ? s.primaryActionTextStop : null]}>
              {model.isPreparing ? t("metronome.preparing") : isRunning ? t("metronome.stop") : t("metronome.start")}
            </Text>
          </Pressable>

          {statusLabel ? <Text style={s.statusLabel}>{statusLabel}</Text> : null}
        </View>

        {/* Tempo — shared block, identical to the recording sheet */}
        <View style={ms.divider}>
          <Text style={ms.label}>{t("metronome.tempo")}</Text>
          <TempoBlock
            bpm={model.bpm}
            tapCount={model.tapCount}
            onNudgeBpm={model.nudgeBpm}
            onSetBpmValue={model.setBpmValue}
            onTapTempo={model.tapTempo}
          />
        </View>

        {/* Meter — sheet's quiet row, chips promoted to always-visible (a page has room) */}
        <View style={[ms.divider, s.sectionGap]}>
          <View style={ms.quietRow}>
            <Text style={ms.quietLabel}>{t("metronome.meter")}</Text>
            <View style={ms.valuePill}>
              <Text style={ms.valueText}>{meterLabel}</Text>
            </View>
          </View>
          <MeterChips meterId={model.meterId} onSelectMeter={model.setMeterIdValue} />
        </View>

        {/* Cues — shared tiles + conditional level controls */}
        <View style={[ms.divider, s.sectionGap]}>
          <Text style={ms.label}>{t("metronome.cues")}</Text>
          <CueTiles outputs={model.outputs} onToggleOutput={model.toggleOutput} />
          {model.outputs.beep ? (
            <BeepLevelControl
              beepLevel={model.beepLevel}
              onChangeBeepLevel={model.setBeepLevelValue}
            />
          ) : null}
          {model.outputs.haptic ? (
            <HapticStrengthControl
              hapticLevel={model.hapticLevel}
              onChangeHapticLevel={model.setHapticLevelValue}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
