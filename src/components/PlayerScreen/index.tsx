import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Alert, Pressable, Text, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
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

export function PlayerScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const playerTarget = useStore((s) => s.playerTarget);
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
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
  const displayDuration = fullPlayer.playerDuration || playerClip?.durationMs || 0;
  const wasPlayingRef = useRef(false);
  const didBlurCleanupRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const hasPreviousTrack = playerQueueIndex > 0;
  const hasNextTrack = playerQueueIndex >= 0 && playerQueueIndex < playerQueue.length - 1;

  // Load the track if it changes
  useEffect(() => {
    if (!isFocused) return;
    didBlurCleanupRef.current = false;
    if (playerIdea && playerClip && playerClip.audioUri) {
      if (fullPlayer.playerTarget?.clipId !== playerClip.id) {
        const shouldAutoplay = useStore.getState().playerShouldAutoplay;
        if (shouldAutoplay) {
          useStore.getState().consumePlayerAutoplay();
        }
        void fullPlayer.openPlayer(
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
  }, [fullPlayer.playerTarget?.clipId, isFocused, playerClip?.audioUri, playerClip?.id, playerIdea?.id]);

  useEffect(() => {
    if (!playerIdea || !playerClip) return;
    fullPlayer.updateLockScreenMetadata({
      title: playerClip.title,
      albumTitle: playerIdea.title,
    });
  }, [playerClip?.title, playerIdea?.title]);

  useEffect(() => {
    if (!playerIdea || !playerClip || !fullPlayer.playerDuration) return;
    if (playerClip.durationMs && playerClip.durationMs > 0) return;

    useStore.setState((state) => ({
      workspaces: state.workspaces.map((workspace) => {
        if (workspace.id !== activeWorkspaceId) return workspace;
        return {
          ...workspace,
          ideas: workspace.ideas.map((idea) =>
            idea.id !== playerIdea.id
              ? idea
              : {
                  ...idea,
                  clips: idea.clips.map((clip) =>
                    clip.id === playerClip.id ? { ...clip, durationMs: fullPlayer.playerDuration } : clip
                  ),
                }
          ),
        };
      }),
    }));
  }, [activeWorkspaceId, fullPlayer.playerDuration, playerClip?.durationMs, playerClip?.id, playerIdea?.id]);

  useEffect(() => {
    if (isFocused) return;
    if (didBlurCleanupRef.current) return;
    didBlurCleanupRef.current = true;
    wasPlayingRef.current = false;
    setIsScrubbing((prev) => (prev ? false : prev));
    void fullPlayer.closePlayer();
  }, [isFocused]);

  useEffect(() => {
    if (!fullPlayer.finishedPlaybackToken) return;
    if (!playerClip?.id) return;
    if (fullPlayer.finishedPlaybackClipId !== playerClip.id) return;
    if (hasNextTrack) {
      useStore.getState().advancePlayerQueue("next", true);
    }
  }, [fullPlayer.finishedPlaybackClipId, fullPlayer.finishedPlaybackToken, hasNextTrack, playerClip?.id]);

  if (!playerIdea || !playerClip) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.subtitle}>Loading player…</Text>
      </SafeAreaView>
    );
  }

  const handleScrubStateChange = (scrubbing: boolean) => {
    if (scrubbing) {
      setIsScrubbing((prev) => (prev ? prev : true));
      wasPlayingRef.current = fullPlayer.isPlayerPlaying || wasPlayingRef.current;
      if (fullPlayer.isPlayerPlaying) {
        void fullPlayer.togglePlayer();
      }
      return;
    }

    setIsScrubbing((prev) => (prev ? false : prev));
    if (wasPlayingRef.current) {
      void fullPlayer.togglePlayer();
      wasPlayingRef.current = false;
    }
  };

  const handleSeekTo = async (ms: number) => {
    const wasPlaying = fullPlayer.isPlayerPlaying || wasPlayingRef.current;
    const atEnd = displayDuration > 0 && ms >= displayDuration - 5;

    setIsScrubbing((prev) => (prev ? prev : true));
    await fullPlayer.seekTo(ms);
    await new Promise((resolve) => setTimeout(resolve, 90));

    if (!wasPlaying || atEnd) {
      wasPlayingRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            fullPlayer.closePlayer();
            useStore.getState().clearPlayerQueue();
            navigation.goBack();
          }}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Player</Text>
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

      <Text style={styles.subtitle}>{playerIdea.title}</Text>

      <PlayerQueue
        entries={queueEntries}
        currentClipId={playerClip.id}
        compact={hasProjectLyrics}
        onSelect={(index) => {
          useStore.getState().setPlayerQueue(playerQueue, index, true);
        }}
      />

      {playerQueue.length > 1 ? (
        <View style={styles.rowButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              !hasPreviousTrack ? styles.btnDisabled : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => useStore.getState().advancePlayerQueue("previous", true)}
            disabled={!hasPreviousTrack}
          >
            <Text style={styles.secondaryBtnText}>Previous track</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              !hasNextTrack ? styles.btnDisabled : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => useStore.getState().advancePlayerQueue("next", true)}
            disabled={!hasNextTrack}
          >
            <Text style={styles.secondaryBtnText}>Next track</Text>
          </Pressable>
        </View>
      ) : null}

      <PlayerControls
        playerPosition={fullPlayer.playerPosition}
        playerDuration={displayDuration}
        waveformPeaks={fullPlayer.waveformPeaks}
        isPlayerPlaying={fullPlayer.isPlayerPlaying}
        isScrubbing={isScrubbing}
        compact={hasProjectLyrics}
        topLeftContent={
          <>
            <Pressable
              style={({ pressed }) => [
                styles.playerUtilityBtn,
                pressed ? styles.pressDown : null,
              ]}
              onPress={async () => {
                if (fullPlayer.isPlayerPlaying) {
                  await fullPlayer.togglePlayer();
                }
                (navigation as any).navigate("Editor", {
                  ideaId: playerIdea.id,
                  clipId: playerClip.id,
                  audioUri: playerClip.audioUri,
                  durationMs: displayDuration || undefined,
                });
              }}
            >
              <Text style={styles.playerUtilityBtnText}>Edit</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.playerUtilityBtn,
                styles.playerUtilityBtnSecondary,
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
              <Text style={[styles.playerUtilityBtnText, styles.playerUtilityBtnTextSecondary]}>Share</Text>
            </Pressable>
          </>
        }
        onSeekTo={handleSeekTo}
        onTogglePlay={fullPlayer.togglePlayer}
        onScrubStateChange={handleScrubStateChange}
      />

      {hasProjectLyrics && latestLyricsVersion ? (
        <PlayerLyricsPanel
          text={latestLyricsText}
          versionLabel={`Version ${playerIdea.lyrics?.versions.length ?? 1}`}
          updatedAtLabel={formatDate(latestLyricsVersion.updatedAt)}
        />
      ) : null}

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
