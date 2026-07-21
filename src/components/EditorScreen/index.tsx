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
import { EditorExportModal } from "./components/EditorExportModal";
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
        paddingHorizontal: 10,
    },
    overdubGateIconRing: {
        width: 56,
        height: 56,
        borderRadius: radii.round,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FDF5F2",
        borderWidth: 1,
        borderColor: colors.borderMuted,
    },
    overdubGateTitle: {
        fontFamily: "PlayfairDisplay_600SemiBold",
        fontSize: 24,
        lineHeight: 30,
        color: colors.textPrimary,
    },
    overdubGateBody: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 15,
        lineHeight: 24,
        color: colors.textStrong,
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
        editMode,
        setIntent,
        keepRegions,
        removeRegions,
        addRange,
        removeRange,
    } = useEditorSelectionState({
        analysisDurationMs: analysisData?.durationMs ?? null,
        playheadTimeMs,
    });

    const togglePlay = () => {
        if (previewTransport.effectiveIsPlaying) {
            editorLog("togglePlay → pause", { positionMs: playheadTimeMs });
            void previewTransport.pause();
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
    const exportFlow = useEditorExportFlow({
        ideaId,
        clipId,
        audioUri,
        analysisData,
        targetIdea,
        sourceClip,
        keepRegions,
        removeRegions,
        transformPitchShiftSemitones: transformState.pitchShiftSemitones,
        transformPlaybackRate: transformState.playbackRate,
        hasActiveTransforms: transformState.hasActiveTransforms,
        playheadTimeMs,
        isPlayerPlaying: previewTransport.effectiveIsPlaying,
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
        safePlay: previewTransport.play,
        setCurrentTime,
        cancelTransportScrub: transportScrub.cancelScrub,
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
                                                  setSelectedRanges((prev) => prev.map((r) => (r.id === id ? { ...r, start, end } : r)));
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
                                />

                                <View style={editorLocalStyles.regionsHead}>
                                    <Text style={editorLocalStyles.regionsLabel}>{t("editor.regions")}</Text>
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
                                    onSeekRangeStart={(range) => {
                                        void transportScrub.seekAndSettle(range.start);
                                    }}
                                    onSeekRangeEnd={(range) => {
                                        void transportScrub.seekAndSettle(range.end);
                                    }}
                                    onRemoveRange={(rangeId) => {
                                        haptic.tap();
                                        removeRange(rangeId);
                                    }}
                                />

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

            <EditorExportModal
                visible={exportFlow.exportModalVisible}
                targetIdeaKind={targetIdea?.kind ?? null}
                targetIdeaTitle={targetIdea?.title ?? null}
                exportOperation={exportFlow.exportOperation}
                keepRegions={keepRegions}
                removeRegions={removeRegions}
                extractNameDrafts={exportFlow.extractNameDrafts}
                previewRegionId={exportFlow.previewRegionId}
                isPreviewPlaying={previewTransport.effectiveIsPlaying}
                playheadTimeMs={playheadTimeMs}
                spliceNameDraft={exportFlow.spliceNameDraft}
                suggestedExportTitle={exportFlow.suggestedExportTitle}
                removeOriginalAfterExport={exportFlow.removeOriginalAfterExport}
                onClose={exportFlow.closeExportModal}
                onSelectExportOperation={exportFlow.setExportOperation}
                onChangeExtractNameDraft={(regionId, value) => {
                    exportFlow.setExtractNameDrafts((prev) => ({ ...prev, [regionId]: value }));
                }}
                onToggleRegionPreview={(region) => {
                    void exportFlow.toggleRegionPreview(region);
                }}
                onBeginRegionPreviewScrub={(region) => {
                    void exportFlow.beginRegionPreviewScrub(region);
                }}
                onSeekRegionPreview={(region, relativeTimeMs) => {
                    void exportFlow.seekRegionPreview(region, relativeTimeMs);
                }}
                onCancelRegionPreviewScrub={() => {
                    void exportFlow.cancelRegionPreviewScrub();
                }}
                onChangeSpliceNameDraft={exportFlow.setSpliceNameDraft}
                onToggleRemoveOriginalAfterExport={() =>
                    exportFlow.setRemoveOriginalAfterExport((prev) => !prev)
                }
                onSave={() => {
                    void exportFlow.handleExportSave();
                }}
                buildSuggestedTitle={exportFlow.buildSuggestedTitle}
            />
        </SafeAreaView>
    );
}
