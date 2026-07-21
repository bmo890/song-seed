import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii } from "../../../design/tokens";
import {
  BeepLevelControl,
  CueTiles,
  HapticStrengthControl,
  MeterChips,
  TempoBlock,
  ms,
} from "../../common/metronome/MetronomeBlocks";
import {
  METRONOME_METER_PRESETS,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
} from "../../../domain/metronome";
import { useTranslation } from "react-i18next";

const COUNT_IN_OPTIONS = [0, 1, 2, 4];

function countInLabel(bars: number, t: (key: string, options?: any) => string) {
  return bars === 0 ? t("recording.off") : t("recording.barCount", { count: bars });
}

function countInSubtitle(bars: number, t: (key: string, options?: any) => string) {
  return bars === 0
    ? t("recording.startsImmediately")
    : t("recording.clickBars", { count: bars });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  disabled: boolean;
  isNativeAvailable: boolean;
  enabled: boolean;
  previewPlaying: boolean;
  bpm: number;
  meterId: MetronomeMeterId;
  countInBars: number;
  outputs: MetronomeOutputs;
  beepLevel: number;
  hapticLevel: number;
  tapCount: number;
  /** "Original take: 92 BPM · 4/4" when the target clip carries a saved recording grid
   *  (the metronome was preset to it on entry). Null when there's nothing to restore. */
  restoredGridLabel?: string | null;
  onTogglePreview: () => void;
  onNudgeBpm: (delta: number) => void;
  onSetBpmValue: (value: number) => void;
  onTapTempo: () => number | null;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
  onSelectCountInBars: (bars: number) => void;
  onToggleOutput: (key: MetronomeOutputKey) => void;
  onChangeBeepLevel: (level: number) => void;
  onChangeHapticLevel: (level: number) => void;
};

export function RecordingMetronomeSheet({
  visible,
  onClose,
  disabled,
  isNativeAvailable,
  enabled,
  previewPlaying,
  bpm,
  meterId,
  countInBars,
  outputs,
  beepLevel,
  hapticLevel,
  tapCount,
  restoredGridLabel,
  onTogglePreview,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
  onSelectMeter,
  onSelectCountInBars,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: Props) {
  const { t } = useTranslation();
  const meterLabel = METRONOME_METER_PRESETS.find((p) => p.id === meterId)?.label ?? "";
  const [expanded, setExpanded] = useState<"meter" | "countin" | null>(null);
  const toggleSection = (section: "meter" | "countin") =>
    setExpanded((prev) => (prev === section ? null : section));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={s.titleRow}>
        <View style={s.titleLead}>
          <Text style={s.title}>{t("recording.metronome")}</Text>
          {/* On/off lives on the metronome button itself now — this sheet only customizes. */}
          <Text style={s.titleSub}>{enabled ? t("recording.metronomeOn") : t("recording.metronomeOff")}</Text>
          {restoredGridLabel ? <Text style={s.titleGridNote}>{restoredGridLabel}</Text> : null}
        </View>
      </View>

      {isNativeAvailable ? (
        <Pressable
          style={({ pressed }) => [
            s.listenBtn,
            previewPlaying ? s.listenBtnActive : null,
            pressed ? ms.pressed : null,
          ]}
          onPress={onTogglePreview}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={previewPlaying ? t("recording.stopPreviewA11y") : t("recording.listenMetronome")}
        >
          <Ionicons
            name={previewPlaying ? "stop" : "play"}
            size={14}
            color={previewPlaying ? colors.onPrimary : colors.primaryDeep}
          />
          <Text style={[s.listenBtnText, previewPlaying ? s.listenBtnTextActive : null]}>
            {previewPlaying ? t("recording.stopPreview") : t("recording.listen")}
          </Text>
        </Pressable>
      ) : null}

      {!isNativeAvailable ? (
        <Text style={s.disabledNote}>{t("recording.nativeUnavailable")}</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Tempo — shared block */}
          <Text style={ms.label}>{t("recording.tempo")}</Text>
          <TempoBlock
            bpm={bpm}
            tapCount={tapCount}
            disabled={disabled}
            onNudgeBpm={onNudgeBpm}
            onSetBpmValue={onSetBpmValue}
            onTapTempo={onTapTempo}
          />

          {/* Count-in — pronounced, self-explaining row (recording-only concept) */}
          <Pressable
            style={({ pressed }) => [s.featureRow, ms.divider, pressed ? ms.pressed : null]}
            onPress={() => toggleSection("countin")}
            disabled={disabled}
          >
            <View style={s.featureLead}>
              <View style={s.iconTile}>
                <Ionicons name="timer-outline" size={18} color={colors.primaryDeep} />
              </View>
              <View style={s.featureCopy}>
                <Text style={s.featureTitle}>{t("recording.countIn")}</Text>
                <Text style={s.featureSub} numberOfLines={1}>{countInSubtitle(countInBars, t)}</Text>
              </View>
            </View>
            <View style={ms.valuePill}>
              <Text style={ms.valueText}>{countInLabel(countInBars, t)}</Text>
              <Ionicons name={expanded === "countin" ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
            </View>
          </Pressable>
          {expanded === "countin" ? (
            <View style={ms.segmentGroup}>
              {COUNT_IN_OPTIONS.map((bars) => {
                const active = countInBars === bars;
                return (
                  <Pressable
                    key={bars}
                    style={({ pressed }) => [ms.segment, active ? ms.segmentActive : null, pressed ? ms.pressed : null]}
                    onPress={() => {
                      onSelectCountInBars(bars);
                      setExpanded(null);
                    }}
                    disabled={disabled}
                  >
                    <Text style={[ms.segmentText, active ? ms.segmentTextActive : null]}>{countInLabel(bars, t)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Meter — quiet row, chips disclosed on demand (sheet stays compact) */}
          <Pressable
            style={({ pressed }) => [ms.quietRow, ms.divider, pressed ? ms.pressed : null]}
            onPress={() => toggleSection("meter")}
            disabled={disabled}
          >
            <Text style={ms.quietLabel}>{t("recording.meter")}</Text>
            <View style={ms.valuePill}>
              <Text style={ms.valueText}>{meterLabel}</Text>
              <Ionicons name={expanded === "meter" ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
            </View>
          </Pressable>
          {expanded === "meter" ? (
            <MeterChips
              meterId={meterId}
              disabled={disabled}
              onSelectMeter={(id) => {
                onSelectMeter(id);
                setExpanded(null);
              }}
            />
          ) : null}

          {/* Cues — shared square toggles */}
          <Text style={[ms.label, ms.divider, { paddingTop: 14 }]}>{t("recording.cues")}</Text>
          <CueTiles outputs={outputs} disabled={disabled} onToggleOutput={onToggleOutput} />

          {/* Levels stay adjustable mid-take: volume is a live param on the native engine
              (no restart, no phase reset) and haptic strength is JS-side only. Structural
              controls (tempo/meter/count-in/cue toggles) stay locked while recording. */}
          {outputs.beep ? (
            <BeepLevelControl beepLevel={beepLevel} onChangeBeepLevel={onChangeBeepLevel} />
          ) : null}

          {outputs.haptic ? (
            <HapticStrengthControl hapticLevel={hapticLevel} onChangeHapticLevel={onChangeHapticLevel} />
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleLead: {
    flexShrink: 1,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  titleSub: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    marginTop: 1,
  },
  titleGridNote: {
    fontSize: 11,
    color: colors.primaryDeep,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginTop: 2,
  },
  listenBtn: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    marginTop: 12,
  },
  listenBtnActive: {
    backgroundColor: colors.primary,
  },
  listenBtnText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  listenBtnTextActive: {
    color: colors.onPrimary,
  },
  disabledNote: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    paddingBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 16,
  },
  featureLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    backgroundColor: "#F2E4DF",
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: {
    flexShrink: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textPrimary,
  },
  featureSub: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    marginTop: 1,
  },
});
