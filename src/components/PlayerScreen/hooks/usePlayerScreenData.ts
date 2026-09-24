import { useMemo } from "react";
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
import { findClipInIdea, findIdeaInLibrary, findWorkspaceOfIdea, queueListingKey } from "../../../state/librarySelectors";
import type { SongIdea } from "../../../types";
import { getCollectionById } from "../../../utils";
import { extractLyricsMarkers, getNoteSummary } from "../helpers";
import { useTranslation } from "react-i18next";

const EMPTY_IDEAS: SongIdea[] = [];

export type PlayerQueueEntry = {
  ideaId: string;
  clipId: string;
  title: string;
  subtitle: string;
};


type UsePlayerScreenDataArgs = {
  playerDuration: number;
  /** The file the engine has loaded. Its duration is only this clip's when they match. */
  currentPlaybackSourceUri?: string | null;
  /** Active playback of this clip — holds off the sidecar decode so it can't stall the track. */
  isPlaying?: boolean;
};

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
  const playerCollection = useStore((s) => {
    if (!playerIdea) return null;
    const workspace = findWorkspaceOfIdea(s.workspaces, playerIdea.id);
    return workspace ? getCollectionById(workspace, playerIdea.collectionId) ?? null : null;
  });
  // The queue listing re-renders only when a shown title or length changes.
  const queueKey = useStore((s) => queueListingKey(s.workspaces, playerQueue));
  const queueEntries = useMemo(() => {
    const workspaces = useStore.getState().workspaces;
    return playerQueue
      .map((item) => {
        const idea = findIdeaInLibrary(workspaces, item.ideaId);
        const clip = findClipInIdea(idea, item.clipId);
        if (!idea || !clip) return null;
        return {
          ideaId: item.ideaId,
          clipId: item.clipId,
          title: clip.title,
          subtitle: idea.title,
        };
      })
      .filter((entry): entry is PlayerQueueEntry => !!entry);
    // queueKey is the fingerprint of everything read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerQueue, queueKey]);
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
  const displayDuration =
    (engineHoldsThisClip ? playerDuration : 0) || (playerClip ? getClipPlaybackDurationMs(playerClip) : 0) || 0;
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
  const practiceMarkers = useMemo(() => {
    if (playerClip?.practiceMarkers && playerClip.practiceMarkers.length > 0) {
      return playerClip.practiceMarkers;
    }
    return extractLyricsMarkers(latestLyricsText, displayDuration);
  }, [displayDuration, latestLyricsText, playerClip?.practiceMarkers]);
  const sections = useMemo(
    () => normalizeSections(playerClip?.sections ?? [], displayDuration),
    [playerClip?.sections, displayDuration]
  );
  const analysis = playerClip?.analysis ?? null;
  const clipNotes = playerClip?.notes ?? "";
  const clipNotesSummary = getNoteSummary(clipNotes, t("player.noNotes"));
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
    queueEntries,
    latestLyricsVersion,
    latestLyricsText,
    clipLyrics,
    clipLyricsText,
    hasProjectLyrics,
    playerCollection,
    playbackAudioUri,
    waveformPeaks,
    waveformPending,
    waveformResolving,
    displayDuration,
    practiceMarkers,
    sections,
    analysis,
    clipNotes,
    clipNotesSummary,
    hasClipOverdubs,
    clipOverdubStemCount,
    overdubRootSettings,
    overdubStemEntries,
    isOverdubPreviewRendering,
  };
}
