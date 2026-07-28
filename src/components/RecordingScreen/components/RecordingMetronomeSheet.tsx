import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii } from "../../../design/tokens";
import {
  CueLevels,
  CueTiles,
  GroupingChips,
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
  onToggleEnabled: (next: boolean) => void;
  previewPlaying: boolean;
  bpm: number;
  meterId: MetronomeMeterId;
  grouping: readonly number[];
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
  onSelectGrouping: (meterId: MetronomeMeterId, grouping: number[] | null) => void;
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
  onToggleEnabled,
  previewPlaying,
  bpm,
  meterId,
  grouping,
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
  onSelectGrouping,
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
          <Text style={s.titleSub}>{enabled ? t("recording.metronomeOn") : t("recording.metronomeOff")}</Text>
          {restoredGridLabel ? <Text style={s.titleGridNote}>{restoredGridLabel}</Text> : null}
        </View>
        {/* The switch lives here as well as on the toolbar glyph. A panel that
            states "On — clicks while you record" and offers no way to change it
            reads as a setting you can't reach. */}
        <Switch
          value={enabled}
          onValueChange={onToggleEnabled}
          disabled={disabled || !isNativeAvailable}
          trackColor={{ false: "#E3DCD4", true: colors.primary }}
          thumbColor={colors.surface}
        />
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
              <View style={s.featureCopy}>
                <Text style={s.featureTitle}>{t("recording.countIn")}</Text>
                <Text style={s.featureSub} numberOfLines={1}>{countInSubtitle(countInBars, t)}</Text>
              </View>
            </View>
            {/* The value is dropped once the options are open — it just repeats
                the selected one three lines below. */}
            <View style={ms.valuePill}>
              {expanded === "countin" ? null : (
                <Text style={ms.valueText}>{countInLabel(countInBars, t)}</Text>
              )}
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
              {expanded === "meter" ? null : <Text style={ms.valueText}>{meterLabel}</Text>}
              <Ionicons name={expanded === "meter" ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
            </View>
          </Pressable>
          {expanded === "meter" ? (
            <>
              <MeterChips
                meterId={meterId}
                disabled={disabled}
                onSelectMeter={onSelectMeter}
              />
              {/* Grouping sits with the meter it belongs to. The section no
                  longer auto-closes on pick: choosing 5/4 and then 3+2 is one
                  decision, and closing between the two halves fought it. */}
              <GroupingChips
                meterId={meterId}
                grouping={grouping}
                disabled={disabled}
                onSelectGrouping={onSelectGrouping}
              />
            </>
          ) : null}

          {/* Cues — shared square toggles */}
          <Text style={[ms.label, ms.divider, { paddingTop: 14 }]}>{t("recording.cues")}</Text>
          <CueTiles outputs={outputs} disabled={disabled} onToggleOutput={onToggleOutput} />

          {/* Levels stay adjustable mid-take: volume is a live param on the native engine
              (no restart, no phase reset) and haptic strength is JS-side only. Structural
              controls (tempo/meter/count-in/cue toggles) stay locked while recording. */}
          <CueLevels
            outputs={outputs}
            beepLevel={beepLevel}
            hapticLevel={hapticLevel}
            onChangeBeepLevel={onChangeBeepLevel}
            onChangeHapticLevel={onChangeHapticLevel}
          />
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
    fontFamily: "Lora_600SemiBold",
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
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
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
