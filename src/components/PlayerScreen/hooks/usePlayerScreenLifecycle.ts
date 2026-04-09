import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { StackActions } from "@react-navigation/native";
import { MANAGED_WAVEFORM_PEAK_COUNT, loadManagedAudioMetadata, shareAudioFile } from "../../../services/audioStorage";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";

type UsePlayerScreenLifecycleArgs = {
  navigation: any;
  isFocused: boolean;
  playerIdea: { id: string; title: string } | null;
  playerClip: {
    id: string;
    title: string;
    audioUri?: string | null;
    durationMs?: number;
    waveformPeaks?: number[] | null;
  } | null;
  activeWorkspaceId: string | null;
  activePlayerTargetClipId?: string | null;
  playerDuration: number;
  displayDuration: number;
  isPlayerPlaying: boolean;
  finishedPlaybackToken: number;
  finishedPlaybackClipId: string | null;
  hasNextTrack: boolean;
  playerQueue: { ideaId: string; clipId: string }[];
  playerToggleRequestToken: number;
  playerCloseRequestToken: number;
  mode: "player" | "practice";
  suppressAutoplayOnOpen?: boolean;
  speedPanelVisible: boolean;
  openPlayer: (ideaId: string, clip: any, metadata?: { title?: string; albumTitle?: string }, autoplay?: boolean) => Promise<void>;
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
};

export function usePlayerScreenLifecycle({
  navigation,
  isFocused,
  playerIdea,
  playerClip,
  activeWorkspaceId,
  activePlayerTargetClipId,
  playerDuration,
  displayDuration,
  isPlayerPlaying,
  finishedPlaybackToken,
  finishedPlaybackClipId,
  hasNextTrack,
  playerQueue,
  playerToggleRequestToken,
  playerCloseRequestToken,
  mode,
  suppressAutoplayOnOpen = false,
  speedPanelVisible,
  openPlayer,
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
}: UsePlayerScreenLifecycleArgs) {
  const handledToggleTokenRef = useRef(playerToggleRequestToken);
  const handledCloseTokenRef = useRef(playerCloseRequestToken);
  const hydratedWaveformClipIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isFocused) return;
    if (!playerIdea || !playerClip?.audioUri) return;
    if (activePlayerTargetClipId === playerClip.id) return;

    const shouldAutoplay = useStore.getState().playerShouldAutoplay;
    if (shouldAutoplay) {
      useStore.getState().consumePlayerAutoplay();
    }

    void openPlayer(
      playerIdea.id,
      playerClip,
      {
        title: playerClip.title,
        albumTitle: playerIdea.title,
      },
      shouldAutoplay && !suppressAutoplayOnOpen
    );
  }, [activePlayerTargetClipId, isFocused, openPlayer, playerClip, playerIdea, suppressAutoplayOnOpen]);

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

    void loadManagedAudioMetadata(
      playerClip.audioUri,
      `${playerIdea.id}-${playerClip.id}`,
      playerClip.durationMs
    )
      .then((metadata) => {
        appActions.hydrateClipAudioMetadata(activeWorkspaceId, playerIdea.id, playerClip.id, {
          durationMs: metadata.durationMs,
          waveformPeaks: metadata.waveformPeaks,
        });
      })
      .catch((error) => {
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
    if (!finishedPlaybackToken || !playerClip?.id) return;
    if (finishedPlaybackClipId !== playerClip.id) return;
    if (hasNextTrack) {
      useStore.getState().advancePlayerQueue("next", true);
    }
  }, [finishedPlaybackClipId, finishedPlaybackToken, hasNextTrack, playerClip?.id]);

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
    prepareTransportForClose();
    cancelPendingPracticeSeek();
    void cancelScrub();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
  }, [
    cancelPendingPracticeSeek,
    cancelScrub,
    closePlayer,
    playerCloseRequestToken,
    prepareTransportForClose,
  ]);

  const handleBack = useCallback(() => {
    prepareTransportForClose();
    cancelPendingPracticeSeek();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
    navigation.goBack();
  }, [cancelPendingPracticeSeek, closePlayer, navigation, prepareTransportForClose]);

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

  const minimizePlayer = useCallback(() => {
    const routes = navigation.getState()?.routes ?? [];
    const targetRoute =
      [...routes]
        .slice(0, -1)
        .reverse()
        .find((route) => route.name !== "Player" && route.name !== "Recording") ?? null;

    if (targetRoute) {
      navigation.dispatch(StackActions.push(targetRoute.name, targetRoute.params));
      return;
    }

    navigation.navigate("Home", { screen: "Workspaces" });
  }, [navigation]);

  const handleTogglePlayPress = useCallback(() => {
    void handleTransportToggle();
  }, [handleTransportToggle]);

  const handlePreviousTrack = useCallback(() => {
    useStore.getState().advancePlayerQueue("previous", true);
  }, []);

  const handleNextTrack = useCallback(() => {
    useStore.getState().advancePlayerQueue("next", true);
  }, []);

  const handleQueueSelect = useCallback(
    (index: number) => {
      useStore.getState().setPlayerQueue(playerQueue, index, true);
    },
    [playerQueue]
  );

  const handleOverflowMenu = useCallback(() => {
    Alert.alert("Player options", playerClip?.title, [
      {
        text: "Minimize player",
        onPress: minimizePlayer,
      },
      {
        text: "Edit clip",
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
      {
        text: "Share audio",
        onPress: async () => {
          if (!playerClip?.audioUri) return;
          try {
            await shareAudioFile(playerClip.audioUri, playerClip.title);
          } catch (error) {
            console.warn("Share audio error", error);
            const message = error instanceof Error ? error.message : "Could not share this audio file.";
            Alert.alert("Share failed", message);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [displayDuration, isPlayerPlaying, minimizePlayer, navigation, pausePlayer, playerClip, playerIdea]);

  return {
    handleBack,
    handleScrubStateChange,
    handleTogglePlayPress,
    handlePreviousTrack,
    handleNextTrack,
    handleQueueSelect,
    handleOverflowMenu,
  };
}
