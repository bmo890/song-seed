import { useMemo } from "react";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../lyrics";
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
};

export function usePlayerScreenData({ playerDuration }: UsePlayerScreenDataArgs) {
  const playerTarget = useStore((s) => s.playerTarget);
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const playerShouldAutoplay = useStore((s) => s.playerShouldAutoplay);
  const playerToggleRequestToken = useStore((s) => s.playerToggleRequestToken);
  const playerCloseRequestToken = useStore((s) => s.playerCloseRequestToken);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const workspaces = useStore((s) => s.workspaces);

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
  const displayDuration = playerDuration || playerClip?.durationMs || 0;
  const practiceMarkers = useMemo(() => {
    if (playerClip?.practiceMarkers && playerClip.practiceMarkers.length > 0) {
      return playerClip.practiceMarkers;
    }
    return extractLyricsMarkers(latestLyricsText, displayDuration);
  }, [displayDuration, latestLyricsText, playerClip?.practiceMarkers]);
  const clipNotes = playerClip?.notes ?? "";
  const clipNotesSummary = getNoteSummary(clipNotes);

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
    displayDuration,
    practiceMarkers,
    clipNotes,
    clipNotesSummary,
  };
}
