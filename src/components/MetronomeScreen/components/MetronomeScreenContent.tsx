import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { BottomSheet } from "../../common/BottomSheet";
import { Press } from "../../common/Press";
import { Slider } from "../../common/Slider";
import { Stepper } from "../../common/Stepper";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { ListRow, ListRows } from "../../common/ListRow";
import { colors } from "../../../design/tokens";
import {
  MAX_METRONOME_BPM,
  METRONOME_METER_PRESETS,
  MIN_METRONOME_BPM,
  getMetronomeFeels,
  getTempoMarking,
} from "../../../domain/metronome";
import { CueRows, FeelControl, MeterRow, feelLabel, ms } from "../../common/metronome/MetronomeBlocks";
import { MetronomeBeatBar } from "../../common/metronome/MetronomeBeatBar";
import { styles as s } from "../styles";
import { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";
import { useTranslation } from "react-i18next";

type SheetKey = "meter" | "sound" | null;

/**
 * Standalone metronome (2026-10-15, founder picked A, "the instrument"): one
 * screen. The tempo said once, in Lora, between bare − / +; the beat dots ARE
 * the pulse; the slider and Tap beneath; one round play key, the player's
 * transport. Meter and Sound are two rows that open sheets holding the same
 * shared blocks the recorder's metronome sheet uses, so the two never drift.
 */
export function MetronomeScreenContent() {
  const { t } = useTranslation();
  const model = useMetronomeScreenModel();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const isRunning = model.isRunning;
  const tapping = model.tapCount > 0;
  const meterLabel = METRONOME_METER_PRESETS.find((p) => p.id === model.meterId)?.label ?? "";
  const feel = getMetronomeFeels(model.meterId, model.supportsRests).find((f) => f.id === model.feelId);
  const onCues = (["beep", "visual", "haptic"] as const).filter((key) => model.outputs[key]);
  const soundSummary =
    onCues.length === 0
      ? t("metronome.cuesOff")
      : [
          ...(model.supportsClickStyle && model.outputs.beep
            ? [t(model.clickVoice === "wood" ? "metronome.voiceWood" : "metronome.voiceClick")]
            : []),
          onCues.map((key) => t(`metronome.${key}`)).join(", "),
        ].join(" · ");
  const statusLabel = !model.isNativeAvailable
    ? t("metronome.unavailable")
    : model.isPreparing
      ? t("metronome.preparing")
      : isRunning && model.activeOutputCount === 0
        ? t("metronome.noCues")
        : null;

  return (
    <SafeAreaView style={s.screen}>
      <ScreenHeader title={t("screens.metronome")} leftIcon="hamburger" />

      <ScrollView contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={s.hero}>
          {/* The beat dots are the pulse: one place for where the beat is. */}
          <MetronomeBeatBar
            beatsPerBar={model.meterPreset.pulsesPerBar}
            accentPattern={model.accentPattern}
            grouping={model.grouping}
            currentBeat={model.currentBeatInBar}
            pulseToken={model.pulseToken}
            active={isRunning && model.outputs.visual}
            variant="hero"
          />
          <Stepper
            glyphs="plusMinus"
            size="large"
            onStep={(direction) => model.nudgeBpm(direction)}
            decrementLabel={t("metronome.slow")}
            incrementLabel={t("metronome.raise")}
            style={s.tempoStepper}
          >
            <Text style={s.bpmValue} accessibilityLabel={`${model.bpm} ${t("metronome.bpm")}`}>
              {model.bpm}
            </Text>
          </Stepper>
          <Text style={s.bpmCaption}>
            <Text style={s.bpmUnit}>{t("metronome.bpm")}</Text>
            {`  ·  ${t(`metronome.marking.${getTempoMarking(model.bpm)}`)}`}
          </Text>
        </View>

        {/* Ticks every 10 bpm: the whole range is a score of felt stops. */}
        <Slider
          minimumValue={MIN_METRONOME_BPM}
          maximumValue={MAX_METRONOME_BPM}
          step={1}
          detent={10}
          value={model.bpm}
          onValueChange={model.setBpmValue}
          accessibilityLabel={t("metronome.bpm")}
        />

        <View style={s.tapRow}>
          <InkKey
            glyph={<Ionicons name="hand-left-outline" size={18} color={inkKeyColor(tapping ? "active" : "idle")} />}
            label={tapping ? t("metronome.tapCount", { count: model.tapCount }) : t("metronome.tap")}
            tone={tapping ? "active" : "idle"}
            onPress={() => model.tapTempo()}
            accessibilityLabel={t("metronome.tapTempo")}
          />
        </View>

        {/* THE action: one round transport key, the full player's. */}
        <Press
          feel="surface"
          // haptics.ts: tap → any acknowledged press.
          haptic="tap"
          style={[s.transport, model.isPreparing || !model.isNativeAvailable ? s.transportDisabled : null]}
          disabled={model.isPreparing || !model.isNativeAvailable}
          onPress={model.toggleRunning}
          accessibilityRole="button"
          accessibilityLabel={isRunning ? t("metronome.stopA11y") : t("metronome.startA11y")}
        >
          <Ionicons
            name={isRunning ? "stop" : "play"}
            size={30}
            color={colors.onPrimary}
            style={isRunning ? null : s.playGlyph}
          />
        </Press>
        {statusLabel ? <Text style={s.statusLabel}>{statusLabel}</Text> : null}

        <View style={s.spacer} />

        <ListRows>
          <ListRow
            icon="grid-outline"
            title={t("metronome.meter")}
            serifTitle={false}
            userTitle={false}
            accessory={
              <Text style={s.rowValue} numberOfLines={1}>
                {feel ? `${meterLabel} · ${feelLabel(feel, t)}` : meterLabel}
              </Text>
            }
            onPress={() => setSheet("meter")}
          />
          <ListRow
            icon="volume-medium-outline"
            title={t("metronome.sound")}
            serifTitle={false}
            userTitle={false}
            accessory={
              <Text style={s.rowValue} numberOfLines={1}>
                {soundSummary}
              </Text>
            }
            onPress={() => setSheet("sound")}
          />
        </ListRows>
      </ScrollView>

      <BottomSheet visible={sheet === "meter"} onClose={() => setSheet(null)}>
        <Text style={s.sheetTitle}>{t("metronome.meter")}</Text>
        <MeterRow meterId={model.meterId} onSelectMeter={model.setMeterIdValue} />
        <FeelControl
          meterId={model.meterId}
          feelId={model.feelId}
          accentPattern={model.accentPattern}
          subdivision={model.subdivision}
          supportsRests={model.supportsRests}
          supportsSubdivision={model.supportsClickStyle}
          onSelectFeel={(feelId) => model.setFeel(model.meterId, feelId)}
          onChangeCustomPattern={(pattern) => model.setCustomPattern(model.meterId, pattern)}
        />
        <View style={ms.sheetFoot} />
      </BottomSheet>

      <BottomSheet visible={sheet === "sound"} onClose={() => setSheet(null)}>
        <Text style={s.sheetTitle}>{t("metronome.sound")}</Text>
        <CueRows
          outputs={model.outputs}
          beepLevel={model.beepLevel}
          hapticLevel={model.hapticLevel}
          onToggleOutput={model.toggleOutput}
          onChangeBeepLevel={model.setBeepLevelValue}
          onChangeHapticLevel={model.setHapticLevelValue}
          clickVoice={model.supportsClickStyle ? model.clickVoice : undefined}
          onChangeClickVoice={model.supportsClickStyle ? model.setClickVoiceValue : undefined}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}
