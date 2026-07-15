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
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../domain/lyrics";
import { normalizeSections } from "../../../domain/playerSections";
import { useStore } from "../../../state/useStore";
import type { SongIdea } from "../../../types";
import { getCollectionById } from "../../../utils";
import { extractLyricsMarkers, getNoteSummary } from "../helpers";

const EMPTY_IDEAS: SongIdea[] = [];

export type PlayerQueueEntry = {
  ideaId: string;
  clipId: string;
  title: string;
  subtitle: string;
};


type UsePlayerScreenDataArgs = {
  playerDuration: number;
  /** Active playback of this clip — holds off the sidecar decode so it can't stall the track. */
  isPlaying?: boolean;
};

export function usePlayerScreenData({ playerDuration, isPlaying = false }: UsePlayerScreenDataArgs) {
  const playerTarget = useStore((s) => s.playerTarget);
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const playerShouldAutoplay = useStore((s) => s.playerShouldAutoplay);
  const playerToggleRequestToken = useStore((s) => s.playerToggleRequestToken);
  const playerCloseRequestToken = useStore((s) => s.playerCloseRequestToken);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const workspaces = useStore((s) => s.workspaces);
  const isOverdubPreviewRendering = useStore((s) =>
    playerTarget ? !!s.overdubPreviewRenderActiveByClipKey[`${playerTarget.ideaId}:${playerTarget.clipId}`] : false
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );
  const ideas = activeWorkspace?.ideas ?? EMPTY_IDEAS;

  const playerIdea = useMemo(
    () => (playerTarget ? ideas.find((idea) => idea.id === playerTarget.ideaId) ?? null : null),
    [ideas, playerTarget]
  );
  const playerClip = useMemo(
    () => (playerIdea && playerTarget ? playerIdea.clips.find((clip) => clip.id === playerTarget.clipId) ?? null : null),
    [playerIdea, playerTarget]
  );
  const queueEntries = useMemo(
    () =>
      playerQueue
        .map((item) => {
          const idea = ideas.find((candidate) => candidate.id === item.ideaId);
          const clip = idea?.clips.find((candidate) => candidate.id === item.clipId);
          if (!idea || !clip) return null;
          return {
            ideaId: item.ideaId,
            clipId: item.clipId,
            title: clip.title,
            subtitle: idea.title,
          };
        })
        .filter((entry): entry is PlayerQueueEntry => !!entry),
    [ideas, playerQueue]
  );
  const latestLyricsVersion = useMemo(
    () => (playerIdea?.kind === "project" ? getLatestLyricsVersion(playerIdea) : null),
    [playerIdea]
  );
  const latestLyricsText = useMemo(
    () => lyricsDocumentToText(latestLyricsVersion?.document),
    [latestLyricsVersion?.id]
  );
  const hasProjectLyrics = playerIdea?.kind === "project" && latestLyricsText.trim().length > 0;
  const playerCollection =
    playerIdea && activeWorkspace ? getCollectionById(activeWorkspace, playerIdea.collectionId) : null;
  const playbackAudioUri = playerClip ? getClipPlaybackUri(playerClip) ?? null : null;
  const displayDuration = playerDuration || (playerClip ? getClipPlaybackDurationMs(playerClip) : 0) || 0;
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
  const clipNotesSummary = getNoteSummary(clipNotes);
  const clipOverdubStemCount = playerClip ? getClipOverdubStemCount(playerClip) : 0;
  const hasClipOverdubs = playerClip ? clipHasOverdubs(playerClip) : false;
  const overdubRootSettings = playerClip ? getClipOverdubRootSettings(playerClip) : null;
  const overdubStemEntries = useMemo(
    () =>
      (playerClip?.overdub?.stems ?? []).map((stem, index) => ({
        id: stem.id,
        title: stem.title,
        meta: stem.isMuted ? "Muted stem" : `Overdub ${index + 1}`,
        audioUri: stem.audioUri ?? null,
        durationMs: stem.durationMs ?? 0,
        waveformPeaks: stem.waveformPeaks,
        gainDb: stem.gainDb,
        offsetMs: stem.offsetMs,
        isMuted: stem.isMuted,
        tonePreset: stem.tonePreset,
        color: getOverdubStemColor(stem, index),
      })),
    [playerClip?.overdub?.stems]
  );

  return {
    activeWorkspace,
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
