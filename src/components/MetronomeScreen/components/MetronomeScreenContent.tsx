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
  MIN_METRONOME_BPM,
  getTempoMarking,
} from "../../../domain/metronome";
import { CueRows, FeelControl, MeterRow, meterSummary, ms, soundSummary } from "../../common/metronome/MetronomeBlocks";
import { MetronomeBeatBar } from "../../common/metronome/MetronomeBeatBar";
import { PracticePattern } from "../../common/metronome/PracticePattern";
import { styles as s } from "../styles";
import { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";
import { useTranslation } from "react-i18next";

type SheetKey = "meter" | "sound" | null;

/**
 * Standalone metronome (2026-10-15, founder picked A, "the instrument"): one
 * screen. The tempo said once, in Lora, between bare − / +; the beat dots ARE
 * the pulse; the slider beneath; one round play key, the player's transport,
 * with Tap and Meter as ink keys either side of it. Under it the practice
 * pattern (2026-11-16): up to four bars whose every beat and sub-beat is a
 * switch. Meter and Sound open sheets holding the same shared blocks the
 * recorder's metronome sheet uses, so the two never drift.
 */
export function MetronomeScreenContent() {
  const { t } = useTranslation();
  const model = useMetronomeScreenModel();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const isRunning = model.isRunning;
  const tapping = model.tapCount > 0;
  const meterLine = meterSummary(model.meterId, model.feelId, model.supportsRests, t);
  const soundLine = soundSummary(model.outputs, model.supportsClickStyle ? model.clickVoice : undefined, t);
  // Only lasting states get a line. A start in flight is a blink, and a line that came
  // and went with it shoved the pattern down and back (2026-11-16 flicker).
  const statusLabel = !model.isNativeAvailable
    ? t("metronome.unavailable")
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
            accentPattern={model.heroAccentPattern}
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

        <View style={s.transportRow}>
          <InkKey
            glyph={<Ionicons name="hand-left-outline" size={18} color={inkKeyColor(tapping ? "active" : "idle")} />}
            label={t("metronome.tap")}
            tone={tapping ? "active" : "idle"}
            onPress={() => model.tapTempo()}
            accessibilityLabel={t("metronome.tapTempo")}
          />
          {/* THE action: one round transport key, the full player's. */}
          <Press
            feel="surface"
            // haptics.ts: tap → any acknowledged press.
            haptic="tap"
            style={[s.transport, !model.isNativeAvailable ? s.transportDisabled : null]}
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
          <InkKey
            glyph={<Ionicons name="grid-outline" size={17} color={inkKeyColor("idle")} />}
            label={model.meterPreset.label}
            onPress={() => setSheet("meter")}
            accessibilityLabel={`${t("metronome.meter")}: ${meterLine}`}
          />
        </View>
        {statusLabel ? <Text style={s.statusLabel}>{statusLabel}</Text> : null}

        {model.supportsStepPattern ? (
          <View style={s.pattern}>
            <PracticePattern
              practice={model.practice}
              baseBeats={model.accentPattern}
              currentBar={model.practiceBar}
              currentBeat={model.practiceBeat}
              onChange={model.setPractice}
            />
          </View>
        ) : null}

        <View style={s.spacer} />

        <ListRows>
          <ListRow
            icon="volume-medium-outline"
            title={t("metronome.sound")}
            serifTitle={false}
            userTitle={false}
            accessory={
              <Text style={s.rowValue} numberOfLines={1}>
                {soundLine}
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
          onSelectFeel={(feelId) =>
            model.supportsStepPattern ? model.setFeelPreset(feelId) : model.setFeel(model.meterId, feelId)
          }
          onChangeCustomPattern={(pattern) => model.setCustomPattern(model.meterId, pattern)}
          presetsOnly={model.supportsStepPattern}
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
