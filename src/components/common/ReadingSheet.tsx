import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./BottomSheet";
import { Slider } from "./Slider";
import { Stepper } from "./Stepper";
import { Press } from "./Press";
import { InkOption } from "./InkOption";
import { ensurePro } from "./proUpsell";
import { colors } from "../../design/tokens";
import { READING_ZOOM_MAX, READING_ZOOM_MIN, useChartPrefsStore } from "../../state/useChartPrefsStore";

/**
 * The one Aa sheet (2026-10-18): how a song READS, shared by the full player,
 * the songbook reader and a setlist page, so a size or key set in one is the
 * size or key in all of them.
 *
 * - Size: the reading zoom, remembered for every song.
 * - Key lives on the chart itself (ReadingTransposeBar), to change on the fly.
 * - Capo: the fret your capo sits on, so the chords read as the shapes you
 *   finger (founder: "what if someone's using a capo"). Optional, starts off.
 * - Chords: over the words or not, when the lyric page has chords.
 * Capo is per song and only offered when the song has chords.
 */
export function ReadingSheet({
  visible,
  onClose,
  ideaId,
  hasChords,
  hasLyricChords,
}: {
  visible: boolean;
  onClose: () => void;
  ideaId: string | null;
  /** The song has chords anywhere (lyric chords or a bar chart). */
  hasChords: boolean;
  /** The lyric page has chords to show or hide. */
  hasLyricChords: boolean;
}) {
  const { t } = useTranslation();
  const zoom = useChartPrefsStore((s) => s.readingZoom);
  const chordsHidden = useChartPrefsStore((s) => s.chordsHidden);
  const capo = useChartPrefsStore((s) => (ideaId ? s.capoByIdeaId[ideaId] ?? 0 : 0));
  const prefs = useChartPrefsStore.getState;
  const showCapo = hasChords && !!ideaId;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.label}>{t("reading.size")}</Text>
          <Text style={styles.smallA}>{t("reading.aa")}</Text>
          <Slider
            style={styles.slider}
            minimumValue={READING_ZOOM_MIN}
            maximumValue={READING_ZOOM_MAX}
            step={0.05}
            detent={0.1}
            value={zoom}
            onValueChange={(value) => prefs().setReadingZoom(value)}
            accessibilityLabel={t("player.lyricSize")}
          />
          <Text style={styles.bigA}>{t("reading.aa")}</Text>
        </View>

        {showCapo ? (
          <View style={styles.row}>
            <Text style={styles.label}>{t("reading.capo")}</Text>
            <Stepper
              glyphs="plusMinus"
              onStep={(direction) => {
                // Capo is a stage tool (domain/proCatalog.ts); taking it off stays free.
                if (!ensurePro("stage-tools")) return;
                prefs().nudgeCapo(ideaId!, direction);
              }}
              canDecrement={capo > 0}
              canIncrement={capo < 11}
              decrementLabel={t("reading.capoDown")}
              incrementLabel={t("reading.capoUp")}
            >
              <Text
                style={[styles.value, capo !== 0 ? styles.valueActive : null]}
                accessibilityLabel={capo > 0 ? t("reading.capoValue", { fret: capo }) : t("reading.capoOff")}
              >
                {capo > 0 ? String(capo) : t("reading.capoOff")}
              </Text>
            </Stepper>
            <View style={styles.spacer} />
            {capo !== 0 ? (
              <Press
                feel="glyph"
                // haptics.ts: light → a small state flip.
                haptic="light"
                onPress={() => prefs().resetCapo(ideaId!)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("reading.removeCapo")}
              >
                <Text style={styles.reset}>{t("reading.capoOff")}</Text>
              </Press>
            ) : null}
          </View>
        ) : null}

        {hasLyricChords ? (
          <InkOption
            label={t("player.chords")}
            selected={!chordsHidden}
            onPress={() => prefs().setChordsHidden(!chordsHidden)}
            style={styles.chords}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** What the Aa key says beside its glyph: the capo in force, else nothing. The
 *  key shows on the chart's own transpose bar. */
export function readingKeyLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  capo: number
): string | null {
  if (capo > 0) return t("reading.capoShort", { fret: capo });
  return null;
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  label: {
    width: 56,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
  },
  smallA: {
    fontFamily: "Lora_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
  },
  bigA: {
    fontFamily: "Lora_500Medium",
    fontSize: 21,
    color: colors.textStrong,
  },
  slider: {
    flex: 1,
  },
  value: {
    minWidth: 40,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  valueActive: {
    color: colors.primaryDeep,
  },
  spacer: {
    flex: 1,
  },
  reset: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.textSecondary,
  },
  chords: {
    minHeight: 56,
  },
});
