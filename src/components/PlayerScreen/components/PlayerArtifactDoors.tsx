import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { dirIcon } from "../../../design/directionalIcons";
import { haptic } from "../../../design/haptics";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { SurfaceCard } from "../../common/SurfaceCard";
import { useStore } from "../../../state/useStore";
import type { ChordSheet, LyricsLine } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

/** `seenHints` id — the Sketch door's first-visit wash settles once tapped. */
export const SKETCH_DOOR_HINT = "sketchDoor";

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
  metaEdited,
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
  /** The page moved on after this clip's take — a tiny pencil beside the meta. */
  metaEdited?: boolean;
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
            {metaEdited ? (
              <Ionicons name="create-outline" size={11} color={colors.textMuted} />
            ) : null}
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

/**
 * The ghost door: a standalone clip has no Lyrics or Chart yet, so the slot
 * where a sketch's doors sit holds the one door that isn't built — Sketch.
 * Tonal, shadowless (nothing behind it yet). Until the first tap, and only
 * while the library has no sketch at all, it wears the terracotta wash so
 * the first clip ever recorded learns where sketches come from.
 */
function SketchDoor({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const seen = useStore((s) => s.seenHints.includes(SKETCH_DOOR_HINT));
  const anySketch = useStore((s) =>
    s.workspaces.some((workspace) => workspace.ideas.some((idea) => idea.kind === "project"))
  );
  const firstVisit = !seen && !anySketch;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("songDetail.makeSong")}
      testID="player-sketch-door"
      style={({ pressed }) => [
        doorStyles.sketchDoor,
        firstVisit ? doorStyles.sketchDoorFirstVisit : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={() => {
        // Haptic row: tap — "any acknowledged press". The commit itself
        // (grow into a sketch) fires `success` in the lifecycle handler.
        haptic.tap();
        onPress();
      }}
    >
      <View style={doorStyles.sketchKindRow}>
        <Ionicons name={getHierarchyIconName("song")} size={14} color={colors.textSecondary} />
        <Text style={doorStyles.kind}>{t("brand.sketch")}</Text>
      </View>
      <Text style={doorStyles.sketchTitle}>{t("player.sketchDoorTitle")}</Text>
      <Text style={doorStyles.sketchBody}>{t("player.sketchDoorBody")}</Text>
      <View style={doorStyles.sketchLinkRow}>
        <Text style={doorStyles.sketchLink}>{t("songDetail.makeSong")}</Text>
        <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.primaryDeep} />
      </View>
    </Pressable>
  );
}

type Props = {
  /** Only sketches carry artifacts; a standalone clip gets the Sketch door instead. */
  canAuthor: boolean;
  /** Set for a standalone clip idea: the ghost door's tap (grow into a sketch). */
  onGrowSketch?: () => void;
  hasLyrics: boolean;
  lyricsPreviewLine: string;
  lyricsChordSummary: string;
  /** Whispered version meta — "v1 · Jul 25". */
  lyricsMeta: string | null;
  /** The words moved on after this take was recorded. */
  lyricsEditedSinceTake?: boolean;
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
  onGrowSketch,
  hasLyrics,
  lyricsPreviewLine,
  lyricsChordSummary,
  lyricsMeta,
  lyricsEditedSinceTake,
  hasChart,
  chartHandle,
  onOpenLyrics,
  onOpenChart,
  onWriteLyrics,
  onBuildChart,
}: Props) {
  const { t } = useTranslation();
  if (!canAuthor) {
    if (!onGrowSketch) return null;
    return (
      <View style={doorStyles.stack}>
        <SketchDoor onPress={onGrowSketch} />
      </View>
    );
  }
  return (
    <View style={doorStyles.stack}>
      <Door
        kind={t("common.lyrics")}
        summary={hasLyrics ? lyricsChordSummary : undefined}
        preview={hasLyrics ? lyricsPreviewLine : undefined}
        previewSerif
        meta={hasLyrics ? lyricsMeta ?? undefined : undefined}
        metaEdited={hasLyrics ? lyricsEditedSinceTake : undefined}
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
  // The ghost door: tonal, no shadow. The hairline is reserved at rest
  // (transparent) so the first-visit wash is a colour change, not a resize.
  sketchDoor: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  sketchDoorFirstVisit: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderMuted,
  },
  sketchKindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sketchTitle: {
    fontFamily: "Lora_500Medium",
    fontSize: 19,
    lineHeight: 25,
    color: colors.textPrimary,
    marginTop: 2,
  },
  sketchBody: {
    ...textTokens.supporting,
  },
  sketchLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: spacing.sm,
  },
  sketchLink: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primaryDeep,
  },
});
