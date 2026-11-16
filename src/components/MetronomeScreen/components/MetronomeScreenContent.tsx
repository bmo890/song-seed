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
import { IconButton } from "../../common/IconButton";
import { Switch } from "../../common/Switch";
import { AnimatedCollapse } from "../../common/AnimatedCollapse";
import { colors } from "../../../design/tokens";
import {
  MAX_METRONOME_BPM,
  MIN_METRONOME_BPM,
  getTempoMarking,
} from "../../../domain/metronome";
import { CueRows, FeelControl, MeterRow, meterSummary, ms, soundSummary } from "../../common/metronome/MetronomeBlocks";
import { MetronomeBeatBar } from "../../common/metronome/MetronomeBeatBar";
import { PracticeBarNumberMark, PracticeDotMark, PracticePattern } from "../../common/metronome/PracticePattern";
import { HelpButton } from "../../common/HelpButton";
import { HelpSheet } from "../../common/HelpSheet";
import { styles as s } from "../styles";
import { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";
import { useTranslation } from "react-i18next";

type SheetKey = "meter" | "sound" | "help" | null;

/**
 * Standalone metronome, "look up, touch down" (founder, 2026-11-16): the display
 * (beat dots, the tempo said once in Lora, its marking) at the top, centred in
 * whatever space the pattern leaves; the practice pattern in the middle (up
 * to four bars whose every beat and sub-beat is a switch, a mode switched on);
 * the deck pinned at the foot: − slider + over Tap · the round play key · Meter.
 * Sound is the header's glyph. Meter and Sound open sheets holding the same
 * shared blocks the recorder's metronome sheet uses, so the two never drift.
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
      <ScreenHeader
        title={t("screens.metronome")}
        leftIcon="hamburger"
        rightElement={
          // Set once, rarely touched: Sound is the header's one bare glyph (2026-11-16).
          <IconButton
            icon="volume-medium-outline"
            tone="strong"
            onPress={() => setSheet("sound")}
            accessibilityLabel={`${t("metronome.sound")}: ${soundLine}`}
          />
        }
      />

      {/* Look up, touch down (founder, 2026-11-16): the display above, the pattern in the
          middle, every control the hand works pinned in the deck at the foot. */}
      <ScrollView contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false} bounces={false}>
        {/* The display takes whatever room the pattern leaves and sits centred in it, at full
            size open or closed (founder, 2026-11-16: no gap under the bars, no shrinking). */}
        <View style={s.display}>
          {/* The beat dots are the pulse: one place for where the beat is. */}
          <MetronomeBeatBar
            beatsPerBar={model.meterPreset.pulsesPerBar}
            accentPattern={model.heroAccentPattern}
            grouping={model.grouping}
            currentBeat={model.currentBeatInBar}
            pulseToken={model.pulseToken}
            pulseBeat={model.heroPulseBeat}
            active={isRunning && model.outputs.visual}
            variant="hero"
          />
          <Text style={s.bpmValue} accessibilityLabel={`${model.bpm} ${t("metronome.bpm")}`}>
            {model.bpm}
          </Text>
          <Text style={s.bpmCaption}>
            <Text style={s.bpmUnit}>{t("metronome.bpm")}</Text>
            {`  ·  ${t(`metronome.marking.${getTempoMarking(model.bpm)}`)}`}
          </Text>
        </View>
        {statusLabel ? <Text style={s.statusLabel}>{statusLabel}</Text> : null}

        {model.supportsStepPattern ? (
          <View style={s.pattern}>
            {/* A practice mode, off until switched on: the editor stays folded away. */}
            <ListRows>
              <ListRow
                icon="repeat-outline"
                title={t("metronome.practice.toggle")}
                serifTitle={false}
                userTitle={false}
                chevron={false}
                // haptics.ts: light — a small state flip (the Switch owns its own taps).
                haptic="light"
                accessory={
                  <View style={s.practiceAccessory}>
                    {/* What the dots mean is a rule you can't see: it lives behind "?". */}
                    {model.practiceOn ? <HelpButton compact onPress={() => setSheet("help")} /> : null}
                    <Switch
                      value={model.practiceOn}
                      onValueChange={model.setPracticeOn}
                      accessibilityLabel={t("metronome.practice.toggle")}
                    />
                  </View>
                }
                onPress={() => model.setPracticeOn(!model.practiceOn)}
              />
            </ListRows>
            <AnimatedCollapse visible={model.practiceOn} style={s.patternBody}>
              <PracticePattern
                practice={model.practice}
                baseBeats={model.accentPattern}
                currentBar={model.practiceBar}
                currentBeat={model.practiceBeat}
                pulse={model.practicePulse}
                onChange={model.setPractice}
              />
            </AnimatedCollapse>
          </View>
        ) : null}

      </ScrollView>

      {/* The deck: tempo, then Tap · play · Meter, all under the thumb. */}
      <View style={s.deck}>
        <Stepper
          glyphs="plusMinus"
          size="large"
          onStep={(direction) => model.nudgeBpm(direction)}
          decrementLabel={t("metronome.slow")}
          incrementLabel={t("metronome.raise")}
          style={s.tempoDeck}
        >
          {/* Ticks every 10 bpm: the whole range is a score of felt stops. */}
          <View style={s.sliderWrap}>
            <Slider
              minimumValue={MIN_METRONOME_BPM}
              maximumValue={MAX_METRONOME_BPM}
              step={1}
              detent={10}
              value={model.bpm}
              onValueChange={model.setBpmValue}
              accessibilityLabel={t("metronome.bpm")}
            />
          </View>
        </Stepper>
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
      </View>

      <HelpSheet
        visible={sheet === "help"}
        onClose={() => setSheet(null)}
        thesis={t("metronome.practice.helpThesis")}
        items={[
          { mark: <PracticeDotMark tier="accent" />, label: t("metronome.practice.legendAccent"), description: t("metronome.practice.helpAccent") },
          { mark: <PracticeDotMark tier="click" />, label: t("metronome.practice.legendClick"), description: t("metronome.practice.helpClick") },
          { mark: <PracticeDotMark tier="rest" />, label: t("metronome.practice.legendSilent"), description: t("metronome.practice.helpSilent") },
          { mark: <PracticeBarNumberMark />, label: t("metronome.practice.helpBarLabel"), description: t("metronome.practice.helpBar") },
        ]}
      />

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
