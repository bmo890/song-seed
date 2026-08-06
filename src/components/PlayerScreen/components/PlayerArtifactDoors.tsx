import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { SurfaceCard } from "../../common/SurfaceCard";
import type { ChordSheet, LyricsLine } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

/** Distinct chords in playing order, for a door handle like "Am · C · F". */
function summarizeChords(symbols: string[], max = 4): string {
  const seen: string[] = [];
  for (const symbol of symbols) {
    const trimmed = symbol.trim();
    if (trimmed && !seen.includes(trimmed)) {
      seen.push(trimmed);
      if (seen.length >= max) break;
    }
  }
  return seen.join(" · ");
}

export function lyricChordSummary(chordLines: LyricsLine[] | undefined): string {
  if (!chordLines) return "";
  return summarizeChords(chordLines.flatMap((line) => line.chords.map((chord) => chord.chord)));
}

export function chartSummary(sheet: ChordSheet | null | undefined, barsLabel: (count: number) => string): string {
  if (!sheet) return "";
  const measures = sheet.sections.flatMap((section) =>
    section.kind === "text" ? [] : section.measures
  );
  if (measures.length === 0) return "";
  const chords = summarizeChords(measures.flatMap((measure) => measure.chords));
  return chords ? `${chords} — ${barsLabel(measures.length)}` : barsLabel(measures.length);
}

function Door({
  kind,
  summary,
  preview,
  previewSerif,
  meta,
  onOpen,
  emptyLabel,
  ctaLabel,
  onCta,
  accessibilityLabel,
}: {
  /** Small caps artifact name — "Lyrics" / "Chart". */
  kind: string;
  /** Trailing detail beside the kind (chord summary / version whisper). */
  summary?: string;
  /** The handle: first lyric line (serif) or the chart's chord run. */
  preview?: string;
  previewSerif?: boolean;
  meta?: string;
  onOpen: () => void;
  /** Empty-door state: quiet label + one ink CTA (opens the editor). */
  emptyLabel?: string;
  ctaLabel?: string;
  onCta?: () => void;
  accessibilityLabel: string;
}) {
  const isEmpty = !preview;
  return (
    <SurfaceCard
      style={doorStyles.door}
      onPress={isEmpty ? onCta ?? onOpen : onOpen}
    >
      <View
        style={doorStyles.doorInner}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={doorStyles.doorBody}>
          <View style={doorStyles.kindRow}>
            <Text style={doorStyles.kind}>{kind}</Text>
            {summary ? <Text style={doorStyles.kindSummary}>{summary}</Text> : null}
            <View style={doorStyles.kindSpacer} />
            {meta ? <Text style={doorStyles.meta}>{meta}</Text> : null}
          </View>
          {isEmpty ? (
            <View style={doorStyles.emptyRow}>
              <Text style={doorStyles.emptyLabel}>{emptyLabel}</Text>
              {ctaLabel ? <Text style={doorStyles.cta}>{ctaLabel}</Text> : null}
            </View>
          ) : (
            <UserText
              value={preview!}
              style={previewSerif ? doorStyles.previewSerif : doorStyles.preview}
              numberOfLines={1}
            >
              {preview}
            </UserText>
          )}
        </View>
        <Ionicons
          name={isEmpty ? "create-outline" : "chevron-down"}
          size={16}
          color={colors.textMuted}
        />
      </View>
    </SurfaceCard>
  );
}

type Props = {
  /** Only sketches carry artifacts; loose clips render no doors at all. */
  canAuthor: boolean;
  hasLyrics: boolean;
  lyricsPreviewLine: string;
  lyricsChordSummary: string;
  /** Whispered version meta — "v1 · Jul 25". */
  lyricsMeta: string | null;
  hasChart: boolean;
  chartHandle: string;
  onOpenLyrics: () => void;
  onOpenChart: () => void;
  onWriteLyrics: () => void;
  onBuildChart: () => void;
};

/**
 * Closed rung of the reading ladder: one quiet door per artifact the sketch
 * has. The handle is the content itself (first lyric line / chord run); an
 * empty door carries its call to action instead of dead-ending.
 */
export function PlayerArtifactDoors({
  canAuthor,
  hasLyrics,
  lyricsPreviewLine,
  lyricsChordSummary,
  lyricsMeta,
  hasChart,
  chartHandle,
  onOpenLyrics,
  onOpenChart,
  onWriteLyrics,
  onBuildChart,
}: Props) {
  const { t } = useTranslation();
  if (!canAuthor) return null;
  return (
    <View style={doorStyles.stack}>
      <Door
        kind={t("common.lyrics")}
        summary={hasLyrics ? lyricsChordSummary : undefined}
        preview={hasLyrics ? lyricsPreviewLine : undefined}
        previewSerif
        meta={hasLyrics ? lyricsMeta ?? undefined : undefined}
        onOpen={onOpenLyrics}
        emptyLabel={t("player.noLyricsYet")}
        ctaLabel={t("player.writeLyrics")}
        onCta={onWriteLyrics}
        accessibilityLabel={hasLyrics ? t("player.openLyrics") : t("player.writeLyrics")}
      />
      <Door
        kind={t("screens.chart")}
        preview={hasChart ? chartHandle : undefined}
        onOpen={onOpenChart}
        emptyLabel={t("player.noChartYet")}
        ctaLabel={t("player.buildChart")}
        onCta={onBuildChart}
        accessibilityLabel={hasChart ? t("player.openChart") : t("player.buildChart")}
      />
    </View>
  );
}

const doorStyles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  door: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  doorInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  doorBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  kind: {
    ...textTokens.annotation,
  },
  kindSummary: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.primaryDeep,
  },
  kindSpacer: {
    flex: 1,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: colors.textMuted,
  },
  previewSerif: {
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textStrong,
  },
  preview: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  emptyLabel: {
    ...textTokens.supporting,
    color: colors.textMuted,
  },
  cta: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primaryDeep,
  },
});
