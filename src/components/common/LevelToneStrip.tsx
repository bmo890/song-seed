import React, { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  SOUND_LEVEL_DETENT_DB,
  SOUND_LEVEL_MAX_DB,
  SOUND_LEVEL_MIN_DB,
  SOUND_KEYS_NEEDING_NEW_CHAIN,
  SOUND_TONE_KEY_ROWS,
  clampSoundLevelDb,
  hasToneFlag,
  parseToneFlags,
  type OverdubToneFlag,
} from "../../domain/overdub";
import { colors, spacing, text } from "../../design/tokens";
import { InkOption } from "./InkOption";
import { Slider } from "./Slider";
import { Press } from "./Press";
import { signedNumberText } from "../../i18n/direction";
import { InkKey, inkKeyColor } from "./InkKey";
import { Spinner } from "./Spinner";
import { toast } from "./toastStore";
import { haptic } from "../../design/haptics";
import { formatToneFlags } from "../../domain/overdub";
import type { AutoFinding, AutoSound } from "../../domain/autoSound";
import { isAutoSoundAvailable, suggestAutoSound } from "../../services/autoSound";

/** i18n keys for the tone keys, by flag. */
const TONE_FLAG_LABEL_KEYS: Record<OverdubToneFlag, string> = {
  "low-cut": "player.lowCut",
  "low-boost": "player.lowBoost",
  "hi-cut": "player.hiCut",
  "hi-boost": "player.hiBoost",
  "mid-boost": "player.midBoost",
  "mid-cut": "player.midCut",
  even: "player.even",
};

/** What Auto heard, a word or two each: the line beside its key. */
const AUTO_HEARD_LABEL_KEYS: Record<AutoFinding, string> = {
  quiet: "player.autoHeardQuiet",
  loud: "player.autoHeardLoud",
  rumble: "player.autoHeardRumble",
  harsh: "player.autoHeardHarsh",
  hiss: "player.autoHeardHiss",
  dull: "player.autoHeardDull",
  uneven: "player.autoHeardUneven",
};

export type LevelToneStripProps = {
  gainDb: number;
  tonePreset: string;
  /** The knob's value on release — absolute, in dB. */
  onCommitGain: (gainDb: number) => void;
  onToggleToneFlag: (flag: OverdubToneFlag) => void;
  /** The take's (or layer's) own file: offers Auto, which measures it and sets the
   *  level and tone here (domain/autoSound.ts). Absent, no Auto key. */
  autoAudioUri?: string | null;
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
  autoAudioUri = null,
  style,
  testID,
}: LevelToneStripProps) {
  const { t } = useTranslation();
  const [dragDb, setDragDb] = useState<number | null>(null);
  const auto = useAutoSound({ gainDb, tonePreset, onCommitGain, onToggleToneFlag, audioUri: autoAudioUri });
  const shownDb = dragDb ?? gainDb;
  const levelBent = shownDb !== 0;
  const evenOn = hasToneFlag(tonePreset, "even");
  // Even, Hi boost and Mid cut arrived with the native measurer (one binary): on an older
  // one the sound chain ignores them, so their keys stay away.
  const newChain = isAutoSoundAvailable();
  const toneRows = SOUND_TONE_KEY_ROWS.map((row) =>
    row.filter((flag) => newChain || !SOUND_KEYS_NEEDING_NEW_CHAIN.includes(flag))
  ).filter((row) => row.length > 0);
  // The tone keys only: Even rides the same encoding but belongs to Level.
  const toneFlagsOn = parseToneFlags(tonePreset).filter((flag) => flag !== "even");
  const toneBent = toneFlagsOn.length > 0;

  return (
    <View style={[s.strip, style]} testID={testID}>
      {auto.offered ? (
        <View style={s.autoRow}>
          <InkKey
            // Haptics vocabulary: light, a small state flip (Auto on or off).
            haptic="light"
            role="switch"
            tone={auto.active ? "active" : "idle"}
            glyph={
              auto.busy ? (
                <Spinner size="small" color={inkKeyColor("idle")} />
              ) : (
                <Ionicons
                  name="color-wand-outline"
                  size={18}
                  color={inkKeyColor(auto.active ? "active" : "idle")}
                />
              )
            }
            label={t("player.auto")}
            accessibilityLabel={t("player.autoA11y")}
            disabled={auto.busy}
            onPress={auto.toggle}
            testID={testID ? `${testID}-auto` : undefined}
          />
          {/* What Auto heard (founder, 2026-11-23: "a quick explanation of what was
              adjusted"): a quiet line in place while its choice stands, not a popup. */}
          {auto.heard.length > 0 ? (
            <Text style={s.autoHeard} numberOfLines={2} testID={testID ? `${testID}-auto-heard` : undefined}>
              {auto.heard.map((finding) => t(AUTO_HEARD_LABEL_KEYS[finding])).join(" · ")}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={s.group}>
        <View style={s.head}>
          <Text style={s.label}>{t("player.level")}</Text>
          {gainDb !== 0 ? (
            <ResetKey onPress={() => onCommitGain(0)} accessibilityLabel={t("player.resetLevel")} />
          ) : null}
          <View style={s.spacer} />
          <Text style={[s.readout, levelBent ? s.readoutBent : null]}>
            {`${signedNumberText(`${shownDb > 0 ? "+" : ""}${shownDb}`)} ${t("player.dB")}`}
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
        {/* Even (2026-11-22): gentle compression, so the loud parts and the quiet
            ones sit closer. Level's own switch, beside the slider it relates to. */}
        {newChain ? (
          <View style={s.options}>
            <InkOption
              label={t("player.even")}
              selected={evenOn}
              onPress={() => onToggleToneFlag("even")}
              testID={testID ? `${testID}-even` : undefined}
            />
          </View>
        ) : null}
      </View>

      <View style={s.group}>
        <View style={s.head}>
          <Text style={s.label}>{t("player.tone")}</Text>
          {toneBent ? (
            <ResetKey
              onPress={() => {
                // Each lit option goes out; the toggle helper writes one flag at a time.
                for (const flag of toneFlagsOn) onToggleToneFlag(flag);
              }}
              accessibilityLabel={t("player.resetTone")}
            />
          ) : null}
        </View>
        {toneRows.map((row, rowIndex) => (
          <View key={rowIndex} style={s.toneRow}>
            {row.map((flag) => (
              <View key={flag} style={s.toneCell}>
                <InkOption
                  label={t(TONE_FLAG_LABEL_KEYS[flag])}
                  selected={hasToneFlag(tonePreset, flag)}
                  onPress={() => onToggleToneFlag(flag)}
                  testID={testID ? `${testID}-${flag}` : undefined}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Auto (2026-11-22): measure the file once, then set the level and the tone keys to what
 * it heard, where they can be seen and bent. The key reads on while the controls still
 * hold Auto's choice; tapped then, it puts back what was there before.
 */
function useAutoSound({
  gainDb,
  tonePreset,
  onCommitGain,
  onToggleToneFlag,
  audioUri,
}: {
  gainDb: number;
  tonePreset: string;
  onCommitGain: (gainDb: number) => void;
  onToggleToneFlag: (flag: OverdubToneFlag) => void;
  audioUri: string | null;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<{ auto: AutoSound; before: AutoSound; uri: string } | null>(null);
  const canonicalTone = formatToneFlags(parseToneFlags(tonePreset));
  const active =
    !!chosen && chosen.uri === audioUri && chosen.auto.gainDb === gainDb && chosen.auto.tonePreset === canonicalTone;

  function apply(target: AutoSound) {
    if (target.gainDb !== gainDb) onCommitGain(target.gainDb);
    const has = parseToneFlags(tonePreset);
    const want = parseToneFlags(target.tonePreset);
    // Out first, then in: lighting a flag can put out its opposite.
    for (const flag of has) if (!want.includes(flag)) onToggleToneFlag(flag);
    for (const flag of want) if (!has.includes(flag)) onToggleToneFlag(flag);
  }

  async function toggle() {
    if (!audioUri || busy) return;
    if (active && chosen) {
      apply(chosen.before);
      setChosen(null);
      return;
    }
    setBusy(true);
    try {
      const auto = await suggestAutoSound(audioUri);
      if (!auto) {
        toast(t("player.autoNothing"));
        return;
      }
      const before = { gainDb, tonePreset: canonicalTone };
      if (auto.gainDb === before.gainDb && auto.tonePreset === before.tonePreset) {
        toast(t("player.autoBalanced"), "checkmark-outline");
      }
      apply(auto);
      setChosen({ auto, before, uri: audioUri });
    } catch {
      // Haptics vocabulary: error, a failure the person meets.
      haptic.error();
      toast(t("player.autoFailed"), "alert-circle-outline");
    } finally {
      setBusy(false);
    }
  }

  return {
    offered: !!audioUri && isAutoSoundAvailable(),
    active,
    busy,
    toggle,
    heard: active && chosen ? chosen.auto.heard ?? [] : [],
  };
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
  // Auto sets both groups below, so it sits above them.
  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: -8,
  },
  autoHeard: {
    ...text.supporting,
    flex: 1,
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
  // Two columns, low to high: each band's cut and boost side by side.
  toneRow: {
    flexDirection: "row",
  },
  toneCell: {
    width: "50%",
  },
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    columnGap: 6,
  },
});
