import { Text, View } from "react-native";
import { styles } from "../styles";
import type { useTunerScreenModel } from "../hooks/useTunerScreenModel";

type TunerModel = ReturnType<typeof useTunerScreenModel>;

function getMeterToneStyle(model: TunerModel) {
  switch (model.meterTone) {
    case "in_tune":
      return styles.indicatorInTune;
    case "near":
      return styles.indicatorNear;
    case "far":
      return styles.indicatorFar;
    case "active":
      return styles.indicatorActive;
    default:
      return styles.indicatorIdle;
  }
}

export function TunerDial({ model }: { model: TunerModel }) {
  const detuneToneStyle = getMeterToneStyle(model);
  const detuneTextStyle =
    model.meterTone === "far" ? styles.detuneChipValueFar : styles.detuneChipValueNear;

  return (
    <View style={styles.dialSection}>
      <View style={styles.arcStage}>
        <View style={styles.flatMarker}>
          <Text style={styles.markerText}>-</Text>
        </View>
        <View style={styles.sharpMarker}>
          <Text style={styles.markerText}>+</Text>
        </View>

        <View style={styles.arcTrack} />
        <View style={styles.arcCutout} />

        {(model.showFlatDetune || model.showSharpDetune) && (
          <View
            style={[
              styles.detuneAbsolute,
              model.meterTone === "far"
                ? styles.detuneAbsoluteFar
                : styles.detuneAbsoluteNear,
            ]}
          >
            <Text style={[styles.detuneChipValue, detuneTextStyle]}>
              {model.showFlatDetune ? model.flatDetuneValue : model.sharpDetuneValue}
            </Text>
          </View>
        )}

        <View
          style={[styles.arcIndicator, detuneToneStyle, model.indicatorPosition]}
        />

        <View style={styles.noteBlock}>
          <View style={styles.noteRow}>
            <Text style={styles.noteText}>{model.noteText}</Text>
            <Text style={styles.octaveText}>{model.octaveText}</Text>
          </View>
          <Text style={styles.hzInlineValue}>{model.frequencyLabel}</Text>
        </View>
      </View>
    </View>
  );
}
