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
import { colors, spacing, text } from "../../design/tokens";
import { HelpButton } from "./HelpButton";
import { HelpSheet } from "./HelpSheet";
import { InkKey, inkKeyColor } from "./InkKey";
import { LIT_KEY_HEIGHT, LitKey } from "./LitKey";
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

/**
 * How much air the strip takes, chosen from the room its page has (founder, 2026-11-23:
 * "it should auto adjust ... for height, i dont want a situation where a normal phone
 * isnt tall enough"). Nothing is dropped at any density; only the air goes.
 *
 *   roomy    the full layout: Level's name and value over its slider.
 *   inline   Level on one line: name, slider, value.
 *   tight    inline, with closer gaps and shorter keys.
 *
 * Every height the strip draws comes from these numbers, so `eqStripHeight` is what it
 * will measure and the choice is made before the first frame, never after one.
 */
export type EqDensity = "roomy" | "inline" | "tight";
type EqMetrics = {
  levelInline: boolean;
  stripGap: number;
  groupGap: number;
  keyHeight: number;
  mixerGap: number;
  bandMargin: number;
};
const EQ_METRICS: Record<EqDensity, EqMetrics> = {
  roomy: { levelInline: false, stripGap: spacing.lg, groupGap: 8, keyHeight: LIT_KEY_HEIGHT, mixerGap: spacing.sm, bandMargin: 6 },
  inline: { levelInline: true, stripGap: spacing.lg, groupGap: 8, keyHeight: LIT_KEY_HEIGHT, mixerGap: spacing.sm, bandMargin: 6 },
  tight: { levelInline: true, stripGap: spacing.md, groupGap: 6, keyHeight: 44, mixerGap: 6, bandMargin: 3 },
};
const AUTO_ROW_HEIGHT = 36;
const HEAD_HEIGHT = 24;
const SLIDER_HEIGHT = 32;
const EVEN_ROW_HEIGHT = 32;
const BAND_LINE_HEIGHT = 20;
const MIXER_PAD_TOP = 2;

/** The strip's drawn height at a density (`even`: the Even out row is offered). */
export function eqStripHeight(density: EqDensity, even: boolean): number {
  const m = EQ_METRICS[density];
  const level =
    (m.levelInline ? SLIDER_HEIGHT : HEAD_HEIGHT + m.groupGap + SLIDER_HEIGHT) +
    (even ? m.groupGap + EVEN_ROW_HEIGHT : 0);
  const tone =
    HEAD_HEIGHT + m.groupGap + MIXER_PAD_TOP + m.keyHeight * 2 + m.mixerGap * 2 + BAND_LINE_HEIGHT + m.bandMargin * 2;
  return AUTO_ROW_HEIGHT + m.stripGap + level + m.stripGap + tone;
}

/** The roomiest density that fits `room` points; with no room given, at ease. A phone
 *  too short even for `tight` gets `tight`, and the page scrolls the rest. */
export function eqDensityForRoom(room: number | null | undefined, even: boolean): EqDensity {
  if (room == null) return "roomy";
  if (eqStripHeight("roomy", even) <= room) return "roomy";
  if (eqStripHeight("inline", even) <= room) return "inline";
  return "tight";
}

export type LevelToneStripProps = {
  gainDb: number;
  tonePreset: string;
  /** The knob's value on release — absolute, in dB. */
  onCommitGain: (gainDb: number) => void;
  onToggleToneFlag: (flag: OverdubToneFlag) => void;
  /** The take's (or layer's) own file: offers Auto fix, which measures it and sets the
   *  level and tone here (domain/autoSound.ts). Absent, no Auto fix. */
  autoAudioUri?: string | null;
  /** Save (founder, 2026-11-23: "its supposed to be just 'save', then user has option
   *  of saving new copy or overwriting current copy"). The caller asks which. The key
   *  shows only while the level or tone is bent: there is something to save. Absent (a
   *  layer's sheet, a take with layers, which has Combine), no key. */
  onSave?: (() => void) | null;
  /** The save is running. */
  saving?: boolean;
  /** Whose sound this is, for the help's words: a clip's (kept as it is set; Save bakes
   *  it), a layer's (kept with the layer; Combine bakes it), or the editor's draft
   *  (nothing changes until the editor's own save). */
  subject?: "clip" | "layer" | "draft";
  /** The height the page has for the strip (`useRoomBelow`): it draws at the roomiest
   *  density that fits. Absent (a sheet, which grows to its content), at ease. */
  room?: number | null;
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
  onSave = null,
  saving = false,
  subject = "clip",
  room = null,
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
  const density = eqDensityForRoom(room, newChain);
  const m = EQ_METRICS[density];

  const levelReadout = (
    <Text style={[s.readout, m.levelInline ? s.readoutInline : null, levelBent ? s.readoutBent : null]}>
      {`${signedNumberText(`${shownDb > 0 ? "+" : ""}${shownDb}`)} ${t("player.dB")}`}
    </Text>
  );
  const levelSlider = (
    <Slider
      style={[s.slider, m.levelInline ? s.sliderInline : null]}
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
  );
  const levelReset =
    gainDb !== 0 ? (
      <ResetKey onPress={() => onCommitGain(0)} accessibilityLabel={t("player.resetLevel")} />
    ) : m.levelInline ? (
      // Its seat is kept on the one-line Level, so the slider never changes width
      // under a thumb when the reset comes and goes.
      <View style={s.reset} />
    ) : null;

  return (
    <View style={[s.strip, { gap: m.stripGap }, style]} testID={testID}>
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
        <Text style={s.autoLine} numberOfLines={2} testID={testID ? `${testID}-auto-line` : undefined}>
          {auto.heard.map((finding) => t(AUTO_HEARD_LABEL_KEYS[finding])).join(" · ")}
        </Text>
        {/* On this line, not its own (founder: "make sure theres no scroll height added"):
            the line's height is fixed, so the key coming and going moves nothing. */}
        {onSave && (gainDb !== 0 || toneBent || evenOn) ? (
          <InkKey
            // Haptics vocabulary: tap, a control acted (it opens the choice).
            haptic="tap"
            glyph={
              saving ? (
                <Spinner size="small" color={inkKeyColor("idle")} />
              ) : (
                <Ionicons name="save-outline" size={17} color={inkKeyColor("idle")} />
              )
            }
            label={t("player.eqSave")}
            accessibilityLabel={t("player.eqSaveA11y")}
            disabled={saving}
            onPress={onSave}
            testID={testID ? `${testID}-save` : undefined}
          />
        ) : null}
        <HelpButton compact onPress={() => setHelpOpen(true)} />
      </View>
      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        thesis={t(
          subject === "layer"
            ? "player.soundHelpThesisLayer"
            : subject === "draft"
              ? "player.soundHelpThesisDraft"
              : "player.soundHelpThesis"
        )}
        items={[
          ...(auto.offered
            ? [{ icon: "color-wand-outline" as const, label: t("player.autoFix"), description: t("player.soundHelpAuto") }]
            : []),
          ...(newChain
            ? [{ icon: "swap-vertical-outline" as const, label: t("player.evenOut"), description: t("player.soundHelpEven") }]
            : []),
          { icon: "options-outline", label: t("player.tone"), description: t("player.soundHelpTone") },
          subject === "draft"
            ? { icon: "save-outline", label: t("editor.saveCopy"), description: t("player.soundHelpDraft") }
            : {
                icon: "checkmark-circle-outline",
                label: t("player.soundHelpSavedLabel"),
                description: t(subject === "layer" ? "player.soundHelpSavedLayer" : "player.soundHelpSaved"),
              },
        ]}
      />

      <View style={[s.group, { gap: m.groupGap }]}>
        {m.levelInline ? (
          <View style={s.levelLine}>
            <Text style={s.label}>{t("player.level")}</Text>
            {levelReset}
            {levelSlider}
            {levelReadout}
          </View>
        ) : (
          <>
            <View style={s.head}>
              <Text style={s.label}>{t("player.level")}</Text>
              {levelReset}
              <View style={s.spacer} />
              {levelReadout}
            </View>
            {levelSlider}
          </>
        )}
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

      <View style={[s.group, { gap: m.groupGap }]}>
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
        <View style={[s.mixer, { gap: spacing.md }]}>
          {TONE_BANDS.map(({ band, cut, boost }) => {
            const position = toneBandPosition(tonePreset, band);
            const bandName = t(TONE_BAND_LABEL_KEYS[band]);
            const key = (direction: "cut" | "boost", flag: OverdubToneFlag) =>
              offers(flag) ? (
                <LitKey
                  style={{ height: m.keyHeight }}
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
                <View style={{ height: m.keyHeight }} />
              );
            return (
              <View key={band} style={[s.mixerColumn, { gap: m.mixerGap }]}>
                {key("boost", boost)}
                <Text style={[s.mixerBand, { marginVertical: m.bandMargin }]} numberOfLines={1}>
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
  strip: {},
  // Auto fix sets both groups below, so it leads them; the help ends its line.
  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    // Fixed, so nothing that comes and goes on this line changes the page's height.
    height: AUTO_ROW_HEIGHT,
  },
  autoLine: {
    ...text.supporting,
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  group: {},
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: HEAD_HEIGHT,
  },
  // Level on one line (the inline and tight densities): name, slider, value.
  levelLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: SLIDER_HEIGHT,
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
    height: SLIDER_HEIGHT,
  },
  sliderInline: {
    flex: 1,
  },
  // A fixed seat, so "0 dB" and "+12 dB" leave the slider the same width.
  readoutInline: {
    minWidth: 56,
    textAlign: "right",
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
    height: EVEN_ROW_HEIGHT,
  },
  // The mixer: three channel strips side by side, Boost over the band's name over Cut.
  mixer: {
    flexDirection: "row",
    paddingTop: MIXER_PAD_TOP,
  },
  mixerColumn: {
    flex: 1,
  },
  // The strip's name, between its two keys: plain ink, with air above and below
  // (founder, 2026-11-23: "doesnt need to be bold. just needs a bit more vertical margin").
  mixerBand: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    lineHeight: BAND_LINE_HEIGHT,
    textAlign: "center",
    color: colors.textPrimary,
  },
});
