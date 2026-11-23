import React, { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  SOUND_LEVEL_DETENT_DB,
  SOUND_LEVEL_MAX_DB,
  SOUND_LEVEL_MIN_DB,
  SOUND_KEYS_NEEDING_NEW_CHAIN,
  TONE_BANDS,
  clampSoundLevelDb,
  formatToneFlags,
  hasToneFlag,
  parseToneFlags,
  toneBandPosition,
  toneBandToggle,
  type OverdubToneFlag,
  type ToneBand,
  type ToneBandPosition,
} from "../../domain/overdub";
import { colors, radii, shadows, spacing, text } from "../../design/tokens";
import { hexToRgba } from "../../domain/playerSections";
import { HelpButton } from "./HelpButton";
import { HelpSheet } from "./HelpSheet";
import { InkKey, inkKeyColor } from "./InkKey";
import { Slider } from "./Slider";
import { Spinner } from "./Spinner";
import { Switch } from "./Switch";
import { Press } from "./Press";
import { signedNumberText } from "../../i18n/direction";
import { toast } from "./toastStore";
import { haptic } from "../../design/haptics";
import type { AutoFinding, AutoSound } from "../../domain/autoSound";
import { isAutoSoundAvailable, suggestAutoSound } from "../../services/autoSound";

/** What Auto fix heard, a word or two each: the line beside its key. */
const AUTO_HEARD_LABEL_KEYS: Record<AutoFinding, string> = {
  quiet: "player.autoHeardQuiet",
  loud: "player.autoHeardLoud",
  rumble: "player.autoHeardRumble",
  harsh: "player.autoHeardHarsh",
  hiss: "player.autoHeardHiss",
  dull: "player.autoHeardDull",
  uneven: "player.autoHeardUneven",
};

const TONE_BAND_LABEL_KEYS: Record<ToneBand, string> = {
  low: "player.toneLow",
  mid: "player.toneMid",
  high: "player.toneHigh",
};
const TONE_KEY_LABEL_KEYS: Record<"cut" | "boost", string> = {
  cut: "player.toneCut",
  boost: "player.toneBoost",
};

export type LevelToneStripProps = {
  gainDb: number;
  tonePreset: string;
  /** The knob's value on release — absolute, in dB. */
  onCommitGain: (gainDb: number) => void;
  onToggleToneFlag: (flag: OverdubToneFlag) => void;
  /** The take's (or layer's) own file: offers Auto fix, which measures it and sets the
   *  level and tone here (domain/autoSound.ts). Absent, no Auto fix. */
  autoAudioUri?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * THE take's sound, top to bottom the way it is reached for (2026-11-23, founder: "it's
 * not clear ... give me a better ui", then "i want the tone to look more like a mixer"):
 *
 *   Auto fix   the easy key (wand + word): lit while its choice stands, with what it
 *              heard beside it; tapped again it puts back what was there. What it does
 *              is behind the "?" at the end of its line, with the rest of the help: no
 *              explaining text sits open on the page.
 *   Level      a kit Slider with a detent at every step and a rest at 0 dB, and Even out
 *              (gentle compression) as its switch.
 *   Tone       a little mixer: three columns (Low, Mid, High), Boost above each name and
 *              Cut below. One of a band's two keys can be lit; tapping the lit one
 *              clears it, and that is flat. (They were six loose dot-and-word keys.)
 *
 * One component for the player's EQ tab and a layer's sheet, so a take and a layer are
 * tuned with the same hands. Level and Tone each carry their own reset, appearing only
 * once something is bent. Haptics are the kit controls' own (InkKey and Switch: light;
 * Slider: grab/tick/light; the tone keys: light; the resets: Press's tap).
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
  const [helpOpen, setHelpOpen] = useState(false);
  const auto = useAutoSound({ gainDb, tonePreset, onCommitGain, onToggleToneFlag, audioUri: autoAudioUri });
  const shownDb = dragDb ?? gainDb;
  const levelBent = shownDb !== 0;
  const evenOn = hasToneFlag(tonePreset, "even");
  // Even out, Hi boost and Mid cut arrived with the native measurer (one binary): on an
  // older one the sound chain ignores them, so they stay away.
  const newChain = isAutoSoundAvailable();
  const offers = (flag: OverdubToneFlag) => newChain || !SOUND_KEYS_NEEDING_NEW_CHAIN.includes(flag);
  // The tone bands only: Even out rides the same encoding but belongs to Level.
  const toneFlagsOn = parseToneFlags(tonePreset).filter((flag) => flag !== "even");
  const toneBent = toneFlagsOn.length > 0;

  return (
    <View style={[s.strip, style]} testID={testID}>
      <View style={s.autoRow}>
        {auto.offered ? (
          <InkKey
            // Haptics vocabulary: light, a small state flip (the fix on, or put back).
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
            label={t("player.autoFix")}
            accessibilityLabel={t("player.autoA11y")}
            disabled={auto.busy}
            onPress={auto.toggle}
            testID={testID ? `${testID}-auto` : undefined}
          />
        ) : null}
        {/* What it heard (founder, 2026-11-23: "a quick explanation of what was
            adjusted"), only while its choice stands. */}
        <Text style={s.autoLine} numberOfLines={1} testID={testID ? `${testID}-auto-line` : undefined}>
          {auto.heard.map((finding) => t(AUTO_HEARD_LABEL_KEYS[finding])).join(" · ")}
        </Text>
        <HelpButton compact onPress={() => setHelpOpen(true)} />
      </View>
      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        thesis={t("player.soundHelpThesis")}
        items={[
          ...(auto.offered
            ? [{ icon: "color-wand-outline" as const, label: t("player.autoFix"), description: t("player.soundHelpAuto") }]
            : []),
          ...(newChain
            ? [{ icon: "swap-vertical-outline" as const, label: t("player.evenOut"), description: t("player.soundHelpEven") }]
            : []),
          { icon: "options-outline", label: t("player.tone"), description: t("player.soundHelpTone") },
          { icon: "checkmark-circle-outline", label: t("player.soundHelpSavedLabel"), description: t("player.soundHelpSaved") },
        ]}
      />

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
        {/* Even out (2026-11-22): gentle compression. Level's own switch; what it does
            is in the help. */}
        {newChain ? (
          <View style={s.evenRow}>
            <Text style={s.sublabel}>{t("player.evenOut")}</Text>
            <View style={s.spacer} />
            <Switch
              value={evenOn}
              onValueChange={() => onToggleToneFlag("even")}
              accessibilityLabel={t("player.evenOut")}
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
                // Each bent band goes flat; the toggle helper writes one flag at a time.
                for (const flag of toneFlagsOn) onToggleToneFlag(flag);
              }}
              accessibilityLabel={t("player.resetTone")}
            />
          ) : null}
        </View>
        <View style={s.mixer}>
          {TONE_BANDS.map(({ band, cut, boost }) => {
            const position = toneBandPosition(tonePreset, band);
            const bandName = t(TONE_BAND_LABEL_KEYS[band]);
            const key = (direction: "cut" | "boost", flag: OverdubToneFlag) =>
              offers(flag) ? (
                <MixerKey
                  label={t(TONE_KEY_LABEL_KEYS[direction])}
                  on={position === direction}
                  accessibilityLabel={t("player.toneKeyA11y", {
                    band: bandName,
                    direction: t(TONE_KEY_LABEL_KEYS[direction]),
                  })}
                  // Tapping the lit key clears the band (flat); the other moves it across.
                  onPress={() => {
                    const flagToFlip = toneBandToggle(tonePreset, band, position === direction ? "flat" : direction);
                    if (flagToFlip) onToggleToneFlag(flagToFlip);
                  }}
                  testID={testID ? `${testID}-${flag}` : undefined}
                />
              ) : (
                // A binary whose sound chain lacks this direction: its place stays empty.
                <View style={s.mixerGap} />
              );
            return (
              <View key={band} style={s.mixerColumn}>
                {key("boost", boost)}
                <Text style={s.mixerBand} numberOfLines={1}>
                  {bandName}
                </Text>
                {key("cut", cut)}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/**
 * Auto fix (2026-11-22): measure the file once, then set the level and tone to what it
 * heard, where they can be seen and bent. While the controls still hold its choice the
 * button reads Undo, and puts back what was there before.
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
        // Nothing to change: say so, and leave the button as it was (nothing to undo).
        toast(t("player.autoBalanced"), "checkmark-outline");
        return;
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

/**
 * A channel-strip key (founder, 2026-11-23: "more like a mixer - like a button with a
 * light when its engaged - 'pressed down' with the right shadow when pressed").
 *
 * Out, it is a quiet raised key: paper white on the page, a whisper of shadow, its lamp
 * dark. In, it sits pressed: the shadow goes, the face sinks a tone with a shade along
 * its top edge (the inside of the well), the word drops a point, and the lamp lights
 * terracotta with a soft halo. The lamp is the only colour, so three strips of keys stay
 * calm until one is on. Haptics vocabulary: light, a small state flip.
 */
function MixerKey({
  label,
  on,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Press
      feel="surface"
      haptic="light"
      style={[s.mixerKey, on ? s.mixerKeyIn : s.mixerKeyOut]}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {on ? <View style={s.mixerKeyShade} pointerEvents="none" /> : null}
      <View style={[s.mixerKeyFace, on ? s.mixerKeyFaceIn : null]}>
        <View style={[s.lampHalo, on ? s.lampHaloOn : null]}>
          <View style={[s.lamp, on ? s.lampOn : null]} />
        </View>
        <Text style={[s.mixerKeyLabel, on ? s.mixerKeyLabelOn : null]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Press>
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

/** A tone key: room for its lamp over its word. */
const MIXER_KEY_HEIGHT = 46;

const s = StyleSheet.create({
  strip: {
    gap: spacing.lg,
  },
  // Auto fix sets both groups below, so it leads them; the help ends its line.
  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 32,
  },
  autoLine: {
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
  // A row inside a group: quieter than the group's own label.
  sublabel: {
    ...text.body,
    color: colors.textStrong,
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
  evenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 32,
  },
  // The mixer: three channel strips side by side, Boost over the band's name over Cut.
  mixer: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: 2,
  },
  mixerColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  // The strip's name is what the two keys are about: full ink, a size up.
  mixerBand: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    textAlign: "center",
    color: colors.textPrimary,
  },
  mixerGap: {
    minHeight: MIXER_KEY_HEIGHT,
  },
  mixerKey: {
    minHeight: MIXER_KEY_HEIGHT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  // Out: lifted paper.
  mixerKeyOut: {
    backgroundColor: colors.surface,
    borderColor: hexToRgba(colors.textPrimary, 0.08),
    ...shadows.control,
    // The shadow needs the key's own shape, not a clip.
    overflow: "visible",
  },
  // In: the well it was pressed into.
  mixerKeyIn: {
    backgroundColor: colors.surfaceHigh,
    borderColor: hexToRgba(colors.textPrimary, 0.1),
  },
  // The shade under the well's top lip.
  mixerKeyShade: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    height: 3,
    backgroundColor: hexToRgba(colors.textPrimary, 0.07),
  },
  mixerKeyFace: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  mixerKeyFaceIn: {
    transform: [{ translateY: 1 }],
  },
  mixerKeyLabel: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  mixerKeyLabelOn: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  // The lamp: dark until the key is in, then terracotta inside a soft halo.
  lampHalo: {
    width: 12,
    height: 12,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  lampHaloOn: {
    backgroundColor: hexToRgba(colors.primary, 0.32),
  },
  lamp: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
    backgroundColor: hexToRgba(colors.textPrimary, 0.14),
  },
  lampOn: {
    backgroundColor: colors.primary,
  },
});
