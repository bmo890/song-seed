import { useCallback, useEffect, useRef } from "react";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { clipHasOverdubs, getClipPlaybackUri } from "../../../clipPresentation";
import { MANAGED_WAVEFORM_PEAK_COUNT, loadManagedAudioMetadata, shareAudioFile } from "../../../services/audioStorage";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";
import type { ClipVersion } from "../../../types";

type UsePlayerScreenLifecycleArgs = {
  navigation: any;
  isFocused: boolean;
  playerIdea: { id: string; title: string } | null;
  playerClip: ClipVersion | null;
  playbackAudioUri: string | null;
  currentPlaybackSourceUri: string | null;
  activeWorkspaceId: string | null;
  activePlayerTargetClipId?: string | null;
  /** Bumps whenever an engine load operation settles (success, failure, OR abort).
   *  Keys the load effect so an aborted open re-checks instead of dying silently. */
  engineOpNonce: number;
  playerPosition: number;
  playerDuration: number;
  displayDuration: number;
  isPlayerPlaying: boolean;
  finishedPlaybackToken: number;
  finishedPlaybackClipId: string | null;
  hasNextTrack: boolean;
  repeatEnabled: boolean;
  replayClip: () => Promise<void>;
  playerQueue: { ideaId: string; clipId: string }[];
  playerToggleRequestToken: number;
  playerCloseRequestToken: number;
  mode: "player" | "practice" | "playalong";
  suppressAutoplayOnOpen?: boolean;
  speedPanelVisible: boolean;
  openPlayer: (ideaId: string, clip: any, metadata?: { title?: string; albumTitle?: string }, autoplay?: boolean) => Promise<void>;
  syncPlayerSource: (
    ideaId: string,
    clip: any,
    metadata?: { title?: string; albumTitle?: string },
    resumeAtMs?: number,
    shouldPlay?: boolean
  ) => Promise<void>;
  closePlayer: () => Promise<void>;
  pausePlayer: () => Promise<void>;
  updateLockScreenMetadata: (metadata: { title?: string; albumTitle?: string }) => void;
  beginScrub: () => Promise<void>;
  endScrub: () => Promise<void>;
  cancelScrub: () => Promise<void>;
  cancelPendingPracticeSeek: () => void;
  handleTransportToggle: () => Promise<void>;
  setSpeedPanelVisible: (visible: boolean) => void;
  prepareTransportForClose: () => void;
  /** Opens a help sheet from the overflow menu. */
  onShowHelp: (topic: "practice" | "overdub") => void;
};

export function usePlayerScreenLifecycle({
  navigation,
  isFocused,
  playerIdea,
  playerClip,
  playbackAudioUri,
  currentPlaybackSourceUri,
  activeWorkspaceId,
  activePlayerTargetClipId,
  engineOpNonce,
  playerPosition,
  playerDuration,
  displayDuration,
  isPlayerPlaying,
  finishedPlaybackToken,
  finishedPlaybackClipId,
  hasNextTrack,
  repeatEnabled,
  replayClip,
  playerQueue,
  playerToggleRequestToken,
  playerCloseRequestToken,
  mode,
  suppressAutoplayOnOpen = false,
  speedPanelVisible,
  openPlayer,
  syncPlayerSource,
  closePlayer,
  pausePlayer,
  updateLockScreenMetadata,
  beginScrub,
  endScrub,
  cancelScrub,
  cancelPendingPracticeSeek,
  handleTransportToggle,
  setSpeedPanelVisible,
  prepareTransportForClose,
  onShowHelp,
}: UsePlayerScreenLifecycleArgs) {
  const handledToggleTokenRef = useRef(playerToggleRequestToken);
  const handledCloseTokenRef = useRef(playerCloseRequestToken);
  const handledFinishTokenRef = useRef(0);
  const hydratedWaveformClipIdsRef = useRef(new Set<string>());
  const sourceSyncInFlightUriRef = useRef<string | null>(null);
  const openInFlightClipIdRef = useRef<string | null>(null);
  const pendingAutoplayClipIdRef = useRef<string | null>(null);
  const latestPlaybackRef = useRef({
    positionMs: playerPosition,
    isPlaying: isPlayerPlaying,
  });

  latestPlaybackRef.current = {
    positionMs: playerPosition,
    isPlaying: isPlayerPlaying,
  };

  useEffect(() => {
    if (!isFocused) return;
    if (!playerIdea || !playerClip) return;
    if (!getClipPlaybackUri(playerClip)) return;

    const isSameTarget = activePlayerTargetClipId === playerClip.id;
    if (isSameTarget && currentPlaybackSourceUri) {
      openInFlightClipIdRef.current = null;
      pendingAutoplayClipIdRef.current = null;
      return;
    }
    if (isSameTarget && !currentPlaybackSourceUri && playbackAudioUri == null) {
      return;
    }
    // One open per clip at a time — re-runs (including engineOpNonce settles from
    // superseded operations) must not stack duplicate opens that cancel each other.
    if (openInFlightClipIdRef.current === playerClip.id) return;
    openInFlightClipIdRef.current = playerClip.id;

    // Autoplay is consumed from the store up front; carry it per-clip so a retry
    // after an aborted open still autoplays instead of silently landing paused.
    let shouldAutoplay = useStore.getState().playerShouldAutoplay;
    if (shouldAutoplay) {
      useStore.getState().consumePlayerAutoplay();
      pendingAutoplayClipIdRef.current = playerClip.id;
    } else if (pendingAutoplayClipIdRef.current === playerClip.id) {
      shouldAutoplay = true;
    } else {
      pendingAutoplayClipIdRef.current = null;
    }

    const clipId = playerClip.id;
    void openPlayer(
      playerIdea.id,
      playerClip,
      {
        title: playerClip.title,
        albumTitle: playerIdea.title,
      },
      shouldAutoplay && !suppressAutoplayOnOpen
    ).finally(() => {
      if (openInFlightClipIdRef.current === clipId) {
        openInFlightClipIdRef.current = null;
      }
    });
  }, [
    activePlayerTargetClipId,
    currentPlaybackSourceUri,
    // Settle signal from the engine: an ABORTED open changes none of the other
    // deps, so without this the effect never re-checks and the engine stays on
    // the previous clip while the UI shows this one (play then plays the wrong
    // audio). Each settle re-runs the reconciliation until engine == target.
    engineOpNonce,
    isFocused,
    openPlayer,
    playbackAudioUri,
    playerClip,
    playerIdea,
    suppressAutoplayOnOpen,
  ]);

  useEffect(() => {
    if (!isFocused) return;
    if (!playerIdea || !playerClip || !playbackAudioUri) return;
    if (activePlayerTargetClipId !== playerClip.id) return;
    if (!currentPlaybackSourceUri) return;
    if (currentPlaybackSourceUri === playbackAudioUri) return;
    if (sourceSyncInFlightUriRef.current === playbackAudioUri) return;

    sourceSyncInFlightUriRef.current = playbackAudioUri;
    const playbackSnapshot = latestPlaybackRef.current;
    void syncPlayerSource(
      playerIdea.id,
      playerClip,
      {
        title: playerClip.title,
        albumTitle: playerIdea.title,
      },
      playbackSnapshot.positionMs,
      playbackSnapshot.isPlaying
    ).finally(() => {
      if (sourceSyncInFlightUriRef.current === playbackAudioUri) {
        sourceSyncInFlightUriRef.current = null;
      }
    });
  }, [
    activePlayerTargetClipId,
    isFocused,
    currentPlaybackSourceUri,
    playbackAudioUri,
    playerClip,
    playerIdea,
    syncPlayerSource,
  ]);

  useEffect(() => {
    if (!playerIdea || !playerClip) return;
    updateLockScreenMetadata({
      title: playerClip.title,
      albumTitle: playerIdea.title,
    });
  }, [playerClip?.title, playerIdea?.title, updateLockScreenMetadata]);

  useEffect(() => {
    if (!activeWorkspaceId || !playerIdea || !playerClip || !playerDuration) return;
    if (playerClip.durationMs && playerClip.durationMs > 0) return;
    appActions.hydrateClipAudioMetadata(activeWorkspaceId, playerIdea.id, playerClip.id, {
      durationMs: playerDuration,
    });
  }, [activeWorkspaceId, playerDuration, playerClip?.durationMs, playerClip?.id, playerIdea?.id]);

  useEffect(() => {
    if (!activeWorkspaceId || !playerIdea || !playerClip?.audioUri) return;
    if ((playerClip.waveformPeaks?.length ?? 0) >= MANAGED_WAVEFORM_PEAK_COUNT) return;
    if (hydratedWaveformClipIdsRef.current.has(playerClip.id)) return;

    hydratedWaveformClipIdsRef.current.add(playerClip.id);
    const clipId = playerClip.id;

    void loadManagedAudioMetadata(
      playerClip.audioUri,
      `${playerIdea.id}-${playerClip.id}`,
      playerClip.durationMs,
      // The user just opened this clip: decode now, even mid-autoplay.
      { decodeMode: "interactive" }
    )
      .then((metadata) => {
        // Never overwrite the clip's stored peaks with a deterministic placeholder —
        // a skipped/failed decode returns one, and the 256-length result would pass
        // the "already hydrated" guard above forever. Un-claim so a later open retries.
        if (!metadata.usedDetailedAnalysis) {
          hydratedWaveformClipIdsRef.current.delete(clipId);
          if (metadata.durationMs && metadata.durationMs > 0) {
            appActions.hydrateClipAudioMetadata(activeWorkspaceId, playerIdea.id, clipId, {
              durationMs: metadata.durationMs,
            });
          }
          return;
        }
        appActions.hydrateClipAudioMetadata(activeWorkspaceId, playerIdea.id, clipId, {
          durationMs: metadata.durationMs,
          waveformPeaks: metadata.waveformPeaks,
        });
      })
      .catch((error) => {
        hydratedWaveformClipIdsRef.current.delete(clipId);
        console.warn("Player waveform hydration failed", error);
      });
  }, [
    activeWorkspaceId,
    playerClip?.audioUri,
    playerClip?.durationMs,
    playerClip?.id,
    playerClip?.waveformPeaks?.length,
    playerIdea?.id,
  ]);

  useEffect(() => {
    if (!finishedPlaybackToken || finishedPlaybackToken === handledFinishTokenRef.current) return;
    // When the sheet is docked (pre-mounted but not the active surface) the root
    // provider owns queue auto-advance — bail so we don't advance twice. Still
    // consume the token so a later focus doesn't replay a stale finish.
    if (!isFocused) {
      handledFinishTokenRef.current = finishedPlaybackToken;
      return;
    }
    if (!playerClip?.id || finishedPlaybackClipId !== playerClip.id) return;
    // Consume this finish exactly once: each real end-of-clip carries a new token,
    // so this still fires per playthrough (incl. repeat), but unrelated dep changes
    // while the finished clip is still current (e.g. toggling Repeat at clip end)
    // can no longer re-trigger a replay or queue advance.
    handledFinishTokenRef.current = finishedPlaybackToken;
    // Repeat wins over queue advance — replay this clip from the top.
    if (repeatEnabled) {
      void replayClip();
      return;
    }
    if (hasNextTrack) {
      useStore.getState().advancePlayerQueue("next", true);
    }
  }, [finishedPlaybackClipId, finishedPlaybackToken, hasNextTrack, isFocused, playerClip?.id, repeatEnabled, replayClip]);

  useEffect(() => {
    if (mode !== "practice" && speedPanelVisible) {
      setSpeedPanelVisible(false);
    }
  }, [mode, setSpeedPanelVisible, speedPanelVisible]);

  useEffect(() => {
    if (playerToggleRequestToken === handledToggleTokenRef.current) return;
    handledToggleTokenRef.current = playerToggleRequestToken;
    void handleTransportToggle();
  }, [handleTransportToggle, playerToggleRequestToken]);

  useEffect(() => {
    if (playerCloseRequestToken === handledCloseTokenRef.current) return;
    handledCloseTokenRef.current = playerCloseRequestToken;
    // Exactly ONE owner per close: while the full player is (or is becoming) the
    // active surface, this screen acts; while docked, the root provider acts.
    // Both acting doubled every close into two racing engine operations.
    if (!useStore.getState().isPlayerScreenMounted) return;
    prepareTransportForClose();
    cancelPendingPracticeSeek();
    void cancelScrub();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
    // A forced close (e.g. the playing clip was deleted elsewhere) also
    // dismisses the sheet — there is nothing left to show.
    useStore.getState().setPlayerScreenMounted(false);
  }, [
    cancelPendingPracticeSeek,
    cancelScrub,
    closePlayer,
    playerCloseRequestToken,
    prepareTransportForClose,
  ]);

  const handleScrubStateChange = useCallback(
    (scrubbing: boolean) => {
      if (scrubbing) {
        void beginScrub();
        return;
      }
      void endScrub();
    },
    [beginScrub, endScrub]
  );

  const popPlayerScreen = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Home", { screen: "Workspaces" });
    }
  }, [navigation]);

  // Explicit stop-and-leave, for flows where the session is over (deleting the
  // playing clip, or collapsing a finished single-clip audition).
  const stopSessionAndClose = useCallback(() => {
    prepareTransportForClose();
    cancelPendingPracticeSeek();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
    popPlayerScreen();
  }, [cancelPendingPracticeSeek, closePlayer, popPlayerScreen, prepareTransportForClose]);

  // ONE session rule, zero cases: collapsing the player NEVER ends the session —
  // playing, paused, finished, or not-yet-played, it persists in the dock with
  // its position intact. Ending is always explicit: the dock's ✕. (An earlier
  // "audition" heuristic silently closed paused single-clip sessions; it read
  // as the player losing your place.)
  const minimizePlayer = useCallback(() => {
    popPlayerScreen();
  }, [popPlayerScreen]);

  const handleTogglePlayPress = useCallback(() => {
    void handleTransportToggle();
  }, [handleTransportToggle]);

  const handlePreviousTrack = useCallback(() => {
    useStore.getState().advancePlayerQueue("previous", true);
  }, []);

  const handleNextTrack = useCallback(() => {
    useStore.getState().advancePlayerQueue("next", true);
  }, []);

  const handleOverflowMenu = useCallback(() => {
    const hasOverdubs = !!playerClip && clipHasOverdubs(playerClip);

    const openFlattenedEditor = async () => {
      if (!playerIdea || !playerClip) return;
      if (isPlayerPlaying) {
        await pausePlayer();
      }

      const savedTarget = await appActions.saveCombinedClipAsNewClip(playerIdea.id, playerClip.id);
      if (!savedTarget) return;

      const savedIdea = useStore
        .getState()
        .workspaces.flatMap((workspace) => workspace.ideas)
        .find((idea) => idea.id === savedTarget.ideaId);
      const savedClip = savedIdea?.clips.find((clip) => clip.id === savedTarget.clipId) ?? null;
      if (!savedIdea || !savedClip?.audioUri) {
        throw new Error("Combined clip could not be opened for editing.");
      }

      navigation.navigate("Editor", {
        ideaId: savedIdea.id,
        clipId: savedClip.id,
        audioUri: savedClip.audioUri,
        durationMs: savedClip.durationMs || undefined,
      });
    };

    AppAlert.custom("Player options", playerClip?.title ?? undefined, [
      {
        label: "Add overdub",
        style: "default",
        icon: actionIcons.record,
        onPress: async () => {
          if (!playerIdea || !playerClip) return;
          if (isPlayerPlaying) {
            await pausePlayer();
          }
          try {
            await appActions.startClipOverdubRecording(playerIdea.id, playerClip.id);
            navigation.navigate("Recording" as never);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Could not start overdub recording.";
            AppAlert.info("Overdub unavailable", message);
          }
        },
      },
      ...(hasOverdubs
        ? [
            {
              label: "Save combined as new clip",
              style: "default" as const,
              icon: actionIcons.add,
              onPress: async () => {
                if (!playerIdea || !playerClip) return;
                if (isPlayerPlaying) {
                  await pausePlayer();
                }
                try {
                  await appActions.saveCombinedClipAsNewClip(playerIdea.id, playerClip.id);
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                    return;
                  }
                  AppAlert.info("Combined clip saved", "The flattened mix was added as a new clip.");
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : "Could not save a combined clip.";
                  AppAlert.info("Save combined failed", message);
                }
              },
            },
            {
              label: "Save combined and edit",
              style: "default" as const,
              icon: actionIcons.edit,
              onPress: async () => {
                try {
                  await openFlattenedEditor();
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : "Could not open the combined clip.";
                  AppAlert.info("Save combined failed", message);
                }
              },
            },
          ]
        : [
            {
              label: "Edit clip",
              style: "default" as const,
              icon: actionIcons.edit,
              onPress: async () => {
                if (!playerIdea || !playerClip) return;
                if (isPlayerPlaying) {
                  await pausePlayer();
                }
                navigation.navigate("Editor", {
                  ideaId: playerIdea.id,
                  clipId: playerClip.id,
                  audioUri: playerClip.audioUri,
                  durationMs: displayDuration || undefined,
                });
              },
            },
          ]),
      {
        label: "How practice works",
        style: "default" as const,
        icon: "help-circle-outline" as const,
        onPress: () => onShowHelp("practice"),
      },
      ...(hasOverdubs
        ? [
            {
              label: "How overdubs work",
              style: "default" as const,
              icon: "help-circle-outline" as const,
              onPress: () => onShowHelp("overdub"),
            },
          ]
        : []),
      {
        label: "Share audio",
        style: "default",
        icon: actionIcons.share,
        onPress: async () => {
          const playbackUri = playerClip ? getClipPlaybackUri(playerClip) : null;
          if (!playbackUri) return;
          const clipTitle = playerClip?.title ?? "Clip";
          try {
            await shareAudioFile(playbackUri, clipTitle);
          } catch (error) {
            console.warn("Share audio error", error);
            const message = error instanceof Error ? error.message : "Could not share this audio file.";
            AppAlert.info("Share failed", message);
          }
        },
      },
      {
        label: "Delete clip",
        style: "destructive",
        icon: "trash-outline",
        onPress: () => {
          if (!playerIdea || !playerClip) return;
          const clipId = playerClip.id;
          const fullIdea = useStore
            .getState()
            .workspaces.flatMap((workspace) => workspace.ideas)
            .find((idea) => idea.id === playerIdea.id);
          const isProject = fullIdea?.kind === "project";
          // Deleting the idea's only clip would leave it empty — for a song we
          // delete the whole project (with clear wording); for a standalone clip
          // that just is the delete.
          const emptiesIdea = (fullIdea?.clips.length ?? 0) <= 1;

          const title = emptiesIdea && isProject ? "Delete song?" : "Delete clip?";
          const message =
            emptiesIdea && isProject
              ? `This is the only clip in "${playerIdea.title}", so deleting it removes the whole song. Its audio moves to Trash.`
              : emptiesIdea
                ? `Delete "${playerClip.title ?? playerIdea.title}"? Its audio moves to Trash.`
                : "Remove this clip from the song? Its audio moves to Trash.";

          AppAlert.destructive(
            title,
            message,
            async () => {
              if (isPlayerPlaying) {
                await pausePlayer();
              }
              if (emptiesIdea) {
                useStore.getState().deleteIdea(playerIdea.id);
              } else {
                appActions.deleteClipFromIdea(playerIdea.id, clipId);
              }
              // Close the player — it was pointed at the now-deleted clip.
              // Exits no longer stop audio implicitly, so clean up explicitly.
              stopSessionAndClose();
            },
            { confirmLabel: emptiesIdea && isProject ? "Delete song" : "Delete", icon: "trash-outline" }
          );
        },
      },
      { label: "Cancel", style: "cancel" },
    ]);
  }, [displayDuration, isPlayerPlaying, navigation, pausePlayer, playerClip, playerIdea, stopSessionAndClose]);

  return {
    minimizePlayer,
    stopSessionAndClose,
    handleScrubStateChange,
    handleTogglePlayPress,
    handlePreviousTrack,
    handleNextTrack,
    handleOverflowMenu,
  };
}
