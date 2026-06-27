import React, { useCallback, useEffect, useMemo, useState } from "react";
import { colors } from "../../design/tokens";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { View, Text, ActivityIndicator, TouchableOpacity, Pressable, StyleSheet } from "react-native";
import { StackActions, useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { MultiTimeRangeSelector } from "../common/TimeRangeSelector";
import { AudioAnalysis, extractPreview } from "@siteed/audio-studio";
import { styles } from "../../styles";
import { buildStaticWaveform } from "../../utils";
import { RootStackParamList } from "../../../App";
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
import {
    buildFallbackAnalysis,
    buildWaveformPeaks,
} from "./helpers";
import { useEditorSelectionState } from "./hooks/useEditorSelectionState";
import { EditorHeaderSection } from "./EditorHeaderSection";
import { EditorFooterSection } from "./EditorFooterSection";
import { EditorTrimIntent } from "./EditorTrimIntent";
import { SegmentedControl } from "../common/SegmentedControl";
import { EditorSelectionList } from "./EditorSelectionList";
import { EditorExportProgressModal } from "./EditorExportProgressModal";
import { EditorExportModal } from "./EditorExportModal";
import { AppAlert } from "../common/AppAlert";
import { useEditorExportFlow } from "./hooks/useEditorExportFlow";
import { useEditorTransformState } from "./hooks/useEditorTransformState";
import { useEditorPreviewTransport } from "./hooks/useEditorPreviewTransport";
import { EditorTransformSection } from "./EditorTransformSection";
import { EditorTransformExportModal } from "./EditorTransformExportModal";
import { clipHasOverdubs } from "../../clipPresentation";

type Props = NativeStackScreenProps<RootStackParamList, "Editor">;

const EDITOR_MODES = [
    { key: "trim" as const, label: "Trim" },
    { key: "transform" as const, label: "Speed & pitch" },
];

// Downsampled point count for the editor waveform — fixed regardless of clip
// length, so the analysis is memory-safe even on long recordings.
const EDITOR_WAVEFORM_POINTS = 256;

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
});

export function EditorScreen() {
    const navigation = useNavigation();
    const route = useRoute<Props["route"]>();
    const isFocused = useIsFocused();
    const { ideaId, clipId, audioUri, durationMs: routeDurationMs } = route.params;

    const [currentTime, setCurrentTime] = useState(0);
    const [analysisData, setAnalysisData] = useState<AudioAnalysis | null>(null);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFlatteningOverdub, setIsFlatteningOverdub] = useState(false);
    const [editorMode, setEditorMode] = useState<"trim" | "transform">("trim");

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

    // High-resolution detail waveform (sidecar), with the inline 256-bin analysis as
    // the thumbnail fallback until it loads. This is what makes the reel stay crisp
    // all the way to max zoom.
    const clipWaveform = useClipWaveform({
        audioUri,
        thumbnailPeaks: waveformPeaks,
        durationMs: durationHintMs,
        enabled: isFocused,
    });

    const playerSource = useMemo(() => (audioUri ? { uri: audioUri } : null), [audioUri]);
    const playerOptions = useMemo(() => ({ updateInterval: 33 }), []);
    const player = useAudioPlayer(playerSource, playerOptions);
    const status = useAudioPlayerStatus(player);
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
            editorLog("load: start", { clipId, audioUri: editorAudioUri, durationHintMs });
            setIsLoading(true);
            try {
                const resolvedDurationMs =
                    durationHintMs && durationHintMs > 0 ? durationHintMs : await loadAudioDurationMs(editorAudioUri);
                editorLog("load: resolved duration", resolvedDurationMs);

                // Build the waveform with the downsampled `extractPreview` (fixed
                // point count) — the same memory-safe path the rest of the app uses —
                // instead of the full per-sample decode that OOMs on long clips.
                if (resolvedDurationMs && resolvedDurationMs > 0) {
                    try {
                        const analysis = await extractPreview({
                            fileUri: editorAudioUri,
                            numberOfPoints: EDITOR_WAVEFORM_POINTS,
                            startTimeMs: 0,
                            endTimeMs: resolvedDurationMs,
                        });
                        editorLog("load: preview ok", {
                            durationMs: analysis.durationMs,
                            points: analysis.dataPoints?.length ?? 0,
                        });
                        if (isMounted) {
                            setAnalysisData({ ...analysis, durationMs: analysis.durationMs || resolvedDurationMs });
                            setWaveformPeaks(buildWaveformPeaks(analysis));
                            setCurrentTime(0);
                            player.seekTo(0);
                        }
                        return;
                    } catch (err) {
                        console.warn("Editor waveform preview failed; using stored waveform", err);
                    }
                }

                if (!resolvedDurationMs) {
                    throw new Error("Audio duration unavailable.");
                }

                const fallbackWaveform = sourceClip?.waveformPeaks?.length
                    ? sourceClip.waveformPeaks
                    : buildStaticWaveform(`${clipId}-${resolvedDurationMs}`, EDITOR_WAVEFORM_POINTS);
                editorLog("load: using fallback waveform", {
                    stored: !!sourceClip?.waveformPeaks?.length,
                });
                if (isMounted) {
                    setAnalysisData(buildFallbackAnalysis(resolvedDurationMs));
                    setWaveformPeaks(fallbackWaveform);
                    setCurrentTime(0);
                    player.seekTo(0);
                }
            } catch (err) {
                console.error("Failed to prepare audio editor", err);
                if (isMounted) {
                    AppAlert.info("Edit unavailable", "Could not load this audio for editing.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadAudioData();
        return () => { isMounted = false; };
    }, [audioUri, clipId, durationHintMs, player, sourceClip?.waveformPeaks, sourceClipHasOverdubs]);

    const handleFlattenOverdubAndContinue = useCallback(async () => {
        if (!targetIdea || !sourceClip) return;

        editorLog("flatten overdub: start", { ideaId: targetIdea.id, clipId: sourceClip.id });
        setIsFlatteningOverdub(true);
        try {
            const savedTarget = await appActions.saveCombinedClipAsNewClip(targetIdea.id, sourceClip.id);
            if (!savedTarget) {
                throw new Error("Combined clip could not be saved.");
            }
            editorLog("flatten overdub: saved combined", savedTarget);

            const savedIdea = useStore
                .getState()
                .workspaces.flatMap((workspace) => workspace.ideas)
                .find((idea) => idea.id === savedTarget.ideaId);
            const savedClip = savedIdea?.clips.find((clip) => clip.id === savedTarget.clipId) ?? null;
            if (!savedIdea || !savedClip?.audioUri) {
                throw new Error("Combined clip could not be opened.");
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
                "Save combined failed",
                error instanceof Error ? error.message : "Could not save a combined clip."
            );
        } finally {
            setIsFlatteningOverdub(false);
        }
    }, [navigation, sourceClip, targetIdea]);


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
                    <View style={{ gap: 18, paddingTop: 32, paddingHorizontal: 6 }}>
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: "700", color: "#1b1c1a" }}>
                                Save a combined clip first
                            </Text>
                            <Text style={{ fontSize: 15, lineHeight: 24, color: "#524440" }}>
                                This take has overdub layers attached. Timing edits on the root clip would break the
                                alignment. Save the combined mix as a new clip, then edit that flattened result.
                            </Text>
                        </View>

                        <Button
                            label={isFlatteningOverdub ? "Saving combined clip..." : "Save Combined And Continue"}
                            disabled={isFlatteningOverdub}
                            onPress={() => {
                                void handleFlattenOverdubAndContinue();
                            }}
                        />
                    </View>
                ) : isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: 10, color: colors.textSecondary }}>Analyzing audio...</Text>
                    </View>
                ) : analysisData ? (
                    <>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                            <SegmentedControl
                                options={EDITOR_MODES}
                                value={editorMode}
                                onChange={setEditorMode}
                            />
                        </View>

                        <AudioReel
                            waveformPeaks={clipWaveform.peaks}
                            durationMs={analysisData.durationMs}
                            currentTimeMs={playheadTimeMs}
                            resetKey={clipId}
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
                            selectedRanges={selectedRanges}
                            renderOverlay={({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress }) => (
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
                            )}
                        />

                        {editorMode === "trim" ? (
                            <>
                                <EditorTrimIntent
                                    intent={editMode}
                                    clipCount={keepRegions.length}
                                    removedMs={removeRegions.reduce((sum, r) => sum + (r.end - r.start), 0)}
                                    onSelectIntent={setIntent}
                                />

                                <View style={editorLocalStyles.regionsHead}>
                                    <Text style={editorLocalStyles.regionsLabel}>Regions</Text>
                                    <Pressable
                                        onPress={addRange}
                                        hitSlop={6}
                                        style={({ pressed }) => (pressed ? styles.pressDown : null)}
                                    >
                                        <Text style={editorLocalStyles.addLink}>+ Add at playhead</Text>
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
                                    onRemoveRange={removeRange}
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

            <ExpoStatusBar style="dark" />

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
