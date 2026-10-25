import { useMemo } from "react";
import { useSharedValue } from "react-native-reanimated";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { IdeaCard } from "../common/IdeaCard";
import { ListRow, ListRowMeta, ListRows } from "../common/ListRow";
import { Ledger } from "../common/Ledger";
import { AudioReel } from "../common/AudioReel";
import { SpeedPitchDials } from "../common/SpeedPitchDials";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { ReadingLyrics } from "../common/SongReading";
import { SurfaceCard } from "../common/SurfaceCard";
import { buildSectionBands } from "../../domain/playerSections";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import type { ClipSection, LyricsLine } from "../../types";

/**
 * The welcome tour's pictures (2026-10-25, founder: "real UI components … so we can
 * use this for marketing material as well"). Every scene is the app's own components
 * fed a small, believable demo song, so the pictures can never drift from the app,
 * follow the app language on their own, and double as store screenshots. Nothing in a
 * scene is live: the caller renders them with pointerEvents="none".
 */

const noop = () => {};

/** A deterministic, song-shaped envelope: a quiet count-in, phrases that breathe,
 *  and a song that gets louder as it goes. */
function demoPeaks(count: number, seed: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const intro = Math.min(1, t / 0.04);
    const arc = 0.45 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    const phrase = 0.72 + 0.28 * Math.sin(i * 0.31 + seed);
    const grain = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.93 + seed * 2.1));
    return Math.max(0.05, Math.min(1, intro * arc * phrase * grain));
  });
}

/** A lyric line with chords over the start of its first and fourth words. */
function chordedLine(id: string, text: string, first: string, second: string): LyricsLine {
  const words = text.split(" ");
  const secondAt = words.slice(0, 3).join(" ").length + 1;
  return {
    id,
    text,
    chords: [
      { id: `${id}-a`, chord: first, at: 0, graphemeAt: 0 },
      { id: `${id}-b`, chord: second, at: secondAt, graphemeAt: secondAt },
    ],
  };
}

export function CoverScene() {
  return <Image source={require("../../../assets/brand-mark.png")} style={s.brandMark} resizeMode="contain" />;
}

export function SketchesScene() {
  const { t } = useTranslation();
  const peaks = useMemo(() => demoPeaks(64, 1), []);
  const takes = [
    { title: t("welcome.demo.take1"), date: t("welcome.demo.today"), duration: "3:12" },
    { title: t("welcome.demo.take2"), date: t("welcome.demo.tuesday"), duration: "3:40" },
    { title: t("welcome.demo.take3"), date: t("welcome.demo.march"), duration: "0:48" },
  ];
  return (
    <View style={s.column}>
      <IdeaCard
        stacked
        isSong
        canPlay
        durationLabel="3:12"
        onPressLead={noop}
        onPress={noop}
        onLongPress={noop}
        title={t("welcome.demo.sketch")}
        waveformPeaks={peaks}
        footerDate={t("welcome.demo.today")}
      />
      <Text style={s.label}>{t("screens.takes")}</Text>
      {takes.map((take) => (
        <IdeaCard
          key={take.title}
          compact
          canPlay
          durationLabel={take.duration}
          onPressLead={noop}
          onPress={noop}
          onLongPress={noop}
          title={take.title}
          footerDate={take.date}
        />
      ))}
    </View>
  );
}

export function WordsScene() {
  const { t } = useTranslation();
  const lines = useMemo<LyricsLine[]>(
    () => [
      chordedLine("l1", t("welcome.demo.lyric1"), "G", "Em"),
      chordedLine("l2", t("welcome.demo.lyric2"), "C", "D"),
      chordedLine("l3", t("welcome.demo.lyric3"), "G", "Em"),
      chordedLine("l4", t("welcome.demo.lyric4"), "C", "D"),
    ],
    [t]
  );
  return (
    <SurfaceCard variant="content" style={s.page}>
      <Text style={s.label}>{t("welcome.demo.lyricsLabel")}</Text>
      <ReadingLyrics lines={lines} showChords zoom={0.86} />
    </SurfaceCard>
  );
}

const PRACTICE_DURATION_MS = 192_000;

export function PracticeScene() {
  const { t } = useTranslation();
  const peaks = useMemo(() => demoPeaks(220, 2), []);
  const bands = useMemo(() => {
    const sections: ClipSection[] = [
      { id: "v", kind: "verse", label: t("sections.verse"), startMs: 8_000, endMs: 52_000 },
      { id: "c", kind: "chorus", label: t("sections.chorus"), startMs: 52_000, endMs: 84_000 },
      { id: "b", kind: "bridge", label: t("sections.bridge"), startMs: 84_000, endMs: 110_000 },
    ];
    return buildSectionBands(sections, PRACTICE_DURATION_MS);
  }, [t]);
  const loop = useMemo(() => [{ id: "loop", start: 52_000, end: 84_000, type: "keep" as const }], []);
  const loopStart = useSharedValue(52_000);
  const loopEnd = useSharedValue(84_000);
  const pins = useMemo(() => [{ id: "pin", atMs: 66_000, label: t("welcome.demo.pin") }], [t]);
  return (
    <View style={s.column}>
      <AudioReel
        waveformPeaks={peaks}
        durationMs={PRACTICE_DURATION_MS}
        currentTimeMs={61_000}
        isPlaying={false}
        onSeek={noop}
        chrome="light"
        showExpandToggle={false}
        showZoomControls={false}
        showTimingRow={false}
        showMinimapMode="never"
        defaultExpanded={false}
        surfaceRadius={4}
        timelineHorizontalPadding={0}
        collapsedHeightOverride={150}
        sectionBands={bands}
        practiceMarkers={pins}
        freezeSelectedRangeWhenFullyVisible
        selectedRanges={loop}
        selectedRangeType="keep"
        sharedSelectedRangeStartMs={loopStart}
        sharedSelectedRangeEndMs={loopEnd}
      />
      <SpeedPitchDials
        playbackSpeed={0.75}
        speedPresets={[0.5, 0.75, 1, 1.25]}
        speedMin={0.5}
        speedMax={1.5}
        onSpeedTap={noop}
        onSpeedSlideEnd={noop}
        pitchShiftSemitones={2}
        supportsPitchShift
        onAdjustPitchShift={noop}
      />
    </View>
  );
}

export function ShareScene() {
  const { t } = useTranslation();
  return (
    <View style={s.column}>
      <ListRows>
        <ListRow
          icon="list-outline"
          title={t("welcome.demo.setlist")}
          meta={<ListRowMeta>{t("welcome.demo.setlistMeta")}</ListRowMeta>}
          onPress={noop}
        />
        <ListRow
          icon="link-outline"
          title={t("welcome.demo.link")}
          serifTitle={false}
          meta={<ListRowMeta>{t("welcome.demo.linkMeta")}</ListRowMeta>}
          onPress={noop}
        />
        <ListRow
          icon="mail-open-outline"
          title={t("welcome.demo.received")}
          meta={<ListRowMeta>{t("welcome.demo.receivedMeta")}</ListRowMeta>}
          onPress={noop}
        />
      </ListRows>
    </View>
  );
}

export function GemScene() {
  const { t } = useTranslation();
  const peaks = useMemo(() => demoPeaks(64, 4), []);
  return (
    <View style={s.column}>
      <Ledger label={t("welcome.demo.shelfLabel")} count={2} />
      {[t("welcome.demo.shelf1"), t("welcome.demo.shelf2")].map((title, index) => (
        <IdeaCard
          key={title}
          compact
          canPlay
          durationLabel={index === 0 ? "0:31" : "1:05"}
          onPressLead={noop}
          onPress={noop}
          onLongPress={noop}
          title={title}
        />
      ))}
      <Text style={[s.label, s.labelSpaced]}>{t("welcome.demo.revisitLabel")}</Text>
      <IdeaCard
        canPlay
        durationLabel="2:14"
        onPressLead={noop}
        onPress={noop}
        onLongPress={noop}
        title={t("welcome.demo.revisit")}
        waveformPeaks={peaks}
        footerDate={t("welcome.demo.revisitReason")}
      />
    </View>
  );
}

export function OrganizeScene() {
  const { t } = useTranslation();
  const collections = [
    { title: t("welcome.demo.collection1"), count: 24 },
    { title: t("welcome.demo.collection2"), count: 8 },
    { title: t("welcome.demo.collection3"), count: 12 },
  ];
  return (
    <View style={s.column}>
      <View style={s.workspaceRow}>
        <WorkspaceAvatar color={colors.primary} name={t("welcome.demo.workspace")} size={36} avatarKey={3} />
        <View>
          <Text style={s.workspaceName}>{t("welcome.demo.workspace")}</Text>
          <Text style={s.workspaceMeta}>{t("welcome.demo.collectionsMeta")}</Text>
        </View>
      </View>
      <ListRows>
        {collections.map((collection) => (
          <ListRow
            key={collection.title}
            icon="folder-outline"
            title={collection.title}
            meta={<ListRowMeta>{t("common.ideaCount", { count: collection.count })}</ListRowMeta>}
            onPress={noop}
          />
        ))}
      </ListRows>
    </View>
  );
}

const s = StyleSheet.create({
  brandMark: {
    width: 120,
    height: 120,
  },
  column: {
    alignSelf: "stretch",
    gap: spacing.sm,
  },
  page: {
    alignSelf: "stretch",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  label: {
    ...textTokens.annotation,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  labelSpaced: {
    marginTop: spacing.md,
  },
  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  workspaceName: {
    ...textTokens.headerTitle,
  },
  workspaceMeta: {
    ...textTokens.supporting,
  },
});
