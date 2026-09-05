import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { styles, toneColor, type MeterTone } from "../styles";
import { colors } from "../../../design/tokens";
import { springs } from "../../../design/motion";
import type { useTunerScreenModel } from "../hooks/useTunerScreenModel";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

type TunerModel = ReturnType<typeof useTunerScreenModel>;

function getStatusLabel(model: TunerModel, t: TFunction): string {
  if (!model.isListening) return t("tuner.waiting");
  if (!model.signalActive) return t("tuner.listening");
  if (model.meterTone === "in_tune") return t("tuner.inTune");
  if (model.showFlatDetune) return t("tuner.tuneUp");
  if (model.showSharpDetune) return t("tuner.tuneDown");
  return t("tuner.signal");
}

export function TunerDial({ model }: { model: TunerModel }) {
  const { t } = useTranslation();
  const tone = model.meterTone as MeterTone;
  const color = toneColor(tone);
  const isInTune = tone === "in_tune";
  const hasReading = tone === "far" || tone === "near" || isInTune;

  // The detector reports ~10–20× a second; the needle glides between readings
  // on the `handle` spring (a needle tracks the string the way a handle tracks
  // a finger) instead of stepping, so the eye reads motion, not frames.
  const needleCents = useRef(new Animated.Value(model.needleCents)).current;
  useEffect(() => {
    Animated.spring(needleCents, {
      toValue: model.needleCents,
      ...springs.handle,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [model.needleCents, needleCents]);

  const needleRotation = needleCents.interpolate({
    inputRange: [-50, 50],
    outputRange: ["0deg", "180deg"],
    extrapolate: "clamp",
  });

  // Only the side the string is on lights up; the other stays quiet ink.
  const flatColor = model.showFlatDetune ? color : colors.borderMuted;
  const sharpColor = model.showSharpDetune ? color : colors.borderMuted;

  return (
    <View style={styles.dialSection}>
      <View style={styles.arcStage}>
        <View style={[styles.arcTrack, isInTune ? { borderColor: color } : null]} />
        <View style={[styles.arcCenterTick, isInTune ? { backgroundColor: color } : null]} />

        <Animated.View
          style={[styles.needlePivot, { transform: [{ rotate: needleRotation }] }]}
        >
          <View style={[styles.arcIndicator, { backgroundColor: color }]} />
        </Animated.View>

        <View style={[styles.marker, styles.markerFlat]}>
          <Text style={[styles.markerText, { color: flatColor }]}>♭</Text>
        </View>
        <View style={[styles.marker, styles.markerSharp]}>
          <Text style={[styles.markerText, { color: sharpColor }]}>♯</Text>
        </View>

        {model.showFlatDetune ? (
          <View style={[styles.detuneBox, styles.detuneBoxFlat]}>
            <Text style={[styles.detuneValue, { color }]}>{model.flatDetuneValue}</Text>
          </View>
        ) : null}

        {model.showSharpDetune ? (
          <View style={[styles.detuneBox, styles.detuneBoxSharp]}>
            <Text style={[styles.detuneValue, { color }]}>{model.sharpDetuneValue}</Text>
          </View>
        ) : null}

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
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text
          style={[
            styles.statusLabel,
            { color: hasReading ? color : colors.textSecondary },
          ]}
        >
          {getStatusLabel(model, t)}
        </Text>
      </View>
    </View>
  );
}
