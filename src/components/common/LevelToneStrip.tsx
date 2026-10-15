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
import { colors, text } from "../../design/tokens";
import { InkOption } from "./InkOption";
import { Slider } from "./Slider";
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
 * THE take's sound: a level and four tone options, in the drawer's one row
 * recipe (2026-10-15, founder picked "Sound A"): a label, its value at the
 * end, the control beneath. The level is a kit Slider with a detent at every
 * step and a rest at 0 dB (it was a knob); tone is editorial ink, dot + word,
 * hollow to terracotta (they were boxed lit keys). One component for the
 * player's Sound drawer and the Layers bench, so a take and a layer are tuned
 * with the same hands.
 *
 * Each group carries its own reset, appearing only once something is bent.
 * Haptics are the kit controls' own (Slider: grab/tick/light; InkOption:
 * light; the resets: Press's tap). Nothing here fires its own.
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
      <View style={s.group}>
        <View style={s.head}>
          <Text style={s.label}>{t("player.level")}</Text>
          {gainDb !== 0 ? (
            <ResetKey onPress={() => onCommitGain(0)} accessibilityLabel={t("player.resetLevel")} />
          ) : null}
          <View style={s.spacer} />
          <Text style={[s.readout, levelBent ? s.readoutBent : null]}>
            {`${shownDb > 0 ? "+" : ""}${shownDb} ${t("player.dB")}`}
          </Text>
        </View>
        <Slider
          style={s.slider}
          fill={false}
          minimumValue={SOUND_LEVEL_MIN_DB}
          maximumValue={SOUND_LEVEL_MAX_DB}
          step={1}
          detent={SOUND_LEVEL_DETENT_DB}
          value={clampSoundLevelDb(gainDb)}
          onValueChange={(next) => setDragDb(Math.round(next))}
          onSlidingComplete={(next) => {
            const rounded = Math.round(next);
            setDragDb(null);
            if (rounded !== gainDb) onCommitGain(rounded);
          }}
          accessibilityLabel={t("player.level")}
          testID={testID ? `${testID}-level` : undefined}
        />
      </View>

      <View style={s.group}>
        <View style={s.head}>
          <Text style={s.label}>{t("player.tone")}</Text>
          {toneBent ? (
            <ResetKey
              onPress={() => {
                // Each lit option goes out; the toggle helper writes one flag at a time.
                for (const flag of parseToneFlags(tonePreset)) onToggleToneFlag(flag);
              }}
              accessibilityLabel={t("player.resetTone")}
            />
          ) : null}
        </View>
        <View style={s.options}>
          {SOUND_TONE_KEY_ORDER.map((flag) => (
            <InkOption
              key={flag}
              label={t(TONE_FLAG_LABEL_KEYS[flag])}
              selected={hasToneFlag(tonePreset, flag)}
              onPress={() => onToggleToneFlag(flag)}
              testID={testID ? `${testID}-${flag}` : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** A group's reset: a bare refresh glyph, shown only once there is something to
 *  undo. Press owns the `tap`. */
function ResetKey({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  return (
    <Press
      feel="glyph"
      style={s.reset}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="refresh" size={14} color={colors.primaryDeep} />
    </Press>
  );
}

const s = StyleSheet.create({
  strip: {
    gap: 16,
  },
  group: {
    gap: 8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 24,
  },
  spacer: {
    flex: 1,
  },
  label: {
    ...text.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  // A measured value, not a name: tabular Jakarta (it was the serif).
  readout: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  readoutBent: {
    color: colors.primaryDeep,
  },
  slider: {
    height: 32,
  },
  reset: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  // Four on one line: spread across the row, never wrapping one alone.
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    columnGap: 6,
  },
});
