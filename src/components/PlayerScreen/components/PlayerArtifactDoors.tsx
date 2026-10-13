import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { dirIcon } from "../../../design/directionalIcons";
import { haptic } from "../../../design/haptics";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { PAGE_SLOT_HEIGHT, PAGE_TILE_HEIGHT } from "../../../domain/reelLanes";
import { buildChartPreview, countChartBars, type ChartPreviewRow } from "../../../domain/pagePreview";
import { SurfaceCard } from "../../common/SurfaceCard";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";
import type { ChordSheet, LyricsLine } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

/** `seenHints` id — the Sketch door's first-visit wash settles once tapped. */
export const SKETCH_DOOR_HINT = "sketchDoor";

/** Distinct chords in playing order, for a handle like "Am · C · F". */
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

const FADE_HEIGHT = 46;

/** The page runs on past the tile: its last lines sink into the paper. */
function PageFade() {
  return (
    <View style={pageStyles.fade} pointerEvents="none">
      <Svg width="100%" height={FADE_HEIGHT}>
        <Defs>
          <LinearGradient id="pageFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surface} stopOpacity={0} />
            <Stop offset="0.78" stopColor={colors.surface} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={FADE_HEIGHT} fill="url(#pageFade)" />
      </Svg>
    </View>
  );
}

/**
 * A written page, in miniature (founder, 2026-10-13: the keys that stood here
 * were grey boxes; "box items" should be the pages themselves). The tile's
 * face is the top of the real page — the lyric's first lines in the reading
 * face, the chart's first systems — and it opens that page.
 */
function PageTile({
  kind,
  meta,
  metaEdited,
  footer,
  onOpen,
  accessibilityLabel,
  testID,
  children,
}: {
  /** Small caps page name — "Lyrics" / "Chart". */
  kind: string;
  /** Whisper in the corner: the version, or the bar count. */
  meta?: string;
  /** The page moved on after this clip's take — a tiny pencil beside the meta. */
  metaEdited?: boolean;
  /** One quiet line printed over the fade (the lyric's chords). */
  footer?: string;
  onOpen: () => void;
  accessibilityLabel: string;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <SurfaceCard
      variant="content"
      style={pageStyles.tile}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={pageStyles.tileClip}>
        <View style={pageStyles.kindRow}>
          <Text style={pageStyles.kind}>{kind}</Text>
          <View style={pageStyles.kindSpacer} />
          {metaEdited ? <Ionicons name="create-outline" size={11} color={colors.textMuted} /> : null}
          {meta ? (
            <Text style={pageStyles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {children}
        <PageFade />
        {footer ? (
          <Text style={pageStyles.footer} numberOfLines={1}>
            {footer}
          </Text>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

/**
 * The lyric's first lines, one printed line each: a line too long for the
 * tile runs off its edge like a page, it never wraps into a second (a wrapped
 * miniature reads as a different poem). A blank line is a stanza break.
 */
function LyricMiniature({ text }: { text: string }) {
  return (
    <View>
      {text.split("\n").map((line, index) =>
        line ? (
          <UserText
            key={index}
            value={line}
            align="content"
            style={pageStyles.lyric}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {line}
          </UserText>
        ) : (
          <View key={index} style={pageStyles.stanzaBreak} />
        )
      )}
    </View>
  );
}

/** The chart's first systems. Bars read left to right in every language. */
function ChartMiniature({ rows }: { rows: ChartPreviewRow[] }) {
  return (
    <View style={pageStyles.chart}>
      {rows.map((row) =>
        row.kind === "label" ? (
          <UserText key={row.key} value={row.text} style={pageStyles.chartLabel} numberOfLines={1}>
            {row.text}
          </UserText>
        ) : row.kind === "text" ? (
          <UserText key={row.key} value={row.text} style={pageStyles.chartText} numberOfLines={1}>
            {row.text}
          </UserText>
        ) : (
          <View key={row.key} style={pageStyles.system}>
            {row.cells.map((cell, index) => (
              <View key={index} style={pageStyles.bar}>
                <Text style={pageStyles.barText} numberOfLines={1}>
                  {cell}
                </Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}

/**
 * A page that is not written yet: an empty slot where its tile will sit — a
 * dashed outline, a plus, one word. It holds the page's place, so Lyrics is
 * always on the leading side and Chart on the trailing one.
 */
function PageSlot({
  label,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Press
      // Haptics (Press default): `tap` — an acknowledged press.
      style={pageStyles.slot}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Ionicons name="add" size={20} color={colors.textMuted} />
      <Text style={pageStyles.slotText} numberOfLines={1}>
        {label}
      </Text>
    </Press>
  );
}

/**
 * First clip ever, no sketch anywhere yet: the one card that explains what a
 * sketch is (title, one line, link), wearing the terracotta wash until it is
 * tapped. Once any sketch exists the lesson has landed and the card gives way
 * to the same two page slots a sketch shows (founder's call 2026-10-12: the
 * explanation earns its space exactly once).
 */
function SketchDoor({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const seen = useStore((s) => s.seenHints.includes(SKETCH_DOOR_HINT));
  // Haptic row: tap — "any acknowledged press". The commit itself (grow into
  // a sketch) fires `success` in the lifecycle handler.
  const handlePress = () => {
    haptic.tap();
    onPress();
  };
  return (
    <Press
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={t("songDetail.makeSong")}
      testID="player-sketch-door"
      style={[pageStyles.sketchDoor, !seen ? pageStyles.sketchDoorFirstVisit : null]}
      onPress={handlePress}
    >
      <View style={pageStyles.sketchKindRow}>
        <Ionicons name={getHierarchyIconName("song")} size={14} color={colors.textSecondary} />
        <Text style={pageStyles.kind}>{t("brand.sketch")}</Text>
      </View>
      <Text style={pageStyles.sketchTitle}>{t("player.sketchDoorTitle")}</Text>
      <Text style={pageStyles.sketchBody}>{t("player.sketchDoorBody")}</Text>
      <View style={pageStyles.sketchLinkRow}>
        <Text style={pageStyles.sketchLink}>{t("songDetail.makeSong")}</Text>
        <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.primaryDeep} />
      </View>
    </Press>
  );
}

type Props = {
  /** Only sketches carry pages; a standalone clip is offered a sketch instead. */
  canAuthor: boolean;
  /** Set for a standalone clip idea: grow it into a sketch. */
  onGrowSketch?: () => void;
  hasLyrics: boolean;
  /** The top of the lyric page, as `buildLyricPreview` cut it. */
  lyricsPreview: string;
  lyricsChordSummary: string;
  /** Whispered version meta — "v1 · Jul 25". */
  lyricsMeta: string | null;
  /** The words moved on after this take was recorded. */
  lyricsEditedSinceTake?: boolean;
  hasChart: boolean;
  chordSheet: ChordSheet | null | undefined;
  onOpenLyrics: () => void;
  onOpenChart: () => void;
  onWriteLyrics: () => void;
  onBuildChart: () => void;
};

/**
 * The pages a recording carries, anchored above the transport: Lyrics on the
 * leading side, Chart on the trailing one, always in that order. A written
 * page is a tile showing its own top; an unwritten one is an empty slot.
 */
export const PlayerArtifactDoors = memo(PlayerArtifactDoorsInner);

function PlayerArtifactDoorsInner({
  canAuthor,
  onGrowSketch,
  hasLyrics,
  lyricsPreview,
  lyricsChordSummary,
  lyricsMeta,
  lyricsEditedSinceTake,
  hasChart,
  chordSheet,
  onOpenLyrics,
  onOpenChart,
  onWriteLyrics,
  onBuildChart,
}: Props) {
  const { t } = useTranslation();
  const anySketch = useStore(selectAnySketch);
  const chartRows = useMemo(() => buildChartPreview(chordSheet), [chordSheet]);
  const chartBars = useMemo(() => countChartBars(chordSheet), [chordSheet]);

  if (!canAuthor) {
    if (!onGrowSketch) return null;
    if (!anySketch) return <SketchDoor onPress={onGrowSketch} />;
    // A clip has no pages of its own: wanting one is the moment it becomes a
    // sketch. The slots say where the pages will be; the dialog says the rule.
    const offerSketch = () =>
      AppAlert.confirm(t("songDetail.makeSong"), t("player.pagesNeedSketch"), onGrowSketch, {
        confirmLabel: t("songDetail.makeSong"),
        icon: getHierarchyIconName("song"),
      });
    return (
      <View style={pageStyles.row}>
        <PageSlot
          label={t("common.lyrics")}
          onPress={offerSketch}
          accessibilityLabel={t("player.writeLyrics")}
          testID="player-sketch-door"
        />
        <PageSlot
          label={t("screens.chart")}
          onPress={offerSketch}
          accessibilityLabel={t("player.buildChart")}
          testID="player-sketch-door-chart"
        />
      </View>
    );
  }

  // A tile needs something to print: a page with nothing on its face is a slot.
  const lyricsFilled = hasLyrics && lyricsPreview.length > 0;
  const chartFilled = hasChart && chartRows.length > 0;
  return (
    <View style={pageStyles.row}>
      {lyricsFilled ? (
        <PageTile
          kind={t("common.lyrics")}
          meta={lyricsMeta ?? undefined}
          metaEdited={lyricsEditedSinceTake}
          footer={lyricsChordSummary || undefined}
          onOpen={onOpenLyrics}
          accessibilityLabel={t("player.openLyrics")}
          testID="player-lyrics-door"
        >
          <LyricMiniature text={lyricsPreview} />
        </PageTile>
      ) : (
        <PageSlot
          label={t("common.lyrics")}
          onPress={onWriteLyrics}
          accessibilityLabel={t("player.writeLyrics")}
          testID="player-write-lyrics"
        />
      )}
      {chartFilled ? (
        <PageTile
          kind={t("screens.chart")}
          meta={chartBars > 0 ? t("player.chartBars", { count: chartBars }) : undefined}
          onOpen={onOpenChart}
          accessibilityLabel={t("player.openChart")}
          testID="player-chart-door"
        >
          <ChartMiniature rows={chartRows} />
        </PageTile>
      ) : (
        <PageSlot
          label={t("screens.chart")}
          onPress={onBuildChart}
          accessibilityLabel={t("player.buildChart")}
          testID="player-build-chart"
        />
      )}
    </View>
  );
}

/** Does the library hold any sketch yet? Decides card vs slots on a clip, and
 *  how much room the listening reel leaves for them. */
export function selectAnySketch(state: {
  workspaces: { ideas: { kind: string }[] }[];
}): boolean {
  return state.workspaces.some((workspace) => workspace.ideas.some((idea) => idea.kind === "project"));
}

const pageStyles = StyleSheet.create({
  // Tiles and slots share the row and its height: a slot beside a written
  // page stands as tall as the page.
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.md,
    flexShrink: 1,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    height: PAGE_TILE_HEIGHT,
    flexShrink: 1,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 0,
    gap: 0,
  },
  // The card keeps its shadow, so the clipping happens one level in.
  tileClip: {
    flex: 1,
    overflow: "hidden",
    gap: spacing.sm,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  kind: {
    ...textTokens.annotation,
    letterSpacing: 1.2,
  },
  kindSpacer: {
    flex: 1,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: colors.textMuted,
    flexShrink: 1,
  },
  lyric: {
    fontFamily: "Lora_500Medium",
    fontSize: 12,
    lineHeight: 18.5,
    color: colors.textPrimary,
  },
  stanzaBreak: {
    height: 9,
  },
  chart: {
    gap: 5,
  },
  chartLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginTop: 2,
  },
  chartText: {
    fontFamily: "Lora_500Medium_Italic",
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  system: {
    flexDirection: "row",
    direction: "ltr",
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: colors.borderMuted,
  },
  bar: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: StyleSheet.hairlineWidth * 2,
    borderLeftColor: colors.borderMuted,
    paddingVertical: 4,
    paddingLeft: 7,
    paddingRight: 2,
  },
  barText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 9,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.primaryDeep,
  },
  slot: {
    flex: 1,
    minWidth: 0,
    minHeight: PAGE_SLOT_HEIGHT,
    // Same side padding as a tile: flex shares the row by what is left AFTER
    // padding, so without it a slot beside a tile comes out narrower.
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderMuted,
  },
  slotText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  // The first-visit sketch card: tonal, no shadow. The hairline is reserved at
  // rest (transparent) so the first-visit wash is a colour change, not a resize.
  sketchDoor: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.xl,
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
