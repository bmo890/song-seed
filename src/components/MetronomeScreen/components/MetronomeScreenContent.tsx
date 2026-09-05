import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { HelpButton } from "../../common/HelpButton";
import { HelpSheet } from "../../common/HelpSheet";
import { METRONOME_HELP } from "../../common/helpContent";
import { AnimatedCollapse } from "../../common/AnimatedCollapse";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";
import { durations } from "../../../design/motion";
import { METRONOME_METER_PRESETS, getTempoMarking } from "../../../domain/metronome";
import {
  CueLevels,
  CueTiles,
  GroupingChips,
  MeterChips,
  SubdivisionControl,
  SUBDIVISION_LABEL_KEYS,
  TempoBlock,
  ms,
} from "../../common/metronome/MetronomeBlocks";
import { MetronomeBeatBar } from "../../common/metronome/MetronomeBeatBar";
import { styles as s } from "../styles";
import { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";
import { useTranslation } from "react-i18next";

/**
 * A section that can be folded away once its choice is made. The chevron is the
 * whole affordance — the header row is the target, so no button competes with
 * the page's one primary action. The current value stays on the row while
 * collapsed, so folding hides the controls, never the state.
 */
function SectionDisclosure({
  label,
  value,
  expanded,
  onToggle,
}: {
  label: string;
  value?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={ms.quietRow}
      onPress={() => {
        // Haptics vocabulary: `tap` — "accordion open/close".
        haptic.tap();
        onToggle();
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={label}
    >
      <Text style={ms.quietLabel}>{label}</Text>
      <View style={s.disclosureRight}>
        {value ? (
          <View style={ms.valuePill}>
            <Text style={ms.valueText}>{value}</Text>
          </View>
        ) : null}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textMuted}
        />
      </View>
    </Pressable>
  );
}

/**
 * Start / Stop. The label and the fill used to swap in the same instant — three
 * words of different widths over an inverting background — which read as a
 * flicker rather than a state change. Both now crossfade (fade only, per the
 * motion vocabulary), and the word is held until its fade-out completes so the
 * text never changes while it is fully visible.
 */
function TransportButton({
  isRunning,
  label,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  isRunning: boolean;
  label: string;
  disabled: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const fill = useRef(new Animated.Value(isRunning ? 1 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const [shownLabel, setShownLabel] = useState(label);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: isRunning ? 1 : 0,
      duration: durations.base,
      // Colour interpolation is not natively drivable.
      useNativeDriver: false,
    }).start();
  }, [isRunning, fill]);

  useEffect(() => {
    if (label === shownLabel) return;
    Animated.timing(labelOpacity, {
      toValue: 0,
      duration: durations.fast,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setShownLabel(label);
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: durations.fast,
        useNativeDriver: false,
      }).start();
    });
  }, [label, shownLabel, labelOpacity]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed ? ms.pressed : null]}
    >
      <Animated.View
        style={[
          s.primaryAction,
          disabled ? s.primaryActionDisabled : null,
          {
            backgroundColor: fill.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.primaryDeep, colors.surfaceContainer],
            }),
          },
        ]}
      >
        <Animated.Text
          style={[
            s.primaryActionText,
            {
              opacity: labelOpacity,
              color: fill.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.onPrimary, colors.primaryDeep],
              }),
            },
          ]}
        >
          {shownLabel}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Standalone metronome — the in-recorder sheet's control vocabulary on a full
 * page, one screen tall (the ScrollView only engages on very short devices).
 * Where the sheet has Count-in (a recording-only concept), the page has what
 * the sheet never needed: Start/Stop and a big visual beat.
 */
export function MetronomeScreenContent() {
  const { t } = useTranslation();
  const model = useMetronomeScreenModel();
  const [helpVisible, setHelpVisible] = useState(false);
  // Both open by default: the page reads exactly as before until the user folds
  // something away. Session-local — a metronome is set and left, not configured.
  const [subdivisionOpen, setSubdivisionOpen] = useState(true);
  const [meterOpen, setMeterOpen] = useState(true);
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
      <ScreenHeader
        title={t("screens.metronome")}
        leftIcon="hamburger"
        rightElement={<HelpButton onPress={() => setHelpVisible(true)} />}
      />

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
          <Text style={s.bpmUnit}>{t("metronome.bpm")}</Text>
          {/* The classical marking — a musician's word for the number above it. */}
          <Text style={s.tempoMarking}>{t(`metronome.marking.${getTempoMarking(model.bpm)}`)}</Text>

          <MetronomeBeatBar
            beatsPerBar={model.meterPreset.pulsesPerBar}
            accentPattern={model.accentPattern}
            grouping={model.grouping}
            currentBeat={model.currentBeatInBar}
            pulseToken={model.pulseToken}
            active={beatBarActive}
            variant="hero"
          />

          <TransportButton
            isRunning={isRunning}
            label={
              model.isPreparing
                ? t("metronome.preparing")
                : isRunning
                  ? t("metronome.stop")
                  : t("metronome.start")
            }
            disabled={model.isPreparing || !model.isNativeAvailable}
            accessibilityLabel={isRunning ? t("metronome.stopA11y") : t("metronome.startA11y")}
            onPress={() => {
              haptic.tap();
              model.toggleRunning();
            }}
          />

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

        {/* Subdivision — foldable once chosen; the row keeps showing which one. */}
        {model.supportsClickStyle ? (
          <View style={[ms.divider, s.sectionGap]}>
            <SectionDisclosure
              label={t("metronome.subdivision")}
              value={t(SUBDIVISION_LABEL_KEYS[model.subdivision])}
              expanded={subdivisionOpen}
              onToggle={() => setSubdivisionOpen((open) => !open)}
            />
            <AnimatedCollapse visible={subdivisionOpen}>
              <SubdivisionControl
                hideLabel
                value={model.subdivision}
                onChange={model.setSubdivisionValue}
              />
            </AnimatedCollapse>
          </View>
        ) : null}

        {/* Meter — same disclosure; the value pill carries the choice when folded. */}
        <View style={[ms.divider, s.sectionGap]}>
          <SectionDisclosure
            label={t("metronome.meter")}
            value={meterLabel}
            expanded={meterOpen}
            onToggle={() => setMeterOpen((open) => !open)}
          />
          <AnimatedCollapse visible={meterOpen}>
            <MeterChips meterId={model.meterId} onSelectMeter={model.setMeterIdValue} />
            {/* How the bar is felt — only shown when the meter offers a choice. */}
            <GroupingChips
              meterId={model.meterId}
              grouping={model.grouping}
              onSelectGrouping={model.setGrouping}
            />
          </AnimatedCollapse>
        </View>

        {/* Cues — shared tiles + conditional level controls */}
        <View style={[ms.divider, s.sectionGap]}>
          <Text style={ms.label}>{t("metronome.cues")}</Text>
          <CueTiles outputs={model.outputs} onToggleOutput={model.toggleOutput} />
          <CueLevels
            outputs={model.outputs}
            beepLevel={model.beepLevel}
            hapticLevel={model.hapticLevel}
            onChangeBeepLevel={model.setBeepLevelValue}
            onChangeHapticLevel={model.setHapticLevelValue}
            clickVoice={model.supportsClickStyle ? model.clickVoice : undefined}
            onChangeClickVoice={model.supportsClickStyle ? model.setClickVoiceValue : undefined}
          />
        </View>
      </ScrollView>

      <HelpSheet
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title={METRONOME_HELP.title}
        intro={METRONOME_HELP.intro}
        items={METRONOME_HELP.items}
      />
    </SafeAreaView>
  );
}
