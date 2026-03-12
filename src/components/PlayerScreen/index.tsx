import React, { useEffect, useMemo, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Alert, Pressable, Text, View } from "react-native";
import { StackActions, useIsFocused, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { useFullPlayer } from "../../hooks/useFullPlayer";
import { PlayerControls } from "./PlayerControls";
import { PlayerQueue } from "./PlayerQueue";
import { shareAudioFile } from "../../services/audioStorage";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { PlayerLyricsPanel } from "./PlayerLyricsPanel";
import { formatDate } from "../../utils";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { getCollectionHierarchyLevel, getIdeaHierarchyLevel } from "../../hierarchy";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { appActions } from "../../state/actions";

export function PlayerScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const playerTarget = useStore((s) => s.playerTarget);
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const playerToggleRequestToken = useStore((s) => s.playerToggleRequestToken);
  const playerCloseRequestToken = useStore((s) => s.playerCloseRequestToken);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const ideas = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.ideas || []);
  const activeWorkspace = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null);

  const playerIdea = playerTarget ? ideas.find((x) => x.id === playerTarget.ideaId) ?? null : null;
  const playerClip = playerIdea && playerTarget ? playerIdea.clips.find((c) => c.id === playerTarget.clipId) ?? null : null;
  const queueEntries = playerQueue
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
    .filter((entry): entry is { ideaId: string; clipId: string; title: string; subtitle: string } => !!entry);
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
  const playerCollectionAncestors =
    playerCollection && activeWorkspace ? getCollectionAncestors(activeWorkspace, playerCollection.id) : [];

  const fullPlayer = useFullPlayer();
  const {
    playerTarget: activePlayerTarget,
    playerPosition,
    playerDuration,
    isPlayerPlaying,
    waveformPeaks,
    finishedPlaybackToken,
    finishedPlaybackClipId,
    openPlayer,
    closePlayer,
    togglePlayer,
    pausePlayer,
    playPlayer,
    seekTo,
    updateLockScreenMetadata,
  } = fullPlayer;
  const displayDuration = playerDuration || playerClip?.durationMs || 0;
  const hasPreviousTrack = playerQueueIndex > 0;
  const hasNextTrack = playerQueueIndex >= 0 && playerQueueIndex < playerQueue.length - 1;
  const handledToggleTokenRef = useRef(playerToggleRequestToken);
  const handledCloseTokenRef = useRef(playerCloseRequestToken);
  const transportScrub = useTransportScrubbing({
    isPlaying: isPlayerPlaying,
    durationMs: displayDuration,
    pause: pausePlayer,
    play: playPlayer,
    seekTo,
  });
  const { beginScrub, endScrub, cancelScrub, scrubTo } = transportScrub;
  const lyricsAutoscrollState = useMemo(
    () => ({
      mode: "off" as const,
      currentTimeMs: playerPosition,
      durationMs: displayDuration,
      activeLineId: null,
    }),
    [displayDuration, playerPosition]
  );

  // Load the track if it changes
  useEffect(() => {
    if (!isFocused) return;
    if (playerIdea && playerClip && playerClip.audioUri) {
      if (activePlayerTarget?.clipId !== playerClip.id) {
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
          shouldAutoplay
        );
      }
    }
  }, [activePlayerTarget?.clipId, isFocused, openPlayer, playerClip?.audioUri, playerClip?.id, playerIdea?.id, playerClip, playerIdea]);

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
    if (!finishedPlaybackToken) return;
    if (!playerClip?.id) return;
    if (finishedPlaybackClipId !== playerClip.id) return;
    if (hasNextTrack) {
      useStore.getState().advancePlayerQueue("next", true);
    }
  }, [finishedPlaybackClipId, finishedPlaybackToken, hasNextTrack, playerClip?.id]);

  useEffect(() => {
    if (playerToggleRequestToken === handledToggleTokenRef.current) return;
    handledToggleTokenRef.current = playerToggleRequestToken;
    void togglePlayer();
  }, [playerToggleRequestToken, togglePlayer]);

  useEffect(() => {
    if (playerCloseRequestToken === handledCloseTokenRef.current) return;
    handledCloseTokenRef.current = playerCloseRequestToken;
    void cancelScrub();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
  }, [cancelScrub, closePlayer, playerCloseRequestToken]);

  function minimizePlayer() {
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

    navigation.dispatch(StackActions.push("Home"));
  }

  if (!playerIdea || !playerClip) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.subtitle}>Loading player…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TransportLayout
        header={
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerLeftCluster}>
                <Pressable
                  style={styles.backBtn}
                  onPress={() => {
                    closePlayer();
                    useStore.getState().clearPlayerQueue();
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.backBtnText}>← Back</Text>
                </Pressable>
              </View>
              <Text style={styles.title}>Player</Text>
              <Pressable
                style={({ pressed }) => [styles.transportHeaderActionBtn, pressed ? styles.pressDown : null]}
                onPress={minimizePlayer}
                accessibilityRole="button"
                accessibilityLabel="Minimize player"
              >
                <Ionicons name="remove" size={18} color="#334155" />
              </Pressable>
            </View>

            {activeWorkspace && playerCollection ? (
              <AppBreadcrumbs
                items={[
                  {
                    key: "home",
                    label: "Home",
                    level: "home",
                    iconOnly: true,
                    onPress: () => (navigation as any).navigate("Home", { screen: "Workspaces" }),
                  },
                  {
                    key: `workspace-${activeWorkspace.id}`,
                    label: activeWorkspace.title,
                    level: "workspace",
                    onPress: () => (navigation as any).navigate("Home", { screen: "Browse" }),
                  },
                  ...playerCollectionAncestors.map((collection) => ({
                    key: collection.id,
                    label: collection.title,
                    level: getCollectionHierarchyLevel(collection),
                    onPress: () => (navigation as any).navigate("CollectionDetail", { collectionId: collection.id }),
                  })),
                  {
                    key: playerCollection.id,
                    label: playerCollection.title,
                    level: getCollectionHierarchyLevel(playerCollection),
                    onPress: () => (navigation as any).navigate("CollectionDetail", { collectionId: playerCollection.id }),
                  },
                  ...(playerIdea.kind === "project"
                    ? [
                        {
                          key: playerIdea.id,
                          label: playerIdea.title,
                          level: getIdeaHierarchyLevel(playerIdea),
                          onPress: () => (navigation as any).navigate("IdeaDetail", { ideaId: playerIdea.id }),
                        },
                      ]
                    : []),
                  {
                    key: playerClip.id,
                    label: playerClip.title,
                    level: "clip" as const,
                    active: true,
                  },
                ]}
              />
            ) : null}
          </>
        }
        floating={
          hasProjectLyrics && latestLyricsVersion ? (
            <PlayerLyricsPanel
              text={latestLyricsText}
              versionLabel={`Version ${playerIdea.lyrics?.versions.length ?? 1}`}
              updatedAtLabel={formatDate(latestLyricsVersion.updatedAt)}
              autoscrollState={lyricsAutoscrollState}
            />
          ) : null
        }
        footer={
          <View style={styles.transportFooterCard}>
            <View style={styles.transportFooterMeta}>
              <Text style={styles.transportFooterEyebrow}>Sticky Controls</Text>
              <Text style={styles.transportFooterTitle}>{playerClip.title}</Text>
            </View>
            <View style={styles.transportFooterRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.transportFooterButton,
                  styles.transportFooterButtonSecondary,
                  !hasPreviousTrack ? styles.transportFooterButtonDisabled : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => useStore.getState().advancePlayerQueue("previous", true)}
                disabled={!hasPreviousTrack}
              >
                <Text style={[styles.transportFooterButtonText, styles.transportFooterButtonTextSecondary]}>
                  Prev
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.transportFooterButton,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={async () => {
                  if (isPlayerPlaying) {
                    await pausePlayer();
                  }
                  (navigation as any).navigate("Editor", {
                    ideaId: playerIdea.id,
                    clipId: playerClip.id,
                    audioUri: playerClip.audioUri,
                    durationMs: displayDuration || undefined,
                  });
                }}
              >
                <Text style={styles.transportFooterButtonText}>Edit</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.transportFooterButton,
                  styles.transportFooterButtonSecondary,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={async () => {
                  if (!playerClip.audioUri) return;
                  try {
                    await shareAudioFile(playerClip.audioUri, playerClip.title);
                  } catch (error) {
                    console.warn("Share audio error", error);
                    const message = error instanceof Error ? error.message : "Could not share this audio file.";
                    Alert.alert("Share failed", message);
                  }
                }}
              >
                <Text style={[styles.transportFooterButtonText, styles.transportFooterButtonTextSecondary]}>
                  Share
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.transportFooterButton,
                  styles.transportFooterButtonSecondary,
                  !hasNextTrack ? styles.transportFooterButtonDisabled : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => useStore.getState().advancePlayerQueue("next", true)}
                disabled={!hasNextTrack}
              >
                <Text style={[styles.transportFooterButtonText, styles.transportFooterButtonTextSecondary]}>
                  Next
                </Text>
              </Pressable>
            </View>
          </View>
        }
      >
        <Text style={styles.subtitle}>{playerIdea.title}</Text>

        <PlayerQueue
          entries={queueEntries}
          currentClipId={playerClip.id}
          compact={hasProjectLyrics}
          onSelect={(index) => {
            useStore.getState().setPlayerQueue(playerQueue, index, true);
          }}
        />

        <PlayerControls
          playerPosition={playerPosition}
          playerDuration={displayDuration}
          waveformPeaks={waveformPeaks}
          isPlayerPlaying={isPlayerPlaying}
          isScrubbing={transportScrub.isScrubbing}
          compact={hasProjectLyrics}
          onSeekTo={scrubTo}
          onTogglePlay={togglePlayer}
          onScrubStateChange={(scrubbing) => {
            if (scrubbing) {
              void beginScrub();
              return;
            }
            void endScrub();
          }}
        />
      </TransportLayout>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
