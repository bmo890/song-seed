import { useMemo, useRef } from "react";
import {
  clipHasOverdubs,
  getClipOverdubStemCount,
  getClipPlaybackDurationMs,
  getClipPlaybackUri,
  getClipReelWaveformPeaks,
  isClipWaveformPending,
} from "../../../domain/clipPresentation";
import {
  getClipOverdubRootSettings,
  getOverdubStemColor,
} from "../../../domain/overdub";
import { useClipWaveform } from "../../../hooks/useClipWaveform";
import { getLatestLyricsVersion, lyricsDocumentToText, resolveClipLyricsVersion } from "../../../domain/lyrics";
import { normalizeSections } from "../../../domain/playerSections";
import { useStore } from "../../../state/useStore";
import { findClipInIdea, findIdeaInLibrary } from "../../../state/librarySelectors";
import type { PracticeMarker, SongIdea } from "../../../types";
import { extractLyricsMarkers } from "../helpers";
import { useTranslation } from "react-i18next";

const EMPTY_IDEAS: SongIdea[] = [];


type UsePlayerScreenDataArgs = {
  playerDuration: number;
  /** The file the engine has loaded. Its duration is only this clip's when they match. */
  currentPlaybackSourceUri?: string | null;
  /** Active playback of this clip — holds off the sidecar decode so it can't stall the track. */
  isPlaying?: boolean;
};

const DURATION_TOLERANCE_MS = 50;
const EMPTY_MARKERS: PracticeMarker[] = [];

export function usePlayerScreenData({
  playerDuration,
  currentPlaybackSourceUri = null,
  isPlaying = false,
}: UsePlayerScreenDataArgs) {
  const { t } = useTranslation();
  const playerTarget = useStore((s) => s.playerTarget);
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const playerShouldAutoplay = useStore((s) => s.playerShouldAutoplay);
  const playerToggleRequestToken = useStore((s) => s.playerToggleRequestToken);
  const playerCloseRequestToken = useStore((s) => s.playerCloseRequestToken);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const isOverdubPreviewRendering = useStore((s) =>
    playerTarget ? !!s.overdubPreviewRenderActiveByClipKey[`${playerTarget.ideaId}:${playerTarget.clipId}`] : false
  );
  // Subscribed by identity, never to the whole library: the player is mounted
  // whenever a session exists, and re-rendering it on every unrelated write cost
  // 34–61 ms per write under the collection (2026-09-24).
  const playerIdea = useStore((s) =>
    playerTarget ? findIdeaInLibrary(s.workspaces, playerTarget.ideaId, s.activeWorkspaceId) : null
  );
  const playerClip = useMemo(
    () => (playerTarget ? findClipInIdea(playerIdea, playerTarget.clipId) : null),
    [playerIdea, playerTarget]
  );
  const latestLyricsVersion = useMemo(
    () => (playerIdea?.kind === "project" ? getLatestLyricsVersion(playerIdea) : null),
    [playerIdea]
  );
  const latestLyricsText = useMemo(
    () => lyricsDocumentToText(latestLyricsVersion?.document),
    // Keyed on the document, not the version id — in-place autosaves keep the
    // id and used to leave this text (and the open reader) stale.
    [latestLyricsVersion?.document]
  );
  // The take's page: the version stamped at record time, when it still exists.
  const clipLyrics = useMemo(
    () => resolveClipLyricsVersion(playerIdea, playerClip?.lyricsVersionId),
    [playerIdea, playerClip?.lyricsVersionId]
  );
  const clipLyricsText = useMemo(
    () => lyricsDocumentToText(clipLyrics.version?.document),
    [clipLyrics.version?.document]
  );
  const hasProjectLyrics = playerIdea?.kind === "project" && latestLyricsText.trim().length > 0;
  const playbackAudioUri = playerClip ? getClipPlaybackUri(playerClip) ?? null : null;
  // The engine is one shared player: while it still holds the previous clip's file,
  // its duration is the previous clip's. Derived here, never assigned from an effect.
  const engineHoldsThisClip = !!playbackAudioUri && currentPlaybackSourceUri === playbackAudioUri;
  // The engine's duration, once it holds this clip, usually differs from the
  // stored one by a few ms. Treating that as a change rebuilt the reel (wave
  // path, grid, pin and section paragraphs) a second time on every clip switch
  // and reset the practice loop; within a small tolerance the stored value stands.
  const storedDuration = playerClip ? getClipPlaybackDurationMs(playerClip) ?? 0 : 0;
  const engineDuration = engineHoldsThisClip ? playerDuration : 0;
  const displayDuration =
    (engineDuration && storedDuration && Math.abs(engineDuration - storedDuration) <= DURATION_TOLERANCE_MS
      ? storedDuration
      : engineDuration) || storedDuration || 0;
  const thumbnailWaveformPeaks = useMemo(
    () => (playerClip ? getClipReelWaveformPeaks(playerClip) : []),
    [playerClip]
  );
  // Detail waveform (sidecar) with the inline thumbnail as the fallback until it loads —
  // keeps the player reel crisp at every zoom. For layered clips the sidecar comes from
  // the MASTER audio, not the rendered mix: the mix file is replaced on every layer edit,
  // and re-deriving the wave from it made the reel visibly rearrange after each render.
  const waveformAudioUri =
    playerClip && clipHasOverdubs(playerClip)
      ? playerClip.audioUri ?? playbackAudioUri
      : playbackAudioUri;
  const clipWaveform = useClipWaveform({
    audioUri: waveformAudioUri,
    thumbnailPeaks: thumbnailWaveformPeaks,
    durationMs: displayDuration,
    enabled: !!waveformAudioUri,
    deferGeneration: isPlaying,
  });
  const waveformPeaks = clipWaveform.peaks;
  // The reel's peaks are synthetic until background analysis lands. `isDetail` means the
  // high-res sidecar loaded, which only ever exists for a really-analyzed clip — so it
  // also clears pending the moment the reel has a true shape to draw.
  const waveformPending = playerClip ? isClipWaveformPending(playerClip) && !clipWaveform.isDetail : false;
  const waveformResolving = clipWaveform.isResolvingDetail;
  // Lyric-heading markers keep their identity while value-equal: every lyrics
  // autosave (700 ms while writing against the tape) re-extracted them and the
  // fresh array reached the memoized reel.
  const lastExtractedMarkersRef = useRef<PracticeMarker[]>(EMPTY_MARKERS);
  const practiceMarkers = useMemo(() => {
    if (playerClip?.practiceMarkers && playerClip.practiceMarkers.length > 0) {
      return playerClip.practiceMarkers;
    }
    const next = extractLyricsMarkers(latestLyricsText, displayDuration);
    const prev = lastExtractedMarkersRef.current;
    const same =
      next.length === prev.length &&
      next.every((m, i) => m.id === prev[i]!.id && m.label === prev[i]!.label && m.atMs === prev[i]!.atMs);
    if (same) return prev;
    lastExtractedMarkersRef.current = next.length === 0 ? EMPTY_MARKERS : next;
    return lastExtractedMarkersRef.current;
  }, [displayDuration, latestLyricsText, playerClip?.practiceMarkers]);
  const sections = useMemo(
    () => normalizeSections(playerClip?.sections ?? [], displayDuration),
    [playerClip?.sections, displayDuration]
  );
  const analysis = playerClip?.analysis ?? null;
  const clipNotes = playerClip?.notes ?? "";
  const clipOverdubStemCount = playerClip ? getClipOverdubStemCount(playerClip) : 0;
  const hasClipOverdubs = playerClip ? clipHasOverdubs(playerClip) : false;
  const overdubRootSettings = playerClip ? getClipOverdubRootSettings(playerClip) : null;
  const overdubStemEntries = useMemo(
    () =>
      (playerClip?.overdub?.stems ?? []).map((stem, index) => ({
        id: stem.id,
        title: stem.title,
        meta: stem.isMuted ? t("player.mutedStem") : t("player.overdubNumber", { number: index + 1 }),
        audioUri: stem.audioUri ?? null,
        durationMs: stem.durationMs ?? 0,
        waveformPeaks: stem.waveformPeaks,
        gainDb: stem.gainDb,
        offsetMs: stem.offsetMs,
        isMuted: stem.isMuted,
        tonePreset: stem.tonePreset,
        color: getOverdubStemColor(stem, index),
      })),
    [playerClip?.overdub?.stems, t]
  );

  return {
    activeWorkspaceId,
    playerTarget,
    playerQueue,
    playerQueueIndex,
    playerShouldAutoplay,
    playerToggleRequestToken,
    playerCloseRequestToken,
    playerIdea,
    playerClip,
    latestLyricsVersion,
    latestLyricsText,
    clipLyrics,
    clipLyricsText,
    hasProjectLyrics,
    playbackAudioUri,
    waveformPeaks,
    waveformPending,
    waveformResolving,
    displayDuration,
    practiceMarkers,
    sections,
    analysis,
    clipNotes,
    hasClipOverdubs,
    clipOverdubStemCount,
    overdubRootSettings,
    overdubStemEntries,
    isOverdubPreviewRendering,
  };
}
