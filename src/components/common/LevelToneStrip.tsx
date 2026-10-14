import React, { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  SOUND_LEVEL_DETENT_DB,
  SOUND_LEVEL_MAX_DB,
  SOUND_LEVEL_MIN_DB,
  SOUND_TONE_KEY_ORDER,
  clampSoundLevelDb,
  hasToneFlag,
  isTonePresetNeutral,
  parseToneFlags,
  type OverdubToneFlag,
} from "../../domain/overdub";
import { colors, radii, text } from "../../design/tokens";
import { Knob } from "./Knob";
import { LitKey } from "./LitKey";
import { Press } from "./Press";

/** i18n keys for the tone keys, by flag. */
const TONE_FLAG_LABEL_KEYS: Record<OverdubToneFlag, string> = {
  "low-cut": "player.lowCut",
  "low-boost": "player.lowBoost",
  "hi-cut": "player.hiCut",
  "mid-boost": "player.midBoost",
};

export type LevelToneStripProps = {
  gainDb: number;
  tonePreset: string;
  /** The knob's value on release — absolute, in dB. */
  onCommitGain: (gainDb: number) => void;
  onToggleToneFlag: (flag: OverdubToneFlag) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * THE take's sound: a level knob beside a two-by-two bank of lit tone keys — the
 * top of a channel strip in the app's materials (Sound room, 2026-10-14). One
 * component for the player's Sound drawer and the Layers bench, so a take and a
 * layer are tuned with the same hands.
 *
 * Each group carries its own reset, appearing only once something is bent, as the
 * Speed and Pitch dials do. The knob's value is the one thing the musician made,
 * so it earns the serif, and goes terracotta when bent.
 *
 * Haptics are the kit controls' own (Knob: grab/tick/light; LitKey: light; the
 * resets: Press's tap). Nothing here fires its own.
 */
export function LevelToneStrip({
  gainDb,
  tonePreset,
  onCommitGain,
  onToggleToneFlag,
  style,
  testID,
}: LevelToneStripProps) {
  const { t } = useTranslation();
  const [dragDb, setDragDb] = useState<number | null>(null);
  const shownDb = dragDb ?? gainDb;
  const levelBent = shownDb !== 0;
  const toneBent = !isTonePresetNeutral(tonePreset);

  return (
    <View style={[s.strip, style]} testID={testID}>
      <View style={s.knobColumn}>
        <Knob
          value={clampSoundLevelDb(gainDb)}
          minimumValue={SOUND_LEVEL_MIN_DB}
          maximumValue={SOUND_LEVEL_MAX_DB}
          step={1}
          detent={SOUND_LEVEL_DETENT_DB}
          rest={0}
          onValueChange={setDragDb}
          onRelease={(next) => {
            setDragDb(null);
            if (next !== gainDb) onCommitGain(next);
          }}
          accessibilityLabel={t("player.level")}
          testID={testID ? `${testID}-knob` : undefined}
        />
        <Text style={[s.readout, levelBent ? s.readoutBent : null]}>
          {`${shownDb > 0 ? "+" : ""}${shownDb}`}
          <Text style={[s.unit, levelBent ? s.unitBent : null]}>{` ${t("player.dB")}`}</Text>
        </Text>
        <View style={s.labelRow}>
          <Text style={s.label}>{t("player.level")}</Text>
          {gainDb !== 0 ? (
            <ResetKey onPress={() => onCommitGain(0)} accessibilityLabel={t("player.resetLevel")} />
          ) : null}
        </View>
      </View>

      <View style={s.keys}>
        <View style={s.labelRow}>
          <Text style={s.label}>{t("player.tone")}</Text>
          {toneBent ? (
            <ResetKey
              onPress={() => {
                // Each lit key goes out; the toggle helper writes one flag at a time.
                for (const flag of parseToneFlags(tonePreset)) onToggleToneFlag(flag);
              }}
              accessibilityLabel={t("player.resetTone")}
            />
          ) : null}
        </View>
        <View style={s.bank}>
          {SOUND_TONE_KEY_ORDER.map((flag) => (
            <LitKey
              key={flag}
              style={s.key}
              label={t(TONE_FLAG_LABEL_KEYS[flag])}
              on={hasToneFlag(tonePreset, flag)}
              onPress={() => onToggleToneFlag(flag)}
              testID={testID ? `${testID}-${flag}` : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** The dials' reset: a small paper key with a refresh glyph, shown only once there
 *  is something to undo. Press owns the `tap`. */
function ResetKey({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  return (
    <Press
      style={s.reset}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="refresh" size={13} color={colors.primaryDeep} />
    </Press>
  );
}

const s = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 6,
  },
  knobColumn: {
    width: 96,
    alignItems: "center",
    gap: 2,
  },
  readout: {
    ...text.headerTitle,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
  readoutBent: {
    color: colors.primaryDeep,
  },
  unit: {
    ...text.caption,
    fontSize: 11,
  },
  unitBent: {
    color: colors.primaryDeep,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 24,
  },
  label: {
    ...text.caption,
    fontSize: 13,
    color: colors.textPrimary,
  },
  reset: {
    width: 24,
    height: 24,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  keys: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bank: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  // Two to a row: each key takes half the bank less its share of the gap.
  key: {
    width: "48.5%",
    flexGrow: 1,
  },
});
