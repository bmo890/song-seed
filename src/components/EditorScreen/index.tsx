import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { MultiTimeRangeSelector } from "../common/TimeRangeSelector";
import { AudioAnalysis, extractAudioAnalysis, trimAudio } from "@siteed/audio-studio";
import { styles } from "../../styles";
import { buildStaticWaveform, genClipTitle } from "../../utils";
import { RootStackParamList } from "../../../App";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useStore } from "../../state/useStore";
import { Button } from "../common/Button";
import { EditRegion, ClipVersion, SongIdea } from "../../types";
import { AudioReel } from "../common/AudioReel";
import { MiniProgress } from "../MiniProgress";
import { TitleInput } from "../common/TitleInput";
import { MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS, loadAudioDurationMs, loadManagedAudioMetadata } from "../../services/audioStorage";
import { activatePlaybackAudioSession } from "../../services/audioSession";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import {
    buildClipId,
    buildFallbackAnalysis,
    buildFallbackClipTitle,
    buildWaveformPeaks,
    cloneEditRegions,
    clonePracticeMarkers,
    cloneTags,
    EditableSelection,
    formatSelectionDuration,
} from "./helpers";
import { useEditorSelectionState } from "./hooks/useEditorSelectionState";
import { EditorHeaderSection } from "./EditorHeaderSection";
import { EditorFooterSection } from "./EditorFooterSection";
import { EditorSelectionModeTabs } from "./EditorSelectionModeTabs";
import { EditorSelectionList } from "./EditorSelectionList";
import { EditorExportProgressModal } from "./EditorExportProgressModal";
import { EditorExportModal } from "./EditorExportModal";
import { useEditorExportFlow } from "./hooks/useEditorExportFlow";

type Props = NativeStackScreenProps<RootStackParamList, "Editor">;

export function EditorScreen() {
    const navigation = useNavigation();
    const route = useRoute<Props["route"]>();
    const { ideaId, clipId, audioUri, durationMs: routeDurationMs } = route.params;

    const [currentTime, setCurrentTime] = useState(0);
    const [analysisData, setAnalysisData] = useState<AudioAnalysis | null>(null);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);

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
    const targetCollection =
        targetIdea && activeWorkspace ? getCollectionById(activeWorkspace, targetIdea.collectionId) : null;
    const targetCollectionAncestors =
        targetCollection && activeWorkspace ? getCollectionAncestors(activeWorkspace, targetCollection.id) : [];
    const durationHintMs = routeDurationMs ?? sourceClip?.durationMs;

    const playerSource = useMemo(() => (audioUri ? { uri: audioUri } : null), [audioUri]);
    const playerOptions = useMemo(() => ({ updateInterval: 33 }), []);
    const player = useAudioPlayer(playerSource, playerOptions);
    const status = useAudioPlayerStatus(player);
    const statusTimeMs = typeof status.currentTime === "number" ? Math.round(status.currentTime * 1000) : null;
    const transportScrub = useTransportScrubbing({
        isPlaying: !!status.playing,
        durationMs: analysisData?.durationMs ?? durationHintMs ?? 0,
        pause: async () => {
            safePause();
        },
        play: async () => {
            safePlay();
        },
        seekTo: async (timeMs) => {
            setCurrentTime((prev) => (prev === timeMs ? prev : timeMs));
            await player.seekTo(timeMs / 1000);
        },
    });
    const playheadTimeMs = transportScrub.isScrubbing ? currentTime : statusTimeMs ?? currentTime;
    const {
        selectedRanges,
        setSelectedRanges,
        editMode,
        setEditMode,
        keepRegions,
        removeRegions,
        addRange,
        removeRange,
    } = useEditorSelectionState({
        analysisDurationMs: analysisData?.durationMs ?? null,
        playheadTimeMs,
    });

    useEffect(() => {
        activatePlaybackAudioSession().catch((error) => {
            console.warn("Editor audio mode setup failed", error);
        });
    }, []);

    const safePause = () => {
        try {
            if (player) player.pause();
        } catch (e) {
            console.warn("Safe pause error:", e);
        }
    };

    const safePlay = () => {
        try {
            if (player) player.play();
        } catch (e) {
            console.warn("Safe play error:", e);
        }
    };

    const togglePlay = () => {
        if (status.playing) {
            safePause();
        } else {
            safePlay();
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
        playheadTimeMs,
        isPlayerPlaying: !!status.playing,
        player,
        navigation,
        updateIdeas,
        setSelectedIdeaId,
        markRecentlyAdded,
        safePause,
        safePlay,
        setCurrentTime,
        cancelTransportScrub: transportScrub.cancelScrub,
    });

    useEffect(() => {
        if (!audioUri) return;
        const editorAudioUri = audioUri;
        let isMounted = true;

        async function loadAudioData() {
            setIsLoading(true);
            try {
                const resolvedDurationMs =
                    durationHintMs && durationHintMs > 0 ? durationHintMs : await loadAudioDurationMs(editorAudioUri);
                const fallbackWaveform =
                    sourceClip?.waveformPeaks?.length
                        ? sourceClip.waveformPeaks
                        : buildStaticWaveform(`${clipId}-${resolvedDurationMs ?? 0}`, 96);
                const shouldAttemptDetailedAnalysis =
                    !resolvedDurationMs || resolvedDurationMs <= MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS;

                if (shouldAttemptDetailedAnalysis) {
                    try {
                        const analysis = await extractAudioAnalysis({ fileUri: editorAudioUri });
                        if (isMounted) {
                            setAnalysisData(analysis);
                            setWaveformPeaks(buildWaveformPeaks(analysis));
                            setCurrentTime(0);
                            player.seekTo(0);
                        }
                        return;
                    } catch (err) {
                        console.warn("Falling back to simplified editor analysis", err);
                    }
                }

                if (!resolvedDurationMs) {
                    throw new Error("Audio duration unavailable.");
                }

                if (isMounted) {
                    setAnalysisData(buildFallbackAnalysis(resolvedDurationMs));
                    setWaveformPeaks(fallbackWaveform);
                    setCurrentTime(0);
                    player.seekTo(0);
                }
            } catch (err) {
                console.error("Failed to prepare audio editor", err);
                if (isMounted) {
                    Alert.alert("Edit unavailable", "Could not load this audio for editing.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadAudioData();
        return () => { isMounted = false; };
    }, [audioUri, clipId, durationHintMs, player, sourceClip?.waveformPeaks]);


    return (
        <SafeAreaView style={styles.screen}>
            <TransportLayout
                header={
                    <EditorHeaderSection
                        navigation={navigation as any}
                        activeWorkspace={activeWorkspace}
                        targetCollection={targetCollection}
                        targetCollectionAncestors={targetCollectionAncestors}
                        sourceClip={sourceClip}
                        targetIdea={targetIdea}
                        onBack={() => {
                            safePause();
                            navigation.goBack();
                        }}
                    />
                }
                footer={
                    analysisData ? (
                        <EditorFooterSection
                            activeExportCount={exportFlow.activeExportCount}
                            onAddSelection={addRange}
                            onOpenExport={exportFlow.openExportModal}
                        />
                    ) : null
                }
                scrollable
            >
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#10b981" />
                        <Text style={{ marginTop: 10, color: "#64748b" }}>Analyzing audio...</Text>
                    </View>
                ) : analysisData ? (
                    <>
                        <AudioReel
                            waveformPeaks={waveformPeaks}
                            durationMs={analysisData.durationMs}
                            currentTimeMs={playheadTimeMs}
                            isPlaying={!!status.playing}
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
                                        try {
                                            player.seekTo(time / 1000);
                                        } catch (e) {
                                            console.warn("Seek error:", e);
                                        }
                                    }}
                                    onRegionChange={(id, start, end) => {
                                        setSelectedRanges((prev) => prev.map((r) => (r.id === id ? { ...r, start, end } : r)));
                                    }}
                                />
                            )}
                        />

                        <EditorSelectionModeTabs editMode={editMode} onSelectMode={setEditMode} />

                        <EditorSelectionList
                            selectedRanges={selectedRanges}
                            keepRegions={keepRegions}
                            removeRegions={removeRegions}
                            onSeekRangeStart={(range) => {
                                void transportScrub.seekAndSettle(range.start);
                            }}
                            onSeekRangeEnd={(range) => {
                                void transportScrub.seekAndSettle(range.end);
                            }}
                            onRemoveRange={removeRange}
                        />

                        <View style={{ height: 40 }} />
                    </>
                ) : (
                    <Text style={{ textAlign: "center", marginTop: 40, color: "#64748b" }}>
                        No file available to edit.
                    </Text>
                )}
            </TransportLayout>

            <ExpoStatusBar style="dark" />

            <EditorExportProgressModal visible={exportFlow.isExporting} />

            <EditorExportModal
                visible={exportFlow.exportModalVisible}
                targetIdeaKind={targetIdea?.kind ?? null}
                targetIdeaTitle={targetIdea?.title ?? null}
                exportOperation={exportFlow.exportOperation}
                keepRegions={keepRegions}
                removeRegions={removeRegions}
                extractNameDrafts={exportFlow.extractNameDrafts}
                previewRegionId={exportFlow.previewRegionId}
                isPreviewPlaying={!!status.playing}
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
