import { Text, View } from "react-native";
import { styles } from "../styles";
import type { useTunerScreenModel } from "../hooks/useTunerScreenModel";

type TunerModel = ReturnType<typeof useTunerScreenModel>;

function getMeterToneStyle(model: TunerModel) {
  switch (model.meterTone) {
    case "in_tune": return styles.indicatorInTune;
    case "near":    return styles.indicatorNear;
    case "far":     return styles.indicatorFar;
    case "active":  return styles.indicatorActive;
    default:        return styles.indicatorIdle;
  }
}

function getStatusLabel(model: TunerModel): string {
  if (!model.isListening) return "Waiting";
  if (!model.signalActive) return "Listening";
  if (model.meterTone === "in_tune") return "In Tune";
  if (model.meterTone === "near" || model.meterTone === "far") return "Tune Up";
  return "Signal";
}

export function TunerDial({ model }: { model: TunerModel }) {
  const detuneToneStyle = getMeterToneStyle(model);
  const detuneTextStyle =
    model.meterTone === "far" ? styles.detuneChipValueFar : styles.detuneChipValueNear;

  const isInTune = model.meterTone === "in_tune";
  const statusLabel = getStatusLabel(model);
  const isActive = model.signalActive;

  return (
    <View style={styles.dialSection}>
      <View style={styles.arcStage}>
        <View style={styles.flatMarker}>
          <Text style={styles.markerText}>♭</Text>
        </View>
        <View style={styles.sharpMarker}>
          <Text style={styles.markerText}>♯</Text>
        </View>

        <View style={styles.arcTrack} />
        <View style={styles.arcCutout} />

        {model.showFlatDetune ? (
          <View style={[
            styles.detuneAbsolute,
            styles.detuneAbsoluteFlat,
            model.meterTone === "far" ? styles.detuneAbsoluteFar : styles.detuneAbsoluteNear,
          ]}>
            <Text style={[styles.detuneChipValue, detuneTextStyle]}>
              {model.flatDetuneValue}
            </Text>
          </View>
        ) : null}

        {model.showSharpDetune ? (
          <View style={[
            styles.detuneAbsolute,
            styles.detuneAbsoluteSharp,
            model.meterTone === "far" ? styles.detuneAbsoluteFar : styles.detuneAbsoluteNear,
          ]}>
            <Text style={[styles.detuneChipValue, detuneTextStyle]}>
              {model.sharpDetuneValue}
            </Text>
          </View>
        ) : null}

        <View
          style={[styles.arcIndicator, detuneToneStyle, model.indicatorPosition]}
        />

        <View style={styles.noteBlock}>
          <View style={styles.noteRow}>
            <Text style={styles.noteText}>{model.noteText}</Text>
            {model.octaveText ? (
              <Text style={styles.octaveText}>{model.octaveText}</Text>
            ) : null}
          </View>
          <Text style={styles.hzInlineValue}>{model.frequencyLabel}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={[
          styles.statusDot,
          isInTune ? styles.statusDotInTune : isActive ? styles.statusDotActive : null,
        ]} />
        <Text style={[styles.statusLabel, isInTune ? styles.statusLabelInTune : null]}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}
