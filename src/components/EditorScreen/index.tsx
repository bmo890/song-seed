import React, { useCallback, useEffect, useMemo, useState } from "react";
import { colors, radii } from "../../design/tokens";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, ActivityIndicator, TouchableOpacity, Pressable, StyleSheet } from "react-native";
import { StackActions, useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAudioPlayer } from "expo-audio";
import { useThrottledAudioPlayerStatus } from "../../hooks/useThrottledAudioPlayerStatus";
import { MultiTimeRangeSelector } from "../common/TimeRangeSelector";
import { AudioAnalysis } from "@siteed/audio-studio";
import { styles } from "../../styles";
import { RootStackParamList } from "../../navigation";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { Button } from "../common/Button";
import { AudioReel } from "../common/AudioReel";
import { useClipWaveform } from "../../hooks/useClipWaveform";
import { loadAudioDurationMs } from "../../services/audioStorage";
import { activatePlaybackAudioSession } from "../../services/audioSession";
import { getCollectionById } from "../../utils";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { useTransportClock } from "../../hooks/useTransportClock";
import { isPlaybackNearEnd } from "../../services/transportPlayback";
import { buildFallbackAnalysis } from "./helpers";
import { useEditorSelectionState } from "./hooks/useEditorSelectionState";
import { EditorHeaderSection } from "./components/EditorHeaderSection";
import { EditorFooterSection } from "./components/EditorFooterSection";
import { EditorTrimIntent } from "./components/EditorTrimIntent";
import { SegmentedControl } from "../common/SegmentedControl";
import { EditorSelectionList } from "./components/EditorSelectionList";
import { EditorExportProgressModal } from "./components/EditorExportProgressModal";
import { EditorSaveSheet } from "./components/EditorSaveSheet";
import { AppAlert } from "../common/AppAlert";
import { haptic } from "../../design/haptics";
import { useEditorExportFlow } from "./hooks/useEditorExportFlow";
import { useEditorTransformState } from "./hooks/useEditorTransformState";
import { useEditorPreviewTransport } from "./hooks/useEditorPreviewTransport";
import { EditorTransformSection } from "./components/EditorTransformSection";
import { EditorTransformExportModal } from "./components/EditorTransformExportModal";
import { clipHasOverdubs, isClipWaveformPending } from "../../domain/clipPresentation";
import { HelpSheet } from "../common/HelpSheet";
import { EDITOR_HELP } from "../common/helpContent";
import { useTranslation } from "react-i18next";
import { MarkInspector, nudgeStepMsForZoom } from "../common/MarkInspector";
import { complementSpans, remapClipForSpans } from "../../domain/clipEditRemap";
import { fmtDuration } from "../../utils";
import { canSnapToGrid, snapResolutionForZoom, snapToGrid } from "../../domain/editSnap";
import { MIN_REGION_DURATION_MS } from "./helpers";

type Props = NativeStackScreenProps<RootStackParamList, "Editor">;

/** Tagged, greppable editor diagnostics — filter logs by "[editor]". */
const editorLog = (...args: unknown[]) => console.log("[editor]", ...args);

const editorLocalStyles = StyleSheet.create({
    regionsHead: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 4,
    },
    regionsLabel: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: colors.textSecondary,
    },
    addLink: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        color: colors.primary,
    },
    overdubGate: {
        gap: 20,
        paddingTop: 40,
        paddingHorizontal: 16,
        alignItems: "center",
    },
    overdubGateIconRing: {
        width: 56,
        height: 56,
        borderRadius: radii.round,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySurface,
    },
    overdubGateTitle: {
        fontFamily: "Lora_600SemiBold",
        fontSize: 24,
        lineHeight: 30,
        color: colors.textPrimary,
        textAlign: "center",
    },
    overdubGateBody: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 14,
        lineHeight: 21,
        color: colors.textSecondary,
        textAlign: "center",
    },
    inspectorWrap: {
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 10,
        borderRadius: radii.lg,
        backgroundColor: colors.surfaceContainer,
    },
    loadingText: {
        marginTop: 12,
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 13,
        color: colors.textSecondary,
    },
});

export function EditorScreen() {
    const { t } = useTranslation();
    const editorModes = useMemo(() => [
        { key: "trim" as const, label: t("editor.trim") },
        { key: "transform" as const, label: t("editor.transform") },
    ], [t]);
    const navigation = useNavigation();
    const route = useRoute<Props["route"]>();
    const isFocused = useIsFocused();
    const { ideaId, clipId, audioUri, durationMs: routeDurationMs } = route.params;

    const [currentTime, setCurrentTime] = useState(0);
    const [analysisData, setAnalysisData] = useState<AudioAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFlatteningOverdub, setIsFlatteningOverdub] = useState(false);
    const [editorMode, setEditorMode] = useState<"trim" | "transform">("trim");
    const [helpVisible, setHelpVisible] = useState(false);
    /** Reel magnification, reported by the reel — it scales the inspector's nudge step
     *  and decides whether snapping lands on bars or beats. */
    const [zoomMultiple, setZoomMultiple] = useState(1);
    /** Edit to the bar grid, or reach freely (see domain/clipEditRemap GridPolicy).
     *  On by default wherever there is a grid to keep. */
    const [keepToGrid, setKeepToGrid] = useState(true);

    const updateIdeas = useStore((s) => s.updateIdeas);
    const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
    const markRecentlyAdded = useStore((s) => s.markRecentlyAdded);
    const workspaces = useStore((s) => s.workspaces);
    const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
    // Derive workspace/idea objects outside the zustand selector so the editor cannot produce a
    // brand-new object during hydration and accidentally trigger a destructive persist write.
    const activeWorkspace = useMemo(
        () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
        [activeWorkspaceId, workspaces]
    );
    const targetIdea = useMemo(
        () => activeWorkspace?.ideas.find((idea) => idea.id === ideaId) ?? null,
        [activeWorkspace, ideaId]
    );
    const sourceClip = targetIdea?.clips.find((clip) => clip.id === clipId) ?? null;
    const sourceClipHasOverdubs = !!sourceClip && clipHasOverdubs(sourceClip);
    const targetCollection =
        targetIdea && activeWorkspace ? getCollectionById(activeWorkspace, targetIdea.collectionId) : null;
    const durationHintMs = routeDurationMs ?? sourceClip?.durationMs;

    // High-resolution detail waveform (sidecar), with the clip's stored inline
    // thumbnail as the fallback until it loads. This is the single source for the
    // reel — keeps it crisp to max zoom and avoids a second decode on open.
    const clipWaveform = useClipWaveform({
        audioUri,
        thumbnailPeaks: sourceClip?.waveformPeaks,
        durationMs: durationHintMs,
        enabled: isFocused,
    });

    // Synthetic peaks until background analysis lands — the reel draws its honest
    // pending line rather than a fake wave. The sidecar loading (isDetail) means real
    // peaks are on screen, which clears pending regardless of the clip's stored state.
    const waveformPending = sourceClip ? isClipWaveformPending(sourceClip) && !clipWaveform.isDetail : false;

    const playerSource = useMemo(() => (audioUri ? { uri: audioUri } : null), [audioUri]);
    const playerOptions = useMemo(() => ({ updateInterval: 33 }), []);
    const player = useAudioPlayer(playerSource, playerOptions);
    // Throttled: the stock status hook re-rendered this whole screen 30×/sec during
    // playback. Smooth reel motion comes from the shared transport clock, which only
    // needs periodic position reports.
    const { status } = useThrottledAudioPlayerStatus(player, { positionIntervalMs: 200 });
    const statusTimeMs = typeof status.currentTime === "number" ? Math.round(status.currentTime * 1000) : null;
    const transformState = useEditorTransformState();
    useEffect(() => {
        activatePlaybackAudioSession().catch((error) => {
            console.warn("Editor audio mode setup failed", error);
        });
    }, []);

    const safePause = useCallback(async () => {
        try {
            if (player) {
                await player.pause();
            }
        } catch (e) {
            console.warn("Safe pause error:", e);
        }
    }, [player]);

    const safePlay = useCallback(async () => {
        try {
            if (player) {
                await player.play();
            }
        } catch (e) {
            console.warn("Safe play error:", e);
        }
    }, [player]);

    const setPlayerPlaybackRate = useCallback(
        (rate: number) => {
            try {
                player.setPlaybackRate(rate);
            } catch (error) {
                console.warn("Editor playback rate update failed", error);
            }
        },
        [player]
    );

    const previewTransport = useEditorPreviewTransport({
        isFocused,
        audioUri,
        playbackRate: transformState.playbackRate,
        pitchShiftSemitones: transformState.pitchShiftSemitones,
        sourcePositionMs: statusTimeMs ?? currentTime,
        sourceDurationMs: analysisData?.durationMs ?? durationHintMs ?? 0,
        sourceIsPlaying: !!status.playing,
        pauseSource: safePause,
        playSource: safePlay,
        seekSourceTo: async (timeMs) => {
            setCurrentTime((prev) => (prev === timeMs ? prev : timeMs));
            await player.seekTo(timeMs / 1000);
        },
        setSourcePlaybackRate: setPlayerPlaybackRate,
    });
    const transportClock = useTransportClock({
        positionMs: previewTransport.effectivePositionMs ?? currentTime,
        durationMs: previewTransport.effectiveDurationMs,
        isPlaying: previewTransport.effectiveIsPlaying,
        playbackRate: previewTransport.effectivePlaybackRate,
        resetKey: clipId,
        resetPositionMs: 0,
    });

    const transportScrub = useTransportScrubbing({
        isPlaying: previewTransport.effectiveIsPlaying,
        durationMs: previewTransport.effectiveDurationMs,
        pause: previewTransport.pause,
        play: previewTransport.play,
        seekTo: async (timeMs) => {
            setCurrentTime((prev) => (prev === timeMs ? prev : timeMs));
            transportClock.setDisplayPositionMs(timeMs);
            await previewTransport.seekTo(timeMs);
        },
    });
    const playheadTimeMs = transportScrub.isScrubbing
        ? currentTime
        : previewTransport.effectivePositionMs ?? currentTime;
    const {
        selectedRanges,
        setSelectedRanges,
        selectedRange,
        selectedRangeId,
        selectedEdge,
        selectRange,
        setSelectedEdge,
        editMode,
        setIntent,
        keepRegions,
        removeRegions,
        addRange,
        removeRange,
        renameRange,
    } = useEditorSelectionState({
        analysisDurationMs: analysisData?.durationMs ?? null,
        playheadTimeMs,
    });

    const gridForSnap = keepToGrid ? sourceClip?.recordingGrid : null;
    const gridAvailable = canSnapToGrid(sourceClip?.recordingGrid);
    const editDurationMs = analysisData?.durationMs ?? 0;

    /** Every edge move goes through here, wherever it came from — dragging on the reel,
     *  the inspector slider, or use-playhead. The nudge carets deliberately do not, so
     *  they stay a surgical escape from the grid. */
    const snapEdge = useCallback(
        (timeMs: number) =>
            snapToGrid({
                timeMs,
                grid: gridForSnap,
                zoomMultiple,
                durationMs: editDurationMs,
            }),
        [gridForSnap, zoomMultiple, editDurationMs]
    );

    const applyEdge = useCallback(
        (rangeId: string, edge: "start" | "end", timeMs: number) => {
            setSelectedRanges((prev) =>
                prev.map((range) => {
                    if (range.id !== rangeId) return range;
                    if (edge === "start") {
                        return { ...range, start: Math.min(timeMs, range.end - MIN_REGION_DURATION_MS) };
                    }
                    return { ...range, end: Math.max(timeMs, range.start + MIN_REGION_DURATION_MS) };
                })
            );
        },
        [setSelectedRanges]
    );

    /** What the pending edit will do to the take's grid — the same pure remap the save
     *  itself runs, so the line can never disagree with the result. */
    const gridOutcomeLine = useMemo(() => {
        if (!sourceClip?.recordingGrid || !analysisData || editorMode !== "trim") return null;
        const spans =
            editMode === "keep"
                ? keepRegions.map((region) => ({ startMs: region.start, endMs: region.end }))
                : complementSpans(
                      removeRegions.map((region) => ({ startMs: region.start, endMs: region.end })),
                      analysisData.durationMs
                  );
        if (spans.length === 0) return null;
        const { gridOutcome } = remapClipForSpans(sourceClip, spans, analysisData.durationMs, {
            gridPolicy: keepToGrid ? "preserve" : "free",
        });
        if (gridOutcome.kind === "none") return null;
        if (gridOutcome.kind === "kept") return t("editor.gridKept");
        if (gridOutcome.kind === "partial") {
            return t("editor.gridKeptTo", { time: fmtDuration(gridOutcome.validToMs) });
        }
        return t("editor.gridNone");
    }, [
        analysisData,
        editMode,
        editorMode,
        keepRegions,
        keepToGrid,
        removeRegions,
        sourceClip,
        t,
    ]);

    const togglePlay = () => {
        if (previewTransport.effectiveIsPlaying) {
            editorLog("togglePlay → pause", { positionMs: playheadTimeMs });
            void previewTransport.pause();
        } else if (
            selectedRange &&
            (playheadTimeMs < selectedRange.start || playheadTimeMs >= selectedRange.end - 1)
        ) {
            // A part is selected, so play means "play this part".
            editorLog("togglePlay → play part", { rangeId: selectedRange.id });
            transportClock.setDisplayPositionMs(selectedRange.start);
            setCurrentTime(selectedRange.start);
            void transportScrub.seekAndSettle(selectedRange.start).then(() => previewTransport.play());
        } else {
            const atEnd = isPlaybackNearEnd(playheadTimeMs, previewTransport.effectiveDurationMs);
            editorLog("togglePlay → play", { positionMs: playheadTimeMs, atEnd });
            if (atEnd) {
                transportClock.setDisplayPositionMs(0);
                setCurrentTime(0);
            }
            void previewTransport.play();
        }
    };
    useEffect(() => {
        if (!selectedRange || !previewTransport.effectiveIsPlaying) return;
        if (playheadTimeMs < selectedRange.end) return;
        void Promise.resolve(previewTransport.pause()).catch((error) => {
            console.warn("[editor] part preview stop failed", error);
        });
    }, [playheadTimeMs, previewTransport, selectedRange]);

    const exportFlow = useEditorExportFlow({
        ideaId,
        clipId,
        audioUri,
        analysisData,
        targetIdea,
        sourceClip,
        keepRegions,
        removeRegions,
        gridPolicy: keepToGrid ? "preserve" : "free",
        transformPitchShiftSemitones: transformState.pitchShiftSemitones,
        transformPlaybackRate: transformState.playbackRate,
        hasActiveTransforms: transformState.hasActiveTransforms,
        playheadTimeMs,
        player: {
            seekTo: async (seconds: number) => {
                await previewTransport.seekTo(seconds * 1000);
            },
            play: previewTransport.play,
            pause: previewTransport.pause,
        },
        navigation,
        updateIdeas,
        setSelectedIdeaId,
        markRecentlyAdded,
        safePause: previewTransport.pause,
        setCurrentTime,
    });

    useEffect(() => {
        if (sourceClipHasOverdubs) {
            setIsLoading(false);
            return;
        }
        if (!audioUri) return;
        const editorAudioUri = audioUri;
        let isMounted = true;

        async function loadAudioData() {
            editorLog("load: start", { clipId, audioUri: editorAudioUri });
            setIsLoading(true);
            try {
                // The reel waveform is supplied by the detail sidecar (useClipWaveform);
                // here we only need the clip duration for the trim timeline + transport.
                // No decode on load — just a fast metadata read when no hint is provided.
                const resolvedDurationMs =
                    durationHintMs && durationHintMs > 0 ? durationHintMs : await loadAudioDurationMs(editorAudioUri);
                editorLog("load: resolved duration", resolvedDurationMs);
                if (!resolvedDurationMs || resolvedDurationMs <= 0) {
                    throw new Error(t("editor.durationUnavailable"));
                }
                if (isMounted) {
                    setAnalysisData(buildFallbackAnalysis(resolvedDurationMs));
                    setCurrentTime(0);
                    player.seekTo(0);
                }
            } catch (err) {
                console.error("Failed to prepare audio editor", err);
                if (isMounted) {
                    AppAlert.info(t("editor.editUnavailable"), t("editor.loadFailed"));
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadAudioData();
        return () => { isMounted = false; };
        // durationHintMs is read fresh when the clip changes; intentionally not a
        // dependency so a background clip update (e.g. waveform hydration) cannot
        // re-trigger a load and reset the playhead mid-edit.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioUri, clipId, sourceClipHasOverdubs, player]);

    const handleFlattenOverdubAndContinue = useCallback(async () => {
        if (!targetIdea || !sourceClip) return;

        editorLog("flatten overdub: start", { ideaId: targetIdea.id, clipId: sourceClip.id });
        setIsFlatteningOverdub(true);
        try {
            const savedTarget = await appActions.saveCombinedClipAsNewClip(targetIdea.id, sourceClip.id);
            if (!savedTarget) {
                throw new Error(t("editor.combinedCouldNotSave"));
            }
            editorLog("flatten overdub: saved combined", savedTarget);

            const savedIdea = useStore
                .getState()
                .workspaces.flatMap((workspace) => workspace.ideas)
                .find((idea) => idea.id === savedTarget.ideaId);
            const savedClip = savedIdea?.clips.find((clip) => clip.id === savedTarget.clipId) ?? null;
            if (!savedIdea || !savedClip?.audioUri) {
                throw new Error(t("editor.combinedCouldNotOpen"));
            }

            navigation.dispatch(
                StackActions.replace("Editor", {
                    ideaId: savedIdea.id,
                    clipId: savedClip.id,
                    audioUri: savedClip.audioUri,
                    durationMs: savedClip.durationMs,
                })
            );
        } catch (error) {
            console.warn("[editor] flatten overdub failed", error);
            AppAlert.info(
                t("editor.saveCombinedFailed"),
                error instanceof Error ? error.message : t("editor.combinedFailedBody")
            );
        } finally {
            setIsFlatteningOverdub(false);
        }
    }, [navigation, sourceClip, t, targetIdea]);


    return (
        <SafeAreaView style={styles.screen}>
            <TransportLayout
                header={
                    <EditorHeaderSection
                        sourceClip={sourceClip}
                        positionMs={playheadTimeMs}
                        durationMs={analysisData?.durationMs ?? null}
                        onBack={() => {
                            void previewTransport.pause();
                            navigation.goBack();
                        }}
                        onHelp={() => setHelpVisible(true)}
                    />
                }
                footer={
                    analysisData ? (
                        <EditorFooterSection
                            editorMode={editorMode}
                            intent={editMode}
                            keepCount={keepRegions.length}
                            removeCount={removeRegions.length}
                            hasActiveTransforms={transformState.hasActiveTransforms}
                            onExport={exportFlow.openExportModal}
                            onSaveTransform={exportFlow.openTransformExportModal}
                        />
                    ) : null
                }
                scrollable
            >
                {sourceClipHasOverdubs ? (
                    <View style={editorLocalStyles.overdubGate}>
                        <View style={editorLocalStyles.overdubGateIconRing}>
                            <Ionicons name="layers-outline" size={26} color={colors.primary} />
                        </View>
                        <View style={{ gap: 8 }}>
                            <Text style={editorLocalStyles.overdubGateTitle}>
                                {t("editor.flattenFirst")}
                            </Text>
                            <Text style={editorLocalStyles.overdubGateBody}>
                                {t("editor.flattenReason")}
                            </Text>
                        </View>

                        <Button
                            label={isFlatteningOverdub ? t("editor.savingCombined") : t("editor.saveCombinedContinue")}
                            disabled={isFlatteningOverdub}
                            onPress={() => {
                                void handleFlattenOverdubAndContinue();
                            }}
                            style={{ alignSelf: "stretch" }}
                        />
                    </View>
                ) : isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={editorLocalStyles.loadingText}>{t("editor.analyzing")}</Text>
                    </View>
                ) : analysisData ? (
                    <>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                            <SegmentedControl
                                options={editorModes}
                                value={editorMode}
                                onChange={setEditorMode}
                            />
                        </View>

                        <AudioReel
                            waveformPeaks={clipWaveform.peaks}
                            waveformPending={waveformPending}
                            waveformAnalyzing={clipWaveform.isGenerating}
                            waveformResolving={clipWaveform.isResolvingDetail}
                            durationMs={analysisData.durationMs}
                            currentTimeMs={playheadTimeMs}
                            resetKey={clipId}
                            chrome="light"
                            // The player's reel arrangement, reached by configuration: zoom
                            // rides on the canvas instead of a pill row beneath it, and the
                            // time lives in the header rather than in two pills that read
                            // like an editable range.
                            zoomPlacement="overlay"
                            showTimingRow={false}
                            onZoomMultipleChange={setZoomMultiple}
                            sharedCurrentTimeMs={transportClock.sharedCurrentTimeMs}
                            sharedDurationMs={transportClock.sharedDurationMs}
                            sharedTransportUpdateToken={transportClock.sharedUpdateToken}
                            isPlaying={previewTransport.effectiveIsPlaying}
                            sharedIsPlaying={transportClock.sharedIsPlaying}
                            playbackRate={previewTransport.effectivePlaybackRate}
                            sharedPlaybackRate={transportClock.sharedPlaybackRate}
                            isScrubbing={transportScrub.isScrubbing}
                            onSeek={transportScrub.scrubTo}
                            onTogglePlay={togglePlay}
                            onSeekToStart={() => transportScrub.scrubTo(0)}
                            onSeekToEnd={() => transportScrub.scrubTo(analysisData.durationMs)}
                            onScrubStateChange={(scrubbing) => {
                                if (scrubbing) {
                                    void transportScrub.beginScrub();
                                    return;
                                }
                                void transportScrub.endScrub();
                            }}
                            selectedRanges={editorMode === "trim" ? selectedRanges : []}
                            renderOverlay={
                                editorMode === "trim"
                                    ? ({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress }) => (
                                          <MultiTimeRangeSelector
                                              durationMs={analysisData.durationMs}
                                              pixelsPerMs={pixelsPerMs}
                                              regions={selectedRanges}
                                              sharedTranslateX={timelineTranslateX}
                                              sharedScale={timelineScale}
                                              sharedAudioProgress={sharedAudioProgress}
                                              onScrubStateChange={(scrubbing) => {
                                                  if (scrubbing) {
                                                      void transportScrub.beginScrub();
                                                      return;
                                                  }
                                                  void transportScrub.endScrub();
                                              }}
                                              onSeek={(time) => {
                                                  setCurrentTime((prev) => (prev === time ? prev : time));
                                                  transportClock.setDisplayPositionMs(time);
                                                  return transportScrub.scrubTo(time);
                                              }}
                                              onRegionChange={(id, start, end) => {
                                                  setSelectedRanges((prev) =>
                                                      prev.map((r) => {
                                                          if (r.id !== id) return r;
                                                          // Snap only the edge that actually moved, so dragging the
                                                          // whole part does not quietly resize it.
                                                          const nextStart = start !== r.start ? snapEdge(start) : start;
                                                          const nextEnd = end !== r.end ? snapEdge(end) : end;
                                                          return { ...r, start: nextStart, end: nextEnd };
                                                      })
                                                  );
                                              }}
                                          />
                                      )
                                    : undefined
                            }
                        />

                        {editorMode === "trim" ? (
                            <>
                                <EditorTrimIntent
                                    intent={editMode}
                                    regionCount={editMode === "keep" ? keepRegions.length : removeRegions.length}
                                    removedMs={removeRegions.reduce((sum, r) => sum + (r.end - r.start), 0)}
                                    onSelectIntent={(intent) => {
                                        haptic.tap();
                                        setIntent(intent);
                                    }}
                                    gridAvailable={gridAvailable}
                                    keepToGrid={keepToGrid}
                                    onToggleKeepToGrid={() => setKeepToGrid((prev) => !prev)}
                                />

                                <View style={editorLocalStyles.regionsHead}>
                                    <Text style={editorLocalStyles.regionsLabel}>{t("editor.parts")}</Text>
                                    <Pressable
                                        onPress={() => {
                                            haptic.light();
                                            addRange();
                                        }}
                                        hitSlop={6}
                                        style={({ pressed }) => (pressed ? styles.pressDown : null)}
                                    >
                                        <Text style={editorLocalStyles.addLink}>{t("editor.addPlayhead")}</Text>
                                    </Pressable>
                                </View>

                                <EditorSelectionList
                                    selectedRanges={selectedRanges}
                                    intent={editMode}
                                    selectedRangeId={selectedRangeId}
                                    suggestedTitleFor={exportFlow.buildSuggestedTitle}
                                    showNames={editMode === "keep"}
                                    onRenameRange={renameRange}
                                    onSelectRange={(range) => {
                                        haptic.tap();
                                        selectRange(range.id, "start");
                                        void transportScrub.seekAndSettle(range.start);
                                    }}
                                    onRemoveRange={(rangeId) => {
                                        haptic.tap();
                                        removeRange(rangeId);
                                    }}
                                />

                                {selectedRange ? (
                                    <View style={editorLocalStyles.inspectorWrap}>
                                        <MarkInspector
                                            startMs={selectedRange.start}
                                            endMs={selectedRange.end}
                                            edge={selectedEdge}
                                            onPickEdge={(edge) => {
                                                setSelectedEdge(edge);
                                                // Picking an edge cues it, so the reel always shows
                                                // the moment you are about to move.
                                                void transportScrub.seekAndSettle(
                                                    edge === "start" ? selectedRange.start : selectedRange.end
                                                );
                                            }}
                                            minMs={0}
                                            maxMs={editDurationMs}
                                            onSlide={(ms) => applyEdge(selectedRange.id, selectedEdge, ms)}
                                            onSlideCommit={(ms) =>
                                                applyEdge(selectedRange.id, selectedEdge, snapEdge(ms))
                                            }
                                            onNudge={(deltaMs) => {
                                                const base =
                                                    selectedEdge === "start" ? selectedRange.start : selectedRange.end;
                                                applyEdge(selectedRange.id, selectedEdge, base + deltaMs);
                                            }}
                                            onUsePlayhead={() =>
                                                applyEdge(selectedRange.id, selectedEdge, snapEdge(playheadTimeMs))
                                            }
                                            usePlayheadDisabled={false}
                                            nudgeStepMs={nudgeStepMsForZoom(zoomMultiple)}
                                            startLabel={t("editor.startEdge")}
                                            endLabel={t("editor.endEdge")}
                                            hint={
                                                gridAvailable && keepToGrid
                                                    ? snapResolutionForZoom(zoomMultiple) === "bar"
                                                        ? t("editor.snapHintBars")
                                                        : t("editor.snapHintBeats")
                                                    : t("player.inspectorHint", {
                                                          step: nudgeStepMsForZoom(zoomMultiple),
                                                      })
                                            }
                                        />
                                    </View>
                                ) : null}

                                <View style={{ height: 24 }} />
                            </>
                        ) : (
                            <EditorTransformSection
                                playbackRate={transformState.playbackRate}
                                pitchShiftSemitones={transformState.pitchShiftSemitones}
                                supportsPitchPreview={previewTransport.isPitchPreviewAvailable}
                                onAdjustPlaybackRate={transformState.setPlaybackRate}
                                onAdjustPitchShift={transformState.setPitchShiftSemitones}
                                onResetTransforms={transformState.resetTransforms}
                            />
                        )}
                    </>
                ) : (
                    <Text style={{ textAlign: "center", marginTop: 40, color: colors.textSecondary }}>
                        No file available to edit.
                    </Text>
                )}
            </TransportLayout>

            <HelpSheet
                visible={helpVisible}
                onClose={() => setHelpVisible(false)}
                title={EDITOR_HELP.title}
                intro={EDITOR_HELP.intro}
                items={EDITOR_HELP.items}
            />

            <EditorExportProgressModal visible={exportFlow.isExporting} />

            <EditorTransformExportModal
                visible={exportFlow.transformExportModalVisible}
                targetIdeaKind={targetIdea?.kind ?? null}
                targetIdeaTitle={targetIdea?.title ?? null}
                pitchShiftSemitones={transformState.pitchShiftSemitones}
                playbackRate={transformState.playbackRate}
                nameDraft={exportFlow.transformNameDraft}
                suggestedExportTitle={exportFlow.suggestedExportTitle}
                removeOriginalAfterExport={exportFlow.removeOriginalAfterExport}
                onClose={exportFlow.closeTransformExportModal}
                onChangeNameDraft={exportFlow.setTransformNameDraft}
                onToggleRemoveOriginalAfterExport={() =>
                    exportFlow.setRemoveOriginalAfterExport((prev) => !prev)
                }
                onSave={() => {
                    void exportFlow.handleTransformSave();
                }}
            />

            <EditorSaveSheet
                visible={exportFlow.exportModalVisible}
                operation={exportFlow.exportOperation}
                targetIdeaKind={targetIdea?.kind ?? null}
                keepRegions={keepRegions}
                removedMs={removeRegions.reduce((sum, region) => sum + (region.end - region.start), 0)}
                gridOutcomeLine={gridOutcomeLine}
                spliceNameDraft={exportFlow.spliceNameDraft}
                suggestedExportTitle={exportFlow.suggestedExportTitle}
                suggestedTitleFor={exportFlow.buildSuggestedTitle}
                removeOriginalAfterExport={exportFlow.removeOriginalAfterExport}
                confirmLabel={
                    exportFlow.exportOperation === "extract"
                        ? t("editor.extractCount", { count: keepRegions.length })
                        : t("editor.saveTrimmed")
                }
                onChangeSpliceNameDraft={exportFlow.setSpliceNameDraft}
                onToggleRemoveOriginalAfterExport={() =>
                    exportFlow.setRemoveOriginalAfterExport((prev) => !prev)
                }
                onClose={exportFlow.closeExportModal}
                onSave={() => {
                    void exportFlow.handleExportSave();
                }}
            />
        </SafeAreaView>
    );
}
