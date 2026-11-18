import { useEffect, useState } from "react";
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
import { Fog, PatternModeGlyph, RandomPattern } from "../../common/metronome/RandomPattern";
import { SegmentedControl } from "../../common/SegmentedControl";
import type { PracticeMode } from "../../../domain/metronomePractice";
import { HelpButton } from "../../common/HelpButton";
import { HelpSheet } from "../../common/HelpSheet";
import { styles as s } from "../styles";
import { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";
import { DisplayFlash } from "./DisplayFlash";
import { useTranslation } from "react-i18next";

/** The tempo's line height at full size and at its smallest with Practice on; Lora's
 *  figures run 1.09 lines to the size (88 on 96). */
const BPM_LINE_MAX = 96;
const BPM_LINE_MIN = 52;
const BPM_LINE_RATIO = 96 / 88;
/** The display's own vertical padding with Practice on (displayCompact), both edges. */
const DISPLAY_PAD = 0;
/** One more bar of the pattern: a row and the gap above it. */
const PRACTICE_ROW_PITCH = 44 + 2;

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
  const [displayBottom, setDisplayBottom] = useState(0);
  // With Practice on the tempo takes the size that lets four bars fit the screen
  // (founder, 2026-11-18: the fourth bar sat below the fold). Measured, not guessed: the
  // room left over (or missing) on this phone, less what the bars not yet added will
  // need, so adding a bar never resizes it.
  const [fit, setFit] = useState({ viewport: 0, content: 0, display: 0, readout: 0 });
  const [practiceLine, setPracticeLine] = useState(BPM_LINE_MAX);
  const shownBars = model.practiceOn && model.randomAvailable && model.practiceMode === "random" ? 4 : model.practice?.bars.length ?? 1;
  useEffect(() => {
    if (!model.practiceOn) {
      setPracticeLine(BPM_LINE_MAX);
      return;
    }
    if (!fit.viewport || !fit.content || !fit.display || !fit.readout) return;
    const overflow = Math.max(0, fit.content - fit.viewport);
    const spare = Math.max(0, fit.display - fit.readout - DISPLAY_PAD);
    const futureBars = Math.max(0, 4 - shownBars) * PRACTICE_ROW_PITCH;
    setPracticeLine((line) => {
      const next = Math.round(Math.min(BPM_LINE_MAX, Math.max(BPM_LINE_MIN, line + spare - overflow - futureBars)));
      return Math.abs(next - line) >= 2 || overflow > 0 ? next : line;
    });
  }, [fit, model.practiceOn, shownBars]);
  const practiceBpmStyle = { fontSize: Math.round(practiceLine / BPM_LINE_RATIO), lineHeight: practiceLine };
  const isRunning = model.isRunning;
  const random = model.practiceOn && model.randomAvailable && model.practiceMode === "random";
  // Your pattern · Random as two marks at the start of the practice line (founder,
  // 2026-11-17): a little score of dots, and the shuffle. Without Random, no tabs.
  const modeTabs = model.randomAvailable ? (
    <View style={s.modeTabs}>
      <SegmentedControl<PracticeMode>
        glyphOnly
        bare
        options={[
          { key: "pattern", label: t("metronome.practice.modePattern"), icon: (color) => <PatternModeGlyph color={color} /> },
          { key: "random", label: t("metronome.practice.modeRandom"), icon: "shuffle" },
        ]}
        value={model.practiceMode}
        onChange={model.setPracticeMode}
      />
    </View>
  ) : null;
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
          // Set once, rarely touched: the cue settings (click sound, beep, visual, haptic) are
          // the header's one bare glyph, sliders because it holds more than sound (2026-11-16).
          <IconButton
            icon="options-outline"
            tone="strong"
            onPress={() => setSheet("sound")}
            accessibilityLabel={`${t("metronome.sound")}: ${soundLine}`}
          />
        }
      />

      {/* Look up, touch down (founder, 2026-11-16): the display above, the pattern in the
          middle, every control the hand works pinned in the deck at the foot. */}
      <ScrollView
        contentContainerStyle={[s.pageContent, model.practiceOn ? s.pageContentPractice : null]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onLayout={(event) => {
          const viewport = Math.round(event.nativeEvent.layout.height);
          setFit((f) => (f.viewport === viewport ? f : { ...f, viewport }));
        }}
        onContentSizeChange={(_w, h) => {
          const content = Math.round(h);
          setFit((f) => (f.content === content ? f : { ...f, content }));
        }}
      >
        {/* The display takes whatever room the pattern leaves and sits centred in it, at full
            size open or closed (founder, 2026-11-16: no gap under the bars, no shrinking). */}
        {/* Edge to edge, title bar down to the display's foot: measured, since an absolute
            child of the padded display could not reach past the page gutter. */}
        <DisplayFlash
          active={isRunning && model.outputs.visual && model.screenFlash}
          pulseToken={model.pulseToken}
          beat={model.heroPulseBeat}
          accentPattern={model.heroAccentPattern}
          height={displayBottom}
        />
        <View
          style={[s.display, model.practiceOn ? s.displayCompact : null]}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setDisplayBottom(Math.round(y + height));
            const display = Math.round(height);
            setFit((f) => (f.display === display ? f : { ...f, display }));
          }}
        >
          {/* The beat dots are the pulse: one place for where the beat is. They are the
              visual cue's Dots, so they are only there while Visual and Dots are on
              (founder, 2026-11-16: flash alone shows no dots). */}
          {model.outputs.visual && model.visualDots && !model.practiceOn ? (
            <MetronomeBeatBar
              beatsPerBar={model.meterPreset.pulsesPerBar}
              accentPattern={model.heroAccentPattern}
              grouping={model.grouping}
              currentBeat={model.currentBeatInBar}
              pulseToken={model.pulseToken}
              pulseBeat={model.heroPulseBeat}
              active={isRunning}
              variant="hero"
            />
          ) : null}
          {/* The unit labels its number from right beneath it (founder, 2026-11-16: "BPM"
              sat apart, beside the marking, and read as unrelated); the marking is the
              musician's word for the tempo, a quiet line of its own. */}
          {model.practiceOn ? (
            // The bars show the beat, so the dots step aside; the tempo reads as it always
            // does (number, unit, marking beneath), sized to fit (practiceLine).
            <View
              style={s.readoutStack}
              onLayout={(event) => {
                const readout = Math.round(event.nativeEvent.layout.height);
                setFit((f) => (f.readout === readout ? f : { ...f, readout }));
              }}
            >
              <View style={s.tempoReadout} accessible accessibilityLabel={`${model.bpm} ${t("metronome.bpm")}`}>
                <Text style={[s.bpmValue, practiceBpmStyle]}>{model.bpm}</Text>
                <Text style={s.bpmUnit}>{t("metronome.bpm")}</Text>
              </View>
              <Text style={[s.bpmMarking, s.bpmMarkingCompact]}>{t(`metronome.marking.${getTempoMarking(model.bpm)}`)}</Text>
            </View>
          ) : (
            <>
              <View style={s.tempoReadout} accessible accessibilityLabel={`${model.bpm} ${t("metronome.bpm")}`}>
                <Text style={s.bpmValue}>{model.bpm}</Text>
                <Text style={s.bpmUnit}>{t("metronome.bpm")}</Text>
              </View>
              <Text style={s.bpmMarking}>{t(`metronome.marking.${getTempoMarking(model.bpm)}`)}</Text>
            </>
          )}
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
                    {/* What the mode is for and what the dots mean live behind "?", there
                        before it is switched on too (founder, 2026-11-17). */}
                    <HelpButton compact onPress={() => setSheet("help")} />
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
              {/* Your pattern, or Random: the page hides the silences (founder, 2026-11-17). */}
              {random && model.randomShown ? (
                <RandomPattern
                  lead={modeTabs}
                  bars={model.randomShown}
                  silence={model.randomSilence}
                  onChangeSilence={model.setRandomSilence}
                  currentBar={model.randomCurrentBar}
                  currentBeat={model.randomCurrentBeat}
                />
              ) : (
                <PracticePattern
                  lead={modeTabs}
                  practice={model.practice}
                  baseBeats={model.accentPattern}
                  currentBar={model.practiceBar}
                  currentBeat={model.practiceBeat}
                  pulse={model.practicePulse}
                  onChange={model.setPractice}
                />
              )}
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
        thesis={t("metronome.practice.helpPurpose")}
        lead={t(random ? "metronome.practice.helpRandom" : "metronome.practice.helpTap")}
        items={[
          { mark: <PracticeDotMark tier="accent" />, label: t("metronome.practice.legendAccent"), description: t("metronome.practice.helpAccent") },
          { mark: <PracticeDotMark tier="click" />, label: t("metronome.practice.legendClick"), description: t("metronome.practice.helpClick") },
          { mark: <PracticeDotMark tier="rest" />, label: t("metronome.practice.legendSilent"), description: t("metronome.practice.helpSilent") },
          random
            ? { mark: <Fog />, label: t("metronome.practice.helpAheadLabel"), description: t("metronome.practice.helpAhead") }
            : { mark: <PracticeBarNumberMark />, label: t("metronome.practice.helpBarLabel"), description: t("metronome.practice.helpBar") },
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
          screenFlash={model.screenFlash}
          onChangeScreenFlash={model.setScreenFlash}
          visualDots={model.visualDots}
          onChangeVisualDots={model.setVisualDots}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}
