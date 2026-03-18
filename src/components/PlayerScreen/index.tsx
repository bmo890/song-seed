import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { StackActions, useIsFocused, useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { useFullPlayer } from "../../hooks/useFullPlayer";
import { PlayerControls } from "./PlayerControls";
import { PlayerQueue } from "./PlayerQueue";
import { PlayerLyricsPanel } from "./PlayerLyricsPanel";
import { PlayerSupportPanel } from "./PlayerSupportPanel";
import { PlayerTransportDock } from "./PlayerTransportDock";
import { SegmentedControl } from "../common/SegmentedControl";
import { shareAudioFile } from "../../services/audioStorage";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { formatDate, fmtDuration } from "../../utils";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { getCollectionHierarchyLevel } from "../../hierarchy";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { appActions } from "../../state/actions";
import { MultiTimeRangeSelector } from "../common/TimeRangeSelector";
import { openCollectionFromContext } from "../../navigation";

type PlayerMode = "player" | "practice";
type CountInOption = "off" | "1b" | "2b";
type PracticeMarker = {
  id: string;
  label: string;
  atMs: number;
};

const PRACTICE_SPEED_OPTIONS = [0.5, 0.75, 0.9, 1] as const;

function buildDefaultLoopRegion(durationMs: number, anchorMs = 0) {
  if (durationMs <= 0) {
    return { start: 0, end: 0 };
  }
  const loopSpan = Math.max(1000, Math.round(durationMs * 0.25));
  const safeStart = Math.max(0, Math.min(anchorMs, durationMs));
  const nextEnd = Math.min(durationMs, safeStart + loopSpan);
  return {
    start: safeStart,
    end: nextEnd,
  };
}

function extractLyricsMarkers(lyricsText: string, durationMs: number): PracticeMarker[] {
  if (durationMs <= 0) return [];

  const headingLines = lyricsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && (line.endsWith(":") || /^\[[^\]]+\]$/.test(line)))
    .slice(0, 4)
    .map((line, index, items) => {
      const cleaned = line.replace(/[:\[\]]/g, "").trim();
      const denominator = Math.max(1, items.length - 1);
      return {
        id: `heading-${index}`,
        label: cleaned || `Marker ${index + 1}`,
        atMs: Math.round(durationMs * (0.1 + (0.72 * index) / denominator)),
      };
    });

  return headingLines;
}

function findActiveMarker(markers: PracticeMarker[], currentTimeMs: number) {
  if (markers.length === 0) return null;
  let activeMarker = markers[0];
  for (const marker of markers) {
    if (currentTimeMs + 600 >= marker.atMs) {
      activeMarker = marker;
    }
  }
  return activeMarker;
}

function getNoteSummary(notes: string) {
  const trimmed = notes.trim();
  if (!trimmed) return "No clip notes yet.";
  return trimmed;
}

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

  const [mode, setMode] = useState<PlayerMode>("player");
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [practiceLoopEnabled, setPracticeLoopEnabled] = useState(false);
  const [loopPlaybackEngaged, setLoopPlaybackEngaged] = useState(false);
  const [practiceLoopRange, setPracticeLoopRange] = useState({ start: 0, end: 0 });
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [countInOption, setCountInOption] = useState<CountInOption>("off");
  const [newPinLabel, setNewPinLabel] = useState("");
  const loopSeekLockRef = useRef(false);

  const fullPlayer = useFullPlayer();
  const {
    playerTarget: activePlayerTarget,
    playerPosition,
    playerDuration,
    playbackRate,
    isPlayerPlaying,
    waveformPeaks,
    finishedPlaybackToken,
    finishedPlaybackClipId,
    openPlayer,
    closePlayer,
    pausePlayer,
    playPlayer,
    seekTo,
    updateLockScreenMetadata,
    setPlaybackRate,
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
  const practiceMarkers = useMemo(() => {
    // Use custom markers if they exist
    if (playerClip?.practiceMarkers && playerClip.practiceMarkers.length > 0) {
      return playerClip.practiceMarkers;
    }
    // Fall back to extracting markers from lyrics if available
    return extractLyricsMarkers(latestLyricsText, displayDuration);
  }, [displayDuration, latestLyricsText, playerClip?.practiceMarkers]);
  const activePracticeMarker = useMemo(
    () => findActiveMarker(practiceMarkers, playerPosition),
    [playerPosition, practiceMarkers]
  );
  const practiceLoopSelection = useMemo(
    () => [
      {
        id: "practice-loop",
        start: practiceLoopRange.start,
        end: practiceLoopRange.end,
        type: "keep" as const,
      },
    ],
    [practiceLoopRange.end, practiceLoopRange.start]
  );
  const clipNotes = playerClip?.notes ?? "";
  const clipNotesSummary = getNoteSummary(clipNotes);
  const hasValidPracticeLoop = practiceLoopRange.end > practiceLoopRange.start;

  function isWithinPracticeLoop(timeMs: number) {
    return hasValidPracticeLoop && timeMs >= practiceLoopRange.start && timeMs < practiceLoopRange.end;
  }

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
    setPracticeLoopRange(buildDefaultLoopRegion(displayDuration));
  }, [displayDuration, playerClip?.id]);

  useEffect(() => {
    setLoopPlaybackEngaged(false);
  }, [mode, playerClip?.id, practiceLoopEnabled, practiceLoopRange.end, practiceLoopRange.start]);

  useEffect(() => {
    setPlaybackRate(playbackSpeed);
  }, [playbackSpeed, setPlaybackRate]);

  useEffect(() => {
    if (Math.abs(playbackRate - playbackSpeed) < 0.001) return;
    setPlaybackSpeed(playbackRate);
  }, [playbackRate]);

  useEffect(() => {
    if (mode !== "practice" || !practiceLoopEnabled || !isPlayerPlaying || transportScrub.isScrubbing) {
      return;
    }
    if (!hasValidPracticeLoop) {
      return;
    }
    if (!loopPlaybackEngaged) {
      if (isWithinPracticeLoop(playerPosition)) {
        setLoopPlaybackEngaged(true);
      }
      return;
    }
    if (playerPosition < practiceLoopRange.start) {
      setLoopPlaybackEngaged(false);
      return;
    }
    if (playerPosition < practiceLoopRange.end - 40 || loopSeekLockRef.current) {
      return;
    }

    loopSeekLockRef.current = true;
    void seekTo(practiceLoopRange.start).finally(() => {
      setTimeout(() => {
        loopSeekLockRef.current = false;
      }, 50);
    });
  }, [
    isPlayerPlaying,
    isWithinPracticeLoop,
    loopPlaybackEngaged,
    mode,
    hasValidPracticeLoop,
    playerPosition,
    practiceLoopEnabled,
    practiceLoopRange.end,
    practiceLoopRange.start,
    seekTo,
    transportScrub.isScrubbing,
  ]);

  useEffect(() => {
    if (playerToggleRequestToken === handledToggleTokenRef.current) return;
    handledToggleTokenRef.current = playerToggleRequestToken;
    void handleTransportToggle();
  }, [playerToggleRequestToken, isPlayerPlaying, mode, practiceLoopEnabled, hasValidPracticeLoop, playerPosition, practiceLoopRange.start]);

  useEffect(() => {
    if (playerCloseRequestToken === handledCloseTokenRef.current) return;
    handledCloseTokenRef.current = playerCloseRequestToken;
    void cancelScrub();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
  }, [cancelScrub, closePlayer, playerCloseRequestToken]);

  function handleBack() {
    void closePlayer();
    useStore.getState().clearPlayerQueue();
    navigation.goBack();
  }

  function handleScrubStateChange(scrubbing: boolean) {
    if (scrubbing) {
      void beginScrub();
      return;
    }
    void endScrub();
  }

  async function handleLoopAwareSeek(targetMs: number) {
    if (mode === "practice" && practiceLoopEnabled) {
      if (isPlayerPlaying) {
        setLoopPlaybackEngaged(isWithinPracticeLoop(targetMs));
      } else {
        setLoopPlaybackEngaged(false);
      }
    }
    await scrubTo(targetMs);
  }

  function handlePracticeLoopToggle() {
    setPracticeLoopEnabled((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue) {
        setPracticeLoopRange(buildDefaultLoopRegion(displayDuration, playerPosition));
        setLoopPlaybackEngaged(isPlayerPlaying);
      } else {
        setLoopPlaybackEngaged(false);
      }
      return nextValue;
    });
  }

  async function handleTransportToggle() {
    if (isPlayerPlaying) {
      await pausePlayer();
      return;
    }
    if (mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop) {
      setLoopPlaybackEngaged(true);
      if (Math.abs(playerPosition - practiceLoopRange.start) > 20) {
        await seekTo(practiceLoopRange.start);
      }
      await playPlayer();
      return;
    }
    await playPlayer();
  }

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

  function handleAddPin() {
    const label = newPinLabel.trim();
    if (!label || !playerIdea || !playerClip || !activeWorkspaceId) return;

    const newMarker: PracticeMarker = {
      id: `pin-${Date.now()}`,
      label,
      atMs: playerPosition,
    };

    useStore.getState().addClipPracticeMarker(playerIdea.id, playerClip.id, newMarker);
    setNewPinLabel("");
  }

  function handleDeletePin(markerId: string) {
    if (!playerIdea || !playerClip || !activeWorkspaceId) return;
    useStore.getState().removeClipPracticeMarker(playerIdea.id, playerClip.id, markerId);
  }

  function handleOverflowMenu() {
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
          (navigation as any).navigate("Editor", {
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
  }

  if (!playerIdea || !playerClip) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.subtitle}>Loading player…</Text>
      </SafeAreaView>
    );
  }

  const breadcrumbItems =
    activeWorkspace && playerCollection
      ? [
          {
            key: "home",
            label: "Home",
            level: "home" as const,
            iconOnly: true,
            onPress: () => (navigation as any).navigate("Home", { screen: "Workspaces" }),
          },
          {
            key: `workspace-${activeWorkspace.id}`,
            label: activeWorkspace.title,
            level: "workspace" as const,
            onPress: () => (navigation as any).navigate("Home", { screen: "Browse" }),
          },
          ...playerCollectionAncestors.map((collection) => ({
            key: collection.id,
            label: collection.title,
            level: getCollectionHierarchyLevel(collection),
            onPress: () =>
              openCollectionFromContext(navigation, {
                collectionId: collection.id,
                source: "detail",
              }),
          })),
          {
            key: playerCollection.id,
            label: playerCollection.title,
            level: getCollectionHierarchyLevel(playerCollection),
            onPress: () =>
              openCollectionFromContext(navigation, {
                collectionId: playerCollection.id,
                source: "detail",
              }),
            active: true,
          },
        ]
      : [];

  const practiceRangeLabel =
    practiceLoopRange.end > practiceLoopRange.start
      ? `${fmtDuration(practiceLoopRange.start)} → ${fmtDuration(practiceLoopRange.end)}`
      : "No loop";

  return (
    <SafeAreaView style={[styles.screen, screenStyles.screen]}>
      <TransportLayout
        scrollable
        header={
          <View style={screenStyles.headerBlock}>
            <View style={screenStyles.navRow}>
              <Pressable style={({ pressed }) => [styles.backBtn, pressed ? styles.pressDown : null]} onPress={handleBack}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  screenStyles.overflowButton,
                  pressed ? screenStyles.overflowButtonPressed : null,
                ]}
                onPress={handleOverflowMenu}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#111827" />
              </Pressable>
            </View>

            {breadcrumbItems.length > 0 ? (
              <AppBreadcrumbs items={breadcrumbItems} containerStyle={screenStyles.breadcrumbs} />
            ) : null}

            <View style={screenStyles.titleBlock}>
              <Text style={screenStyles.title}>{playerIdea.title}</Text>
              <View style={screenStyles.metaRow}>
                <Text style={screenStyles.metaText}>{playerClip.isPrimary ? "Main take" : "Clip"}</Text>
                <Text style={screenStyles.metaDot}>•</Text>
                <Text style={screenStyles.metaText}>{formatDate(playerClip.createdAt)}</Text>
                <View style={screenStyles.metaSpacer} />
                <Text style={screenStyles.timingText}>
                  {fmtDuration(playerPosition)} / {fmtDuration(displayDuration)}
                </Text>
              </View>
            </View>

            <SegmentedControl
              options={[
                { key: "player", label: "Player" },
                { key: "practice", label: "Practice" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </View>
        }
        footer={
          <PlayerTransportDock
            isPlaying={isPlayerPlaying}
            canGoPrevious={hasPreviousTrack}
            canGoNext={hasNextTrack}
            onPrevious={() => useStore.getState().advancePlayerQueue("previous", true)}
            onTogglePlay={() => {
              void handleTransportToggle();
            }}
            onNext={() => useStore.getState().advancePlayerQueue("next", true)}
            trailingIcon={mode === "practice" ? "repeat" : queueEntries.length > 1 ? "list-outline" : undefined}
            trailingActive={mode === "practice" ? practiceLoopEnabled : queueExpanded}
            trailingDisabled={mode === "practice" ? false : queueEntries.length <= 1}
            onTrailingPress={
              mode === "practice"
                ? handlePracticeLoopToggle
                : queueEntries.length > 1
                  ? () => setQueueExpanded((value) => !value)
                  : undefined
            }
            speedBadge={mode === "practice" && Math.abs(playbackSpeed - 1) > 0.001 ? `${playbackSpeed}x` : undefined}
          />
        }
      >
        <View style={screenStyles.content}>
          <View style={screenStyles.waveformSection}>
            <PlayerControls
              playerPosition={playerPosition}
              playerDuration={displayDuration}
              waveformPeaks={waveformPeaks}
              isPlayerPlaying={isPlayerPlaying}
              isScrubbing={transportScrub.isScrubbing}
              chrome="light"
              showTransportControls={false}
              showExpandToggle={false}
              showZoomControls={mode === "practice"}
              showTimingRow={false}
              defaultExpanded={false}
              surfaceRadius={26}
              timelineHorizontalPadding={10}
              collapsedHeightOverride={mode === "practice" ? 148 : 168}
              showMinimapMode={mode === "practice" ? "auto" : "never"}
              selectedRanges={mode === "practice" && practiceLoopEnabled ? practiceLoopSelection : undefined}
              renderOverlay={
                mode === "practice"
                  ? ({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress }) => (
                      <View style={{ flex: 1, position: "relative" }}>
                        {practiceLoopEnabled ? (
                          <MultiTimeRangeSelector
                            durationMs={displayDuration}
                            pixelsPerMs={pixelsPerMs}
                            regions={practiceLoopSelection}
                            onRegionChange={(_, start, end) => setPracticeLoopRange({ start, end })}
                            sharedTranslateX={timelineTranslateX}
                            sharedScale={timelineScale}
                            sharedAudioProgress={sharedAudioProgress}
                            onScrubStateChange={handleScrubStateChange}
                            onSeek={(timeMs) => void handleLoopAwareSeek(timeMs)}
                          />
                        ) : null}
                        {practiceMarkers.map((marker) => {
                          const baseMarkerPosX = marker.atMs * pixelsPerMs;
                          const markerPosX = baseMarkerPosX * timelineScale.value + timelineTranslateX.value;
                          return (
                            <Pressable
                              key={`waveform-pin-${marker.id}`}
                              style={{
                                position: "absolute",
                                left: markerPosX - 6,
                                top: 0,
                                bottom: 0,
                                width: 12,
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                              onPress={() => void handleLoopAwareSeek(marker.atMs)}
                              hitSlop={8}
                            >
                              <View
                                style={{
                                  width: 2,
                                  height: "100%",
                                  backgroundColor: "#ca8a04",
                                }}
                              />
                            </Pressable>
                          );
                        })}
                      </View>
                    )
                  : undefined
              }
              onSeekTo={handleLoopAwareSeek}
              onTogglePlay={() => {
                void handleTransportToggle();
              }}
              onScrubStateChange={handleScrubStateChange}
            />
          </View>

          {mode === "practice" ? (
            <View style={screenStyles.practiceContent}>
              <View style={screenStyles.practiceCard}>
                <View style={screenStyles.practiceRow}>
                  <Text style={screenStyles.practiceLabel}>Loop</Text>
                  <View style={screenStyles.practiceValueRow}>
                    {practiceLoopEnabled ? (
                      <>
                        <View style={screenStyles.valuePill}>
                          <Text style={screenStyles.valuePillText}>{practiceRangeLabel}</Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [
                            screenStyles.resetButton,
                            pressed ? { opacity: 0.7 } : null,
                          ]}
                          onPress={() => {
                            setPracticeLoopRange(buildDefaultLoopRegion(displayDuration, playerPosition));
                            setLoopPlaybackEngaged(isPlayerPlaying);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="refresh" size={14} color="#6b7280" />
                        </Pressable>
                      </>
                    ) : null}
                    <Pressable
                      style={[
                        screenStyles.toggleShell,
                        practiceLoopEnabled ? screenStyles.toggleShellActive : null,
                      ]}
                      onPress={handlePracticeLoopToggle}
                    >
                      <View style={[screenStyles.toggleKnob, practiceLoopEnabled ? screenStyles.toggleKnobActive : null]} />
                    </Pressable>
                  </View>
                </View>

                <View style={screenStyles.divider} />

                <View style={screenStyles.practiceRow}>
                  <Text style={screenStyles.practiceLabel}>Speed</Text>
                  <View style={screenStyles.optionGroup}>
                    {PRACTICE_SPEED_OPTIONS.map((speed) => {
                      const active = Math.abs(playbackSpeed - speed) < 0.001;
                      return (
                        <Pressable
                          key={speed}
                          style={[screenStyles.optionChip, active ? screenStyles.optionChipActive : null]}
                          onPress={() => setPlaybackSpeed(speed)}
                        >
                          <Text style={[screenStyles.optionChipText, active ? screenStyles.optionChipTextActive : null]}>
                            {speed}x
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={screenStyles.divider} />

                <View style={screenStyles.practiceRow}>
                  <Text style={screenStyles.practiceLabel}>Count-in</Text>
                  <View style={screenStyles.optionGroup}>
                    {[
                      { key: "off" as const, label: "Off" },
                      { key: "1b" as const, label: "1b" },
                      { key: "2b" as const, label: "2b" },
                    ].map((option) => {
                      const active = countInOption === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          style={[screenStyles.optionChip, active ? screenStyles.optionChipActive : null]}
                          onPress={() => setCountInOption(option.key)}
                        >
                          <Text style={[screenStyles.optionChipText, active ? screenStyles.optionChipTextActive : null]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

              </View>

              <View style={screenStyles.pinsSection}>
                <View style={screenStyles.pinsSectionHeader}>
                  <Ionicons name="pin" size={16} color="#ca8a04" />
                  <Text style={screenStyles.pinsSectionTitle}>Pins</Text>
                </View>
                <View style={screenStyles.pinsBadgesRow}>
                  {practiceMarkers.map((marker) => (
                    <Pressable
                      key={`pin-badge-${marker.id}`}
                      style={screenStyles.pinBadge}
                      onPress={() => void handleLoopAwareSeek(marker.atMs)}
                      onLongPress={() => handleDeletePin(marker.id)}
                    >
                      <Text style={screenStyles.pinBadgeText}>{marker.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={screenStyles.addPinRow}>
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.addPinInput,
                      pressed ? { opacity: 0.7 } : null,
                    ]}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#ca8a04" />
                  </Pressable>
                  <TextInput
                    style={screenStyles.pinInputField}
                    placeholder="New pin name"
                    placeholderTextColor="#94a3b8"
                    value={newPinLabel}
                    onChangeText={setNewPinLabel}
                    onSubmitEditing={handleAddPin}
                    returnKeyType="done"
                  />
                  <Pressable
                    style={({ pressed }) => [
                      screenStyles.pinSaveButton,
                      !newPinLabel.trim() ? screenStyles.pinSaveButtonDisabled : null,
                      pressed ? { opacity: 0.7 } : null,
                    ]}
                    onPress={handleAddPin}
                    disabled={!newPinLabel.trim()}
                  >
                    <Text
                      style={[
                        screenStyles.pinSaveButtonText,
                        !newPinLabel.trim() ? screenStyles.pinSaveButtonTextDisabled : null,
                      ]}
                    >
                      Save
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={screenStyles.notesBox}>
                <Text style={screenStyles.notesBoxTitle}>Practice notes</Text>
                <Text style={[screenStyles.notesBoxText, !clipNotes.trim() ? screenStyles.notesBoxPlaceholder : null]}>
                  {clipNotes.trim() || "Practice annotations will reuse clip notes here until dedicated practice notes are added."}
                </Text>
              </View>
            </View>
          ) : (
            <View style={screenStyles.supportStack}>
              {hasProjectLyrics && latestLyricsVersion ? (
                <PlayerLyricsPanel
                  text={latestLyricsText}
                  versionLabel={`Version ${playerIdea.lyrics?.versions.length ?? 1}`}
                  updatedAtLabel={formatDate(latestLyricsVersion.updatedAt)}
                  autoscrollState={lyricsAutoscrollState}
                  defaultExpanded={false}
                  expanded={lyricsExpanded}
                  onToggleExpanded={setLyricsExpanded}
                />
              ) : null}

              <PlayerSupportPanel
                title="Clip notes"
                meta={clipNotes.trim() ? "Attached to this take" : "No notes saved"}
                summary={clipNotesSummary}
                expanded={notesExpanded}
                onToggleExpanded={setNotesExpanded}
              >
                <Text style={[screenStyles.notesText, !clipNotes.trim() ? screenStyles.notesPlaceholder : null]}>
                  {clipNotes.trim() || "This clip does not have notes yet."}
                </Text>
              </PlayerSupportPanel>

              {queueEntries.length > 1 ? (
                <PlayerSupportPanel
                  title="Queue"
                  meta={`${queueEntries.length} clips`}
                  summary={`${queueEntries.length} clips lined up for playback.`}
                  expanded={queueExpanded}
                  onToggleExpanded={setQueueExpanded}
                >
                  <PlayerQueue
                    entries={queueEntries}
                    currentClipId={playerClip.id}
                    compact={hasProjectLyrics}
                    onSelect={(index) => {
                      useStore.getState().setPlayerQueue(playerQueue, index, true);
                    }}
                  />
                </PlayerSupportPanel>
              ) : null}
            </View>
          )}
        </View>
      </TransportLayout>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  screen: {
    backgroundColor: "#f8f8f7",
  },
  headerBlock: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overflowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e4ea",
    backgroundColor: "#f8f8f7",
  },
  overflowButtonPressed: {
    opacity: 0.8,
  },
  breadcrumbs: {
    marginTop: 0,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: "#05070b",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#6b7280",
  },
  metaDot: {
    fontSize: 12,
    lineHeight: 16,
    color: "#9ca3af",
  },
  metaSpacer: {
    flexGrow: 1,
  },
  timingText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#111827",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  waveformSection: {
    gap: 6,
  },
  supportStack: {
    gap: 8,
    flexShrink: 1,
  },
  practiceContent: {
    gap: 8,
    flexShrink: 1,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1f2937",
  },
  notesPlaceholder: {
    color: "#8a93a1",
  },
  practiceCard: {
    backgroundColor: "#f6f7f9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e3e6eb",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  practiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
  },
  practiceLabel: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
    color: "#111827",
  },
  practiceValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resetButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eceef2",
  },
  toggleShell: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e5e7eb",
    padding: 3,
    justifyContent: "center",
  },
  toggleShellActive: {
    backgroundColor: "#dbeafe",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#64748b",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  valuePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#eceef2",
  },
  valuePillText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  optionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  optionChip: {
    minWidth: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#eceef2",
  },
  optionChipActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8dde6",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  optionChipText: {
    fontSize: 14,
    lineHeight: 16,
    color: "#374151",
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: "#111827",
  },
  pinsSection: {
    gap: 8,
  },
  pinsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pinsSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  pinsBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pinBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
  },
  pinBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#b45309",
  },
  addPinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addPinInput: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pinInputField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    fontSize: 14,
    color: "#111827",
  },
  pinSaveButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ca8a04",
  },
  pinSaveButtonDisabled: {
    backgroundColor: "#e2e8f0",
  },
  pinSaveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  pinSaveButtonTextDisabled: {
    color: "#94a3b8",
  },
  notesBox: {
    backgroundColor: "#f6f7f9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e3e6eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  notesBoxTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#111827",
  },
  notesBoxText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#374151",
  },
  notesBoxPlaceholder: {
    color: "#9aa3af",
  },
});
