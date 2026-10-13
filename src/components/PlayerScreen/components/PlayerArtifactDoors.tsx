import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Press } from "../../common/Press";
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
  accessibilityLabel,
  testID,
}: {
  /** Small caps artifact name — "Lyrics" / "Chart". */
  kind: string;
  /** Trailing detail beside the kind (chord summary / version whisper). */
  summary?: string;
  /** The handle: first lyric line (serif) or the chart's chord run. */
  preview: string;
  previewSerif?: boolean;
  meta?: string;
  /** The page moved on after this clip's take — a tiny pencil beside the meta. */
  metaEdited?: boolean;
  onOpen: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <SurfaceCard style={doorStyles.door} onPress={onOpen}>
      <View
        style={doorStyles.doorInner}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
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
          <UserText
            value={preview}
            style={previewSerif ? doorStyles.previewSerif : doorStyles.preview}
            numberOfLines={1}
          >
            {preview}
          </UserText>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </View>
    </SurfaceCard>
  );
}

/**
 * What a sketch does not have yet (founder, 2026-10-13: a full row saying
 * "LYRICS · No lyrics yet · Write lyrics" was three ways of saying nothing).
 * A thing that exists is a card with its content as the handle; a thing that
 * does not is a ghost key — tonal, shadowless, a plus and ONE word. Keys share
 * a row, half the page each, so an empty sketch costs the page one short line.
 */
function GhostKey({
  label,
  icon = "add",
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Press
      // Haptics (Press default): `tap` — an acknowledged press.
      style={doorStyles.ghostKey}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={doorStyles.ghostKeyText} numberOfLines={1}>
        {label}
      </Text>
    </Press>
  );
}

/** One row of ghost keys. A lone key keeps its half: it is a key, not a row. */
function GhostKeyRow({ children }: { children: React.ReactNode }) {
  const keys = React.Children.toArray(children);
  if (keys.length === 0) return null;
  return (
    <View style={doorStyles.ghostRow}>
      {keys}
      {keys.length === 1 ? <View style={doorStyles.ghostSlot} /> : null}
    </View>
  );
}

/**
 * The ghost door: a standalone clip has no Lyrics or Chart yet, so the slot
 * where a sketch's doors sit holds the one door that isn't built — Sketch.
 *
 * Two sizes, decided by whether the library has learned what a sketch is:
 * - No sketch anywhere yet: the full card (title, one line of body, link),
 *   tonal and shadowless (nothing behind it yet). Until the first tap it
 *   also wears the terracotta wash, so the first clip ever recorded learns
 *   where sketches come from.
 * - Any sketch exists: the lesson landed, so the card folds into the same
 *   ghost key an empty Lyrics or Chart uses. Founder's call 2026-10-12: the
 *   explanation earns its space exactly once; after that it is noise on
 *   every clip. (2026-10-13: the fold became a key, not a full-width row.)
 * "Make a sketch" also lives in the player's overflow, so nothing is lost.
 */
function SketchDoor({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const seen = useStore((s) => s.seenHints.includes(SKETCH_DOOR_HINT));
  const anySketch = useStore((s) =>
    s.workspaces.some((workspace) => workspace.ideas.some((idea) => idea.kind === "project"))
  );
  const firstVisit = !seen && !anySketch;
  // Haptic row: tap — "any acknowledged press". The commit itself (grow into
  // a sketch) fires `success` in the lifecycle handler.
  const handlePress = () => {
    haptic.tap();
    onPress();
  };
  if (anySketch) {
    // Folded: the sketch glyph says what, the words say the one action. The
    // key fires its own `tap`, so the handler's is not doubled.
    return (
      <GhostKeyRow>
        <GhostKey
          icon={getHierarchyIconName("song")}
          label={t("songDetail.makeSong")}
          onPress={onPress}
          accessibilityLabel={t("songDetail.makeSong")}
          testID="player-sketch-door"
        />
      </GhostKeyRow>
    );
  }
  return (
    <Press
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={t("songDetail.makeSong")}
      testID="player-sketch-door"
      style={[doorStyles.sketchDoor,
        firstVisit ? doorStyles.sketchDoorFirstVisit : null]}
      onPress={handlePress}
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
    </Press>
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
export const PlayerArtifactDoors = memo(PlayerArtifactDoorsInner);

function PlayerArtifactDoorsInner({
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
  // A door needs a handle: with nothing to show on its face it is a key.
  const lyricsFilled = hasLyrics && lyricsPreviewLine.length > 0;
  const chartFilled = hasChart && chartHandle.length > 0;
  return (
    <View style={doorStyles.stack}>
      {lyricsFilled ? (
        <Door
          kind={t("common.lyrics")}
          summary={lyricsChordSummary}
          preview={lyricsPreviewLine}
          previewSerif
          meta={lyricsMeta ?? undefined}
          metaEdited={lyricsEditedSinceTake}
          onOpen={onOpenLyrics}
          accessibilityLabel={t("player.openLyrics")}
          testID="player-lyrics-door"
        />
      ) : null}
      {chartFilled ? (
        <Door
          kind={t("screens.chart")}
          preview={chartHandle}
          onOpen={onOpenChart}
          accessibilityLabel={t("player.openChart")}
          testID="player-chart-door"
        />
      ) : null}
      <GhostKeyRow>
        {!lyricsFilled ? (
          <GhostKey
            label={t("common.lyrics")}
            onPress={onWriteLyrics}
            accessibilityLabel={t("player.writeLyrics")}
            testID="player-write-lyrics"
          />
        ) : null}
        {!chartFilled ? (
          <GhostKey
            label={t("screens.chart")}
            onPress={onBuildChart}
            accessibilityLabel={t("player.buildChart")}
            testID="player-build-chart"
          />
        ) : null}
      </GhostKeyRow>
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
  ghostRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  ghostSlot: {
    flex: 1,
  },
  // A soft key (design-system button language): r8, ~38 tall, tonal fill, ink.
  ghostKey: {
    flex: 1,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
  },
  ghostKeyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
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
