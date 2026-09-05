import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { IconButton } from "../../common/IconButton";
import { colors, radii } from "../../../design/tokens";
import {
  CueLevels,
  CueTiles,
  GroupingChips,
  MeterChips,
  SubdivisionControl,
  TempoBlock,
  ms,
} from "../../common/metronome/MetronomeBlocks";
import {
  clampMetronomeBpm,
  METRONOME_COUNT_IN_BAR_OPTIONS,
  METRONOME_METER_PRESETS,
  type MetronomeClickVoice,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
  type MetronomeSubdivision,
} from "../../../domain/metronome";
import {
  normalizeTempoMap,
  TEMPO_MAP_SCHEMA_VERSION,
  type TempoMap,
  type TempoSegment,
} from "../../../domain/tempoMap";
import { useTranslation } from "react-i18next";

// The domain owns the option list, so the picker can never offer a value the
// store clamps away (4 bars used to be exactly that).
const COUNT_IN_OPTIONS: readonly number[] = METRONOME_COUNT_IN_BAR_OPTIONS;

function countInLabel(bars: number, t: (key: string, options?: any) => string) {
  return bars === 0 ? t("recording.off") : t("recording.barCount", { count: bars });
}

function countInSubtitle(bars: number, t: (key: string, options?: any) => string) {
  return bars === 0
    ? t("recording.startsImmediately")
    : t("recording.clickBars", { count: bars });
}

/** Small square stepper key for the change editor — same voice as ms.segment chips. */
function StepChip({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.stepChip, disabled ? s.stepChipDisabled : null, pressed ? ms.pressed : null]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={s.stepChipText}>{label}</Text>
    </Pressable>
  );
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
  /** Sub-clicks per beat and click timbre — both structural on the engine, so they
   *  lock mid-take like tempo and meter. Omitted when the binary can't render them. */
  subdivision?: MetronomeSubdivision;
  onSelectSubdivision?: (value: MetronomeSubdivision) => void;
  clickVoice?: MetronomeClickVoice;
  onSelectClickVoice?: (voice: MetronomeClickVoice) => void;
  /** "Original take: 92 BPM · 4/4" when the target clip carries a saved recording grid
   *  (the metronome was preset to it on entry). Null when there's nothing to restore. */
  restoredGridLabel?: string | null;
  onTogglePreview: () => void;
  onNudgeBpm: (delta: number) => void;
  onSetBpmValue: (value: number) => void;
  onTapTempo: () => number | null;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
  onSelectGrouping: (meterId: MetronomeMeterId, grouping: number[] | null) => void;
  /** The sketch's programmed tempo/meter changes. Undefined callback hides the whole
   *  section (overdubs and variations follow the master's frozen grid instead). */
  songGrid?: TempoMap | null;
  onChangeSongGrid?: (next: TempoMap | null) => void;
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
  subdivision,
  onSelectSubdivision,
  clickVoice,
  onSelectClickVoice,
  restoredGridLabel,
  onTogglePreview,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
  onSelectMeter,
  onSelectGrouping,
  songGrid,
  onChangeSongGrid,
  onSelectCountInBars,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: Props) {
  const { t } = useTranslation();
  const meterLabel = METRONOME_METER_PRESETS.find((p) => p.id === meterId)?.label ?? "";
  const [expanded, setExpanded] = useState<"meter" | "countin" | "changes" | null>(null);
  const toggleSection = (section: "meter" | "countin" | "changes") =>
    setExpanded((prev) => (prev === section ? null : section));

  // ── Programmed changes (the sketch's plan) ────────────────────────────────
  // The ROWS live in local draft state: a freshly added change starts equal to the
  // current tempo/meter, which the persisted map rightly normalizes away as a no-op —
  // the draft keeps it visible while it's being shaped. Every edit commits the
  // normalized map (segment 1 = the sheet's live tempo/meter); untouched no-op rows
  // simply never persist.
  const [draftChanges, setDraftChanges] = useState<TempoSegment[]>([]);
  const [editingChangeBar, setEditingChangeBar] = useState<number | null>(null);
  const [draftSyncedForVisible, setDraftSyncedForVisible] = useState(false);
  if (visible && !draftSyncedForVisible) {
    // Adopt the stored plan on open (adjust-state-in-render — no post-paint flash).
    setDraftSyncedForVisible(true);
    setDraftChanges((songGrid?.segments ?? []).filter((segment) => segment.atBar > 1));
    setEditingChangeBar(null);
  } else if (!visible && draftSyncedForVisible) {
    setDraftSyncedForVisible(false);
  }
  const changes = draftChanges;
  const commitChanges = (nextChanges: TempoSegment[]) => {
    if (!onChangeSongGrid) return;
    setDraftChanges(nextChanges);
    if (nextChanges.length === 0) {
      onChangeSongGrid(null);
      return;
    }
    onChangeSongGrid(
      normalizeTempoMap({
        schemaVersion: TEMPO_MAP_SCHEMA_VERSION,
        segments: [{ atBar: 1, bpm, meterId }, ...nextChanges],
      })
    );
  };
  const addChange = () => {
    const previous = changes[changes.length - 1] ?? { atBar: 1, bpm, meterId };
    const atBar = previous.atBar + 8;
    commitChanges([...changes, { atBar, bpm: previous.bpm, meterId: previous.meterId }]);
    setEditingChangeBar(atBar);
  };
  const updateChange = (atBar: number, patch: Partial<TempoSegment>) => {
    commitChanges(
      changes.map((segment) => (segment.atBar === atBar ? { ...segment, ...patch } : segment))
    );
    if (patch.atBar != null) {
      setEditingChangeBar(patch.atBar);
    }
  };
  const removeChange = (atBar: number) => {
    commitChanges(changes.filter((segment) => segment.atBar !== atBar));
    if (editingChangeBar === atBar) {
      setEditingChangeBar(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={s.titleRow}>
        <View style={s.titleLead}>
          <Text style={s.title}>{t("recording.metronome")}</Text>
          <Text style={s.titleSub}>{enabled ? t("recording.metronomeOn") : t("recording.metronomeOff")}</Text>
          {restoredGridLabel ? <Text style={s.titleGridNote}>{restoredGridLabel}</Text> : null}
        </View>
        {/* Audition sits with the switch instead of alone on its own row — a
            secondary action, so a glyph, and it stops the sheet opening with an
            empty band across it. */}
        {isNativeAvailable ? (
          <IconButton
            icon={previewPlaying ? "stop" : "play"}
            tone={previewPlaying ? "accent" : "muted"}
            size={19}
            disabled={disabled}
            onPress={() => void onTogglePreview()}
            accessibilityLabel={previewPlaying ? t("recording.stopPreviewA11y") : t("recording.listenMetronome")}
          />
        ) : null}
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
          {subdivision != null && onSelectSubdivision ? (
            <SubdivisionControl value={subdivision} disabled={disabled} onChange={onSelectSubdivision} />
          ) : null}

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

          {/* Programmed changes — the sketch's plan. A tempo/meter change takes effect
              at a bar line; the take snapshots the plan and the click follows it. */}
          {onChangeSongGrid ? (
            <>
              <Pressable
                style={({ pressed }) => [ms.quietRow, ms.divider, pressed ? ms.pressed : null]}
                onPress={() => toggleSection("changes")}
                disabled={disabled}
              >
                <Text style={ms.quietLabel}>{t("recording.changes")}</Text>
                <View style={ms.valuePill}>
                  {expanded === "changes" ? null : (
                    <Text style={ms.valueText}>
                      {changes.length === 0
                        ? t("recording.off")
                        : t("recording.changeCount", { count: changes.length })}
                    </Text>
                  )}
                  <Ionicons name={expanded === "changes" ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
                </View>
              </Pressable>
              {expanded === "changes" ? (
                <View>
                  {changes.map((segment) => {
                    const editing = editingChangeBar === segment.atBar;
                    return (
                      <View key={segment.atBar}>
                        <Pressable
                          style={({ pressed }) => [s.changeRow, pressed ? ms.pressed : null]}
                          onPress={() => setEditingChangeBar(editing ? null : segment.atBar)}
                          disabled={disabled}
                        >
                          <Text style={s.changeBar}>{t("recording.changeBar", { bar: segment.atBar })}</Text>
                          <Text style={s.changeValue}>{`${segment.meterId} · ${segment.bpm}`}</Text>
                          <IconButton
                            icon="close"
                            tone="muted"
                            size={15}
                            disabled={disabled}
                            onPress={() => removeChange(segment.atBar)}
                            accessibilityLabel={t("recording.removeChangeA11y")}
                          />
                        </Pressable>
                        {editing ? (
                          <View style={s.changeEditor}>
                            <View style={s.changeStepperRow}>
                              <Text style={s.changeStepperLabel}>{t("recording.changeBar", { bar: segment.atBar })}</Text>
                              <View style={s.changeStepperGroup}>
                                <StepChip
                                  label="−"
                                  disabled={disabled || segment.atBar <= 2}
                                  onPress={() => updateChange(segment.atBar, { atBar: Math.max(2, segment.atBar - 1) })}
                                />
                                <StepChip
                                  label="+"
                                  disabled={disabled}
                                  onPress={() => updateChange(segment.atBar, { atBar: segment.atBar + 1 })}
                                />
                              </View>
                            </View>
                            <View style={s.changeStepperRow}>
                              <Text style={s.changeStepperLabel}>{`${segment.bpm} BPM`}</Text>
                              <View style={s.changeStepperGroup}>
                                <StepChip
                                  label="−5"
                                  disabled={disabled}
                                  onPress={() => updateChange(segment.atBar, { bpm: clampMetronomeBpm(segment.bpm - 5) })}
                                />
                                <StepChip
                                  label="−1"
                                  disabled={disabled}
                                  onPress={() => updateChange(segment.atBar, { bpm: clampMetronomeBpm(segment.bpm - 1) })}
                                />
                                <StepChip
                                  label="+1"
                                  disabled={disabled}
                                  onPress={() => updateChange(segment.atBar, { bpm: clampMetronomeBpm(segment.bpm + 1) })}
                                />
                                <StepChip
                                  label="+5"
                                  disabled={disabled}
                                  onPress={() => updateChange(segment.atBar, { bpm: clampMetronomeBpm(segment.bpm + 5) })}
                                />
                              </View>
                            </View>
                            <MeterChips
                              meterId={segment.meterId}
                              disabled={disabled}
                              onSelectMeter={(nextMeterId) => updateChange(segment.atBar, { meterId: nextMeterId })}
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  <Pressable
                    style={({ pressed }) => [s.addChangeRow, pressed ? ms.pressed : null]}
                    onPress={addChange}
                    disabled={disabled}
                  >
                    <Ionicons name="add" size={15} color={colors.primaryDeep} />
                    <Text style={s.addChangeText}>{t("recording.addChange")}</Text>
                  </Pressable>
                </View>
              ) : null}
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
            clickVoice={clickVoice}
            onChangeClickVoice={onSelectClickVoice}
            voiceDisabled={disabled}
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
    gap: 14,
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleLead: {
    flex: 1,
    minWidth: 0,
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
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  changeBar: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  changeValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  changeEditor: {
    paddingBottom: 8,
    gap: 8,
  },
  changeStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  changeStepperLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  changeStepperGroup: {
    flexDirection: "row",
    gap: 6,
  },
  stepChip: {
    minWidth: 36,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  stepChipDisabled: {
    opacity: 0.4,
  },
  stepChipText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  addChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  addChangeText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
});
