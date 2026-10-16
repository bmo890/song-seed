import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Switch } from "../../common/Switch";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { IconButton } from "../../common/IconButton";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { colors, radii, spacing } from "../../../design/tokens";
import { CueRows, FeelControl, MeterRow, TempoBlock, ms } from "../../common/metronome/MetronomeBlocks";
import { SegmentedControl } from "../../common/SegmentedControl";
import { Stepper } from "../../common/Stepper";
import {
  clampMetronomeBpm,
  METRONOME_COUNT_IN_BAR_OPTIONS,
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
  /** "Click on": the feel in force for this meter, its weights, and what the
   *  binary can render (rests, sub-clicks). Structural, so it locks mid-take. */
  feelId: string;
  accentPattern: readonly number[];
  subdivision: MetronomeSubdivision;
  supportsRests: boolean;
  supportsSubdivision: boolean;
  onSelectFeel: (feelId: string) => void;
  onChangeCustomPattern: (pattern: number[]) => void;
  countInBars: number;
  outputs: MetronomeOutputs;
  beepLevel: number;
  hapticLevel: number;
  tapCount: number;
  /** Click timbre — structural on the engine, so it locks mid-take like tempo and
   *  meter. Omitted when the binary can't render it. */
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
  feelId,
  accentPattern,
  subdivision,
  supportsRests,
  supportsSubdivision,
  onSelectFeel,
  onChangeCustomPattern,
  countInBars,
  outputs,
  beepLevel,
  hapticLevel,
  tapCount,
  clickVoice,
  onSelectClickVoice,
  restoredGridLabel,
  onTogglePreview,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
  onSelectMeter,
  songGrid,
  onChangeSongGrid,
  onSelectCountInBars,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<"changes" | null>(null);
  const toggleSection = (section: "changes") =>
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
          // Audition is a toolbar key beside the switch: glyph and word in ink,
          // terracotta while it plays (2026-10-16; was a lone filled square).
          <View style={disabled ? ms.dimmed : null} pointerEvents={disabled ? "none" : "auto"}>
            <InkKey
              glyph={
                <Ionicons
                  name={previewPlaying ? "stop" : "play-outline"}
                  size={15}
                  color={inkKeyColor(previewPlaying ? "active" : "idle")}
                />
              }
              label={t("recording.listen")}
              tone={previewPlaying ? "active" : "idle"}
              role="switch"
              // Haptics vocabulary: a toggle is `light`.
              haptic="light"
              onPress={() => void onTogglePreview()}
              accessibilityLabel={previewPlaying ? t("recording.stopPreviewA11y") : t("recording.listenMetronome")}
            />
          </View>
        ) : null}
        {/* The switch lives here as well as on the toolbar glyph. A panel that
            states "On — clicks while you record" and offers no way to change it
            reads as a setting you can't reach. */}
        <Switch value={enabled} onValueChange={onToggleEnabled} disabled={disabled || !isNativeAvailable} />
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

          {/* Meter — all eight on one line, no disclosure needed to see them. */}
          <Text style={ms.label}>{t("recording.meter")}</Text>
          <MeterRow meterId={meterId} disabled={disabled} onSelectMeter={onSelectMeter} />

          {/* Click on — the feel for this meter; the strip shows the bar you'll hear. */}
          <FeelControl
            meterId={meterId}
            feelId={feelId}
            accentPattern={accentPattern}
            subdivision={subdivision}
            supportsRests={supportsRests}
            supportsSubdivision={supportsSubdivision}
            disabled={disabled}
            onSelectFeel={onSelectFeel}
            onChangeCustomPattern={onChangeCustomPattern}
          />
          <View style={s.feelGap} />

          {/* Count-in (recording-only): one choice of a few, so ink tabs, always
              in view with its one line saying what it does (2026-10-15; was a
              disclosure opening filled terracotta segments). */}
          <View style={ms.divider} />
          <Text style={ms.label}>{t("recording.countIn")}</Text>
          <View style={disabled ? ms.dimmed : null} pointerEvents={disabled ? "none" : "auto"}>
            <SegmentedControl
              options={COUNT_IN_OPTIONS.map((bars) => ({ key: String(bars), label: countInLabel(bars, t) }))}
              value={String(countInBars)}
              onChange={(key) => onSelectCountInBars(Number(key))}
            />
          </View>
          <Text style={s.countInNote}>{countInSubtitle(countInBars, t)}</Text>

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
                {/* The value in quiet ink beside the chevron; no pill. */}
                <View style={s.disclosureValue}>
                  {expanded === "changes" ? null : (
                    <Text style={s.disclosureValueText}>
                      {changes.length === 0
                        ? t("recording.off")
                        : t("recording.changeCount", { count: changes.length })}
                    </Text>
                  )}
                  <Ionicons name={expanded === "changes" ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
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
                              <Stepper
                                glyphs="plusMinus"
                                canDecrement={!disabled && segment.atBar > 2}
                                canIncrement={!disabled}
                                decrementLabel={t("recording.changeEarlier")}
                                incrementLabel={t("recording.changeLater")}
                                onStep={(direction) =>
                                  updateChange(segment.atBar, { atBar: Math.max(2, segment.atBar + direction) })
                                }
                              />
                            </View>
                            <View style={s.changeStepperRow}>
                              <Text style={s.changeStepperLabel}>{`${segment.bpm} BPM`}</Text>
                              {/* The kit Stepper: hold to run (replaces the ±5 chips). */}
                              <Stepper
                                glyphs="plusMinus"
                                canDecrement={!disabled}
                                canIncrement={!disabled}
                                decrementLabel={t("metronome.slow")}
                                incrementLabel={t("metronome.raise")}
                                onStep={(direction) =>
                                  updateChange(segment.atBar, { bpm: clampMetronomeBpm(segment.bpm + direction) })
                                }
                              />
                            </View>
                            <MeterRow
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

          {/* Cues — ink toggles with their settings on the row. Levels stay adjustable
              mid-take: volume is a live param on the native engine (no restart, no phase
              reset) and haptic strength is JS-side only. The toggles and the click voice
              are structural and lock while recording. */}
          {/* Same name as the Metronome page's Sound row: one word for the cues. */}
          <Text style={[ms.label, ms.divider, { paddingTop: 14 }]}>{t("metronome.sound")}</Text>
          <CueRows
            outputs={outputs}
            beepLevel={beepLevel}
            hapticLevel={hapticLevel}
            disabled={disabled}
            onToggleOutput={onToggleOutput}
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
  countInNote: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  disclosureValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  disclosureValueText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
  },
  feelGap: {
    height: 8,
  },
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
