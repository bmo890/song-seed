import React, { useEffect, useMemo, useState, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Modal, StyleSheet, Pressable } from "react-native";
import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { MultiTimeRangeSelector } from "../common/TimeRangeSelector";
import { AudioAnalysis, extractAudioAnalysis, trimAudio } from "@siteed/expo-audio-studio";
import { styles } from "../../styles";
import { buildStaticWaveform, fmt, genClipTitle, metersToWaveformPeaks } from "../../utils";
import { RootStackParamList } from "../../../App";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
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
import { getCollectionHierarchyLevel, getIdeaHierarchyLevel } from "../../hierarchy";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { openCollectionFromContext } from "../../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Editor">;

const MIN_REGION_DURATION_MS = 1000;
const NEW_REGION_FRACTION_OF_DURATION = 8;
type EditableSelection = { id: string; start: number; end: number; type: "keep" | "remove" };

function buildFallbackClipTitle() {
    return `New Clip — ${new Date().toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })}`;
}

function buildClipId() {
    return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getInitialRegionDurationMs(durationMs: number) {
    return Math.max(MIN_REGION_DURATION_MS, Math.floor(durationMs / NEW_REGION_FRACTION_OF_DURATION));
}

function buildWaveformPeaks(analysis: AudioAnalysis) {
    const levelsAsDb = analysis.dataPoints.map((p) =>
        Number.isFinite(p.dB) ? p.dB : p.amplitude > 0 ? 20 * Math.log10(p.amplitude) : -60
    );
    return metersToWaveformPeaks(levelsAsDb, 96);
}

function buildFallbackAnalysis(durationMs: number): AudioAnalysis {
    return {
        segmentDurationMs: Math.max(100, Math.floor(durationMs / 96)),
        durationMs,
        bitDepth: 16,
        samples: 0,
        numberOfChannels: 1,
        sampleRate: 44100,
        dataPoints: [],
        amplitudeRange: { min: 0, max: 0 },
        rmsRange: { min: 0, max: 0 },
        extractionTimeMs: 0,
    };
}

function formatSelectionDuration(ms: number) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}hr ${minutes}min ${seconds}sec`;
    }
    if (minutes > 0) {
        return `${minutes}min ${String(seconds).padStart(2, "0")}sec`;
    }
    return `${seconds} sec`;
}

export function EditorScreen() {
    const navigation = useNavigation();
    const route = useRoute<Props["route"]>();
    const { ideaId, clipId, audioUri, durationMs: routeDurationMs } = route.params;

    const [currentTime, setCurrentTime] = useState(0);
    const [analysisData, setAnalysisData] = useState<AudioAnalysis | null>(null);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedRanges, setSelectedRanges] = useState<EditableSelection[]>([]);
    const [regionIdCounter, setRegionIdCounter] = useState(1);
    const [editMode, setEditMode] = useState<"keep" | "remove">("keep");

    const previewWasPlayingRef = useRef(false);
    const previewPausePromiseRef = useRef<Promise<void> | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [extractNameDrafts, setExtractNameDrafts] = useState<Record<string, string>>({});
    const [spliceNameDraft, setSpliceNameDraft] = useState("");
    const [removeOriginalAfterExport, setRemoveOriginalAfterExport] = useState(false);
    const [exportOperation, setExportOperation] = useState<"extract" | "splice">("extract");
    const [previewRegionId, setPreviewRegionId] = useState<string | null>(null);

    const updateIdeas = useStore((s) => s.updateIdeas);
    const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
    const markRecentlyAdded = useStore((s) => s.markRecentlyAdded);
    const activeWorkspace = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null);
    const targetIdea = useStore((s) => {
        const workspace = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
        return workspace?.ideas.find((idea) => idea.id === ideaId) ?? null;
    });
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

    const resetPreviewScrubSession = () => {
        previewWasPlayingRef.current = false;
        previewPausePromiseRef.current = null;
    };

    const togglePlay = () => {
        if (status.playing) {
            safePause();
        } else {
            safePlay();
        }
    };

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

    const addRange = () => {
        if (!analysisData) return;
        const dur = analysisData.durationMs;
        let newStart = playheadTimeMs;

        const sorted = [...selectedRanges].sort((a, b) => a.start - b.start);

        // Keep the creation rules aligned with the drag constraints so selections don't snap on first edit.
        const insideRange = sorted.find(
            (r) => newStart >= r.start + MIN_REGION_DURATION_MS && newStart <= r.end - MIN_REGION_DURATION_MS
        );
        if (insideRange) {
            setSelectedRanges((prev) => {
                const mapped = prev.map((r) => (r.id === insideRange.id ? { ...r, end: newStart } : r));
                return [
                    ...mapped,
                    { id: regionIdCounter.toString(), start: newStart, end: insideRange.end, type: insideRange.type },
                ];
            });
            setRegionIdCounter((prev) => prev + 1);
            return;
        }

        const touchingRange = sorted.find((r) => newStart >= r.start && newStart <= r.end);
        if (touchingRange) {
            newStart = touchingRange.end;
        }

        let maxEnd = dur;
        let spawned = false;

        for (const r of sorted) {
            if (r.start >= newStart) {
                if (r.start - newStart >= MIN_REGION_DURATION_MS) {
                    maxEnd = r.start;
                    spawned = true;
                    break;
                } else {
                    newStart = r.end;
                }
            }
        }

        if (!spawned && newStart >= dur - MIN_REGION_DURATION_MS) {
            newStart = 0;
            maxEnd = dur;
            for (const r of sorted) {
                if (r.start >= newStart) {
                    if (r.start - newStart >= MIN_REGION_DURATION_MS) {
                        maxEnd = r.start;
                        break;
                    } else {
                        newStart = r.end;
                    }
                }
            }
            if (newStart >= dur - MIN_REGION_DURATION_MS) {
                return;
            }
        }

        if (maxEnd - newStart < MIN_REGION_DURATION_MS) {
            Alert.alert("No room", "Selections must be at least 1 second long.");
            return;
        }

        const initialRegionDurationMs = getInitialRegionDurationMs(dur);
        const newEnd = Math.min(maxEnd, newStart + initialRegionDurationMs);

        setSelectedRanges((prev) => [
            ...prev,
            { id: regionIdCounter.toString(), start: newStart, end: newEnd, type: editMode },
        ]);
        setRegionIdCounter((prev) => prev + 1);
    };

    const removeRange = (id: string) => {
        setSelectedRanges((prev) => prev.filter((r) => r.id !== id));
    };

    const keepRegions = selectedRanges.filter((r) => r.type === "keep");
    const removeRegions = selectedRanges.filter((r) => r.type === "remove");
    const keepRegionIdsKey = keepRegions.map((region) => region.id).join("|");
    const activeExportCount = exportOperation === "extract" ? keepRegions.length : removeRegions.length > 0 ? 1 : 0;
    const sourceBaseTitle = sourceClip?.title?.trim() || targetIdea?.title?.trim() || buildFallbackClipTitle();

    const buildSuggestedTitle = (offset = 0) => {
        if (!targetIdea) return buildFallbackClipTitle();
        if (targetIdea.kind === "project") {
            return genClipTitle(targetIdea.title, targetIdea.clips.length + offset + 1);
        }
        return `${sourceBaseTitle} v${offset + 2}`;
    };

    const suggestedExportTitle = buildSuggestedTitle(0);

    const buildInitialExtractDrafts = () =>
        keepRegions.reduce<Record<string, string>>((acc, region) => {
            acc[region.id] = "";
            return acc;
        }, {});

    useEffect(() => {
        if (!exportModalVisible) return;
        if (exportOperation === "extract") {
            setExtractNameDrafts((prev) => {
                const next: Record<string, string> = {};
                let changed = false;
                keepRegions.forEach((region) => {
                    const nextValue = prev[region.id] ?? "";
                    next[region.id] = nextValue;
                    if (prev[region.id] !== nextValue) {
                        changed = true;
                    }
                });
                const prevKeys = Object.keys(prev);
                if (!changed && prevKeys.length === keepRegions.length && prevKeys.every((key) => next[key] === prev[key])) {
                    return prev;
                }
                return next;
            });
        }
    }, [exportModalVisible, exportOperation, keepRegionIdsKey]);

    useEffect(() => {
        if (!previewRegionId) return;
        const activeRegion = keepRegions.find((region) => region.id === previewRegionId);
        if (!activeRegion) {
            resetPreviewScrubSession();
            setPreviewRegionId(null);
            return;
        }
        if (status.playing && playheadTimeMs >= activeRegion.end) {
            safePause();
            resetPreviewScrubSession();
            setPreviewRegionId(null);
            setCurrentTime(activeRegion.end);
            try {
                player.seekTo(activeRegion.end / 1000);
            } catch (e) {
                console.warn("Preview stop seek error:", e);
            }
        }
    }, [keepRegions, playheadTimeMs, player, previewRegionId, status.playing]);

    useEffect(() => {
        if (!exportModalVisible && previewRegionId) {
            safePause();
            resetPreviewScrubSession();
            setPreviewRegionId(null);
        }
    }, [exportModalVisible, previewRegionId]);

    const openExportModal = () => {
        const keepCount = keepRegions.length;
        const removeCount = removeRegions.length;

        if (keepCount === 0 && removeCount === 0) {
            return Alert.alert("No Edits", "Please add some active regions before exporting.");
        }

        const nextOperation = keepCount > 0 ? "extract" : "splice";
        safePause();
        resetPreviewScrubSession();
        setPreviewRegionId(null);
        setExportOperation(nextOperation);
        setExtractNameDrafts(buildInitialExtractDrafts());
        setSpliceNameDraft("");
        setRemoveOriginalAfterExport(false);
        setExportModalVisible(true);
    };

    const buildExtractTitles = () =>
        keepRegions.map((region, index) => extractNameDrafts[region.id]?.trim() || buildSuggestedTitle(index));

    const buildSpliceTitle = () => spliceNameDraft.trim() || suggestedExportTitle;

    const finishExport = (highlightIds: string[]) => {
        if (highlightIds.length > 0) {
            markRecentlyAdded(highlightIds);
        }
        setExportModalVisible(false);
        resetPreviewScrubSession();
        setPreviewRegionId(null);
        if (targetIdea?.kind === "project") {
            setSelectedIdeaId(ideaId);
        } else {
            setSelectedIdeaId(null);
        }
        navigation.dispatch(StackActions.pop(2));
    };

    const commitExportedClips = (clipsToInsert: Omit<ClipVersion, "id" | "createdAt" | "isPrimary">[]) => {
        if (!targetIdea || !sourceClip || clipsToInsert.length === 0) return [];

        const now = Date.now();
        const createdClips = clipsToInsert.map((clip, index) => ({
            ...clip,
            id: buildClipId(),
            createdAt: now + index,
            isPrimary: false,
        }));

        if (targetIdea.kind === "clip") {
            const createdIdeas: SongIdea[] = createdClips.map((clip, index) => ({
                id: `idea-${now + index}-${Math.random().toString(36).slice(2, 8)}`,
                title: clip.title,
                notes: "",
                status: "clip",
                completionPct: 0,
                kind: "clip",
                collectionId: targetIdea.collectionId,
                clips: [{ ...clip, isPrimary: true }],
                createdAt: now + index,
                lastActivityAt: now + index,
            }));

            updateIdeas((prev) => {
                const remainingIdeas = removeOriginalAfterExport
                    ? prev.filter((idea) => idea.id !== ideaId)
                    : [...prev];
                return [...createdIdeas, ...remainingIdeas];
            });
            useStore.getState().logActivityEvents(
                createdIdeas.map((idea, index) => ({
                    at: now + index,
                    workspaceId: useStore.getState().activeWorkspaceId ?? "",
                    collectionId: idea.collectionId,
                    ideaId: idea.id,
                    ideaKind: "clip" as const,
                    ideaTitle: idea.title,
                    clipId: idea.clips[0]?.id ?? null,
                    metric: "created" as const,
                    source: "audio-edit" as const,
                })).filter((event) => !!event.workspaceId)
            );

            return createdIdeas.map((idea) => idea.id);
        }

        updateIdeas((prev) =>
            prev.map((idea) => {
                if (idea.id !== ideaId) return idea;

                const remainingClips = removeOriginalAfterExport
                    ? idea.clips.filter((clip) => clip.id !== clipId)
                    : [...idea.clips];
                const sourceWasPrimary = !!idea.clips.find((clip) => clip.id === clipId)?.isPrimary;
                const noPrimaryRemaining = !remainingClips.some((clip) => clip.isPrimary);

                const nextNewClips = createdClips.map((clip, index) => ({
                    ...clip,
                    isPrimary: removeOriginalAfterExport && (sourceWasPrimary || noPrimaryRemaining) && index === 0,
                }));

                const nextIdea = {
                    ...idea,
                    title:
                        idea.kind === "clip" && removeOriginalAfterExport && nextNewClips.length === 1
                            ? nextNewClips[0]!.title
                            : idea.title,
                    clips: [...nextNewClips, ...remainingClips],
                };

                if (!nextIdea.clips.some((clip) => clip.isPrimary) && nextIdea.clips[0]) {
                    nextIdea.clips[0] = { ...nextIdea.clips[0], isPrimary: true };
                }

                return nextIdea;
            })
        );
        useStore.getState().logIdeaActivity(ideaId, "updated", "audio-edit", createdClips[0]?.id ?? null);

        return createdClips.map((clip) => clip.id);
    };

    const toggleRegionPreview = async (region: EditableSelection) => {
        const isSameRegion = previewRegionId === region.id;
        if (isSameRegion && status.playing) {
            safePause();
            resetPreviewScrubSession();
            setPreviewRegionId(null);
            return;
        }

        await transportScrub.cancelScrub();
        safePause();
        setPreviewRegionId(region.id);
        setCurrentTime(region.start);

        try {
            await player.seekTo(region.start / 1000);
            await player.play();
        } catch (e) {
            console.warn("Preview error:", e);
            setPreviewRegionId(null);
        }
    };

    const beginRegionPreviewScrub = async (region: EditableSelection) => {
        const wasPreviewPlaying = previewRegionId === region.id && status.playing;
        previewWasPlayingRef.current = wasPreviewPlaying;
        setPreviewRegionId(region.id);
        previewPausePromiseRef.current = status.playing ? Promise.resolve(player.pause()) : Promise.resolve();
        try {
            await previewPausePromiseRef.current;
        } catch (e) {
            console.warn("Preview scrub pause error:", e);
        }
    };

    const seekRegionPreview = async (region: EditableSelection, relativeTimeMs: number) => {
        const targetTime = Math.max(region.start, Math.min(region.end, region.start + relativeTimeMs));
        try {
            await previewPausePromiseRef.current;
        } catch (e) {
            console.warn("Preview scrub settle error:", e);
        }
        setPreviewRegionId(region.id);
        setCurrentTime((prev) => (prev === targetTime ? prev : targetTime));

        try {
            await player.seekTo(targetTime / 1000);
            if (previewWasPlayingRef.current) {
                safePlay();
            }
        } catch (e) {
            console.warn("Preview seek error:", e);
        } finally {
            previewWasPlayingRef.current = false;
            previewPausePromiseRef.current = null;
        }
    };

    const cancelRegionPreviewScrub = async () => {
        try {
            await previewPausePromiseRef.current;
        } catch (e) {
            console.warn("Preview scrub cancel settle error:", e);
        }
        if (previewWasPlayingRef.current) {
            safePlay();
        }
        previewWasPlayingRef.current = false;
        previewPausePromiseRef.current = null;
    };

    const exportExtract = async () => {
        if (!audioUri || !sourceClip) return;

        safePause();
        setIsExporting(true);
        try {
            const titles = buildExtractTitles();
            const exportedClips: Omit<ClipVersion, "id" | "createdAt" | "isPrimary">[] = [];

            for (const [index, region] of keepRegions.entries()) {
                const res = await trimAudio({
                    fileUri: audioUri,
                    mode: "single",
                    startTimeMs: region.start,
                    endTimeMs: region.end,
                });
                const metadata = await loadManagedAudioMetadata(
                    res.uri,
                    `${clipId}-${region.id}-${index}`,
                    region.end - region.start
                );
                exportedClips.push({
                    title: titles[index] ?? genClipTitle(targetIdea?.title ?? "Clip", index + 1),
                    notes: "",
                    parentClipId: clipId,
                    audioUri: res.uri,
                    sourceAudioUri: sourceClip.audioUri,
                    durationMs: metadata.durationMs,
                    waveformPeaks: metadata.waveformPeaks,
                    editRegions: [
                        {
                            id: region.id,
                            startMs: region.start,
                            endMs: region.end,
                            type: "keep",
                        },
                    ],
                });
            }

            const newClipIds = commitExportedClips(exportedClips);
            finishExport(newClipIds);
        } catch (e) {
            Alert.alert("Export Error", "Failed to extract clips.");
        } finally {
            setIsExporting(false);
        }
    };

    const exportSplice = async () => {
        if (!audioUri || !sourceClip || !analysisData) return;

        safePause();
        setIsExporting(true);
        try {
            const title = buildSpliceTitle();
            const res = await trimAudio({
                fileUri: audioUri,
                mode: "remove",
                ranges: removeRegions.map((r) => ({ startTimeMs: r.start, endTimeMs: r.end })),
            });
            const keptDurationMs = Math.max(
                0,
                removeRegions.reduce(
                    (total, region) => total - (region.end - region.start),
                    analysisData.durationMs
                )
            );
            const metadata = await loadManagedAudioMetadata(
                res.uri,
                `${clipId}-splice-${removeRegions.length}`,
                keptDurationMs
            );

            const newClipIds = commitExportedClips([
                {
                    title,
                    notes: "",
                    parentClipId: clipId,
                    audioUri: res.uri,
                    sourceAudioUri: sourceClip.audioUri,
                    durationMs: metadata.durationMs,
                    waveformPeaks: metadata.waveformPeaks,
                    editRegions: removeRegions.map<EditRegion>((region) => ({
                        id: region.id,
                        startMs: region.start,
                        endMs: region.end,
                        type: "remove",
                    })),
                },
            ]);

            finishExport(newClipIds);
        } catch (e) {
            Alert.alert("Export Error", "Failed to splice clip.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportSave = async () => {
        if (exportOperation === "extract") {
            await exportExtract();
            return;
        }

        await exportSplice();
    };

    return (
        <SafeAreaView style={styles.screen}>
            <TransportLayout
                header={
                    <>
                        <ScreenHeader
                            title="Audio Editor"
                            leftIcon="back"
                            onLeftPress={() => {
                                safePause();
                                navigation.goBack();
                            }}
                        />
                        {activeWorkspace && targetCollection && sourceClip && targetIdea ? (
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
                        ...targetCollectionAncestors.map((collection) => ({
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
                            key: targetCollection.id,
                            label: targetCollection.title,
                            level: getCollectionHierarchyLevel(targetCollection),
                            onPress: () =>
                                openCollectionFromContext(navigation, {
                                    collectionId: targetCollection.id,
                                    source: "detail",
                                }),
                        },
                        ...(targetIdea.kind === "project"
                            ? [
                                {
                                    key: targetIdea.id,
                                    label: targetIdea.title,
                                    level: getIdeaHierarchyLevel(targetIdea),
                                    onPress: () => (navigation as any).navigate("IdeaDetail", { ideaId: targetIdea.id }),
                                },
                              ]
                            : []),
                        {
                            key: sourceClip.id,
                            label: sourceClip.title,
                            level: "clip" as const,
                            active: true,
                        },
                                ]}
                            />
                        ) : null}
                    </>
                }
                footer={
                    analysisData ? (
                        <View style={styles.transportFooterCard}>
                            <View style={styles.transportFooterMeta}>
                                <Text style={styles.transportFooterEyebrow}>Sticky Controls</Text>
                                <Text style={styles.transportFooterTitle}>
                                    {activeExportCount > 0 ? `${activeExportCount} export${activeExportCount === 1 ? "" : "s"} ready` : "Build edit regions"}
                                </Text>
                            </View>
                            <View style={styles.transportFooterRow}>
                                <Pressable
                                    onPress={addRange}
                                    style={({ pressed }) => [
                                        styles.transportFooterButton,
                                        pressed ? styles.pressDown : null,
                                    ]}
                                >
                                    <Text style={styles.transportFooterButtonText}>Add Selection</Text>
                                </Pressable>
                                <Pressable
                                    onPress={openExportModal}
                                    style={({ pressed }) => [
                                        styles.transportFooterButton,
                                        styles.transportFooterButtonSecondary,
                                        activeExportCount === 0 ? styles.transportFooterButtonDisabled : null,
                                        pressed ? styles.pressDown : null,
                                    ]}
                                    disabled={activeExportCount === 0}
                                >
                                    <Text style={[styles.transportFooterButtonText, styles.transportFooterButtonTextSecondary]}>
                                        Export
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
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

                        <View style={{ marginTop: 24, paddingHorizontal: 36 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                                <TouchableOpacity
                                    onPress={() => setEditMode("keep")}
                                    style={{ flex: 1, alignItems: "center", padding: 10, borderBottomWidth: 2, borderBottomColor: editMode === "keep" ? "#10b981" : "transparent" }}
                                >
                                    <Text style={{ color: editMode === "keep" ? "#10b981" : "#64748b", fontWeight: "600" }}>Extract (Keep)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setEditMode("remove")}
                                    style={{ flex: 1, alignItems: "center", padding: 10, borderBottomWidth: 2, borderBottomColor: editMode === "remove" ? "#ef4444" : "transparent" }}
                                >
                                    <Text style={{ color: editMode === "remove" ? "#ef4444" : "#64748b", fontWeight: "600" }}>Delete (Remove)</Text>
                                </TouchableOpacity>
                            </View>

                        </View>

                        {selectedRanges.length > 0 && (
                            <View style={{ marginTop: 24, paddingHorizontal: 36 }}>
                                <Text style={{ fontSize: 16, fontWeight: "600", color: "#f8fafc", marginBottom: 12 }}>
                                    Selected Regions ({selectedRanges.length})
                                </Text>
                                {selectedRanges.map((r) => (
                                    <View key={r.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 }}>
                                        <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e293b", padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: r.type === "keep" ? "#10b981" : "#ef4444" }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: "#f8fafc", fontSize: 15, fontWeight: "700", marginBottom: 2 }}>
                                                    {r.type === "keep" ? `Clip ${keepRegions.findIndex((region) => region.id === r.id) + 1}` : `Delete ${removeRegions.findIndex((region) => region.id === r.id) + 1}`}
                                                </Text>
                                                <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500" }}>
                                                    {fmt(r.start)} - {fmt(r.end)}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingRight: 4 }}>
                                                <TouchableOpacity onPress={() => { void transportScrub.seekAndSettle(r.start); }} style={{ padding: 4 }}>
                                                    <Feather name="skip-back" size={18} color="#3b82f6" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => { void transportScrub.seekAndSettle(r.end); }} style={{ padding: 4 }}>
                                                    <Feather name="skip-forward" size={18} color="#3b82f6" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => removeRange(r.id)} style={{ padding: 6 }}>
                                            <Feather name="trash-2" size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </>
                ) : (
                    <Text style={{ textAlign: "center", marginTop: 40, color: "#64748b" }}>
                        No file available to edit.
                    </Text>
                )}
            </TransportLayout>

            <ExpoStatusBar style="dark" />

            <Modal visible={isExporting} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" }}>
                    <View style={{ backgroundColor: "#1e293b", padding: 32, borderRadius: 16, alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#10b981" />
                        <Text style={{ marginTop: 16, color: "#f8fafc", fontSize: 16, fontWeight: "600" }}>Exporting Audio...</Text>
                        <Text style={{ marginTop: 8, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>This happens entirely on your device</Text>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={exportModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    safePause();
                    resetPreviewScrubSession();
                    setPreviewRegionId(null);
                    setExportModalVisible(false);
                }}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, exportModalStyles.modalCard]}>
                        <Text style={styles.title}>Export Clips</Text>
                        <Text style={[styles.cardMeta, { marginBottom: 2 }]}>
                            {targetIdea?.kind === "project"
                                ? `Save new clip versions back into ${targetIdea.title}.`
                                : `Save extracted clips back into ${targetIdea?.title ?? "this folder"} as new clip cards.`}
                        </Text>

                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                            {removeRegions.length > 0 ? (
                                <Pressable
                                    style={[
                                        exportModalStyles.segmentButton,
                                        exportOperation === "splice" ? exportModalStyles.segmentButtonActive : null,
                                    ]}
                                    onPress={() => setExportOperation("splice")}
                                >
                                    <Text
                                        style={[
                                            exportModalStyles.segmentText,
                                            exportOperation === "splice" ? exportModalStyles.segmentTextActive : null,
                                        ]}
                                    >
                                        Splice 1
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>

                        {exportOperation === "extract" ? (
                            <>
                                <Text style={[styles.cardMeta, { marginBottom: 2 }]}>
                                    Leave a name blank to use its suggested version title automatically.
                                </Text>
                                <ScrollView
                                    style={exportModalStyles.extractList}
                                    contentContainerStyle={exportModalStyles.extractListContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {keepRegions.map((region, index) => {
                                        const draftValue = extractNameDrafts[region.id] ?? "";
                                        const previewActive = previewRegionId === region.id;
                                        const previewCurrentMs = previewActive
                                            ? Math.max(0, Math.min(region.end - region.start, playheadTimeMs - region.start))
                                            : 0;

                                        return (
                                            <View key={region.id} style={exportModalStyles.extractCard}>
                                                <View style={exportModalStyles.extractCardTop}>
                                                    <Text style={exportModalStyles.extractCardTitle}>Clip {index + 1}</Text>
                                                    <Text style={exportModalStyles.extractCardDuration}>
                                                        {formatSelectionDuration(region.end - region.start)}
                                                    </Text>
                                                </View>

                                                <View style={exportModalStyles.extractPreviewRow}>
                                                    <Pressable
                                                        style={({ pressed }) => [
                                                            styles.inlinePlayBtn,
                                                            exportModalStyles.extractPlayButton,
                                                            pressed ? styles.pressDownStrong : null,
                                                        ]}
                                                        onPress={() => {
                                                            void toggleRegionPreview(region);
                                                        }}
                                                    >
                                                        <Ionicons
                                                            name={previewActive && status.playing ? "pause" : "play"}
                                                            size={14}
                                                            color="#111827"
                                                        />
                                                    </Pressable>
                                                    <View style={[styles.inlinePlayerWrap, exportModalStyles.extractMiniWrap]}>
                                                        <MiniProgress
                                                            currentMs={previewCurrentMs}
                                                            durationMs={region.end - region.start}
                                                            onSeekStart={() => {
                                                                void beginRegionPreviewScrub(region);
                                                            }}
                                                            onSeek={(relativeTimeMs) => {
                                                                void seekRegionPreview(region, relativeTimeMs);
                                                            }}
                                                            onSeekCancel={() => {
                                                                void cancelRegionPreviewScrub();
                                                            }}
                                                        />
                                                    </View>
                                                </View>

                                                <TitleInput
                                                    value={draftValue}
                                                    onChangeText={(value) => {
                                                        setExtractNameDrafts((prev) => ({ ...prev, [region.id]: value }));
                                                    }}
                                                    placeholder={buildSuggestedTitle(index)}
                                                    containerStyle={{ marginTop: 12 }}
                                                />
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.cardMeta, { marginBottom: 6 }]}>Trimmed clip name</Text>
                                <TitleInput
                                    value={spliceNameDraft}
                                    onChangeText={setSpliceNameDraft}
                                    placeholder={suggestedExportTitle}
                                />
                                <Text style={[styles.cardMeta, { marginTop: 8 }]}>
                                    Leave empty to use the next auto-generated version name.
                                </Text>
                            </>
                        )}

                        <Pressable
                            style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}
                            onPress={() => setRemoveOriginalAfterExport((prev) => !prev)}
                        >
                            <Feather
                                name={removeOriginalAfterExport ? "check-square" : "square"}
                                size={18}
                                color={removeOriginalAfterExport ? "#2563eb" : "#9ca3af"}
                            />
                            <Text style={{ marginLeft: 8, fontSize: 14, color: "#4b5563" }}>
                                Delete the original full recording after export
                            </Text>
                        </Pressable>

                        <Text style={[styles.cardMeta, { marginTop: 12 }]}>
                            {removeOriginalAfterExport
                                ? targetIdea?.kind === "project"
                                    ? "The original source version will be removed and the new clips stay in this song."
                                    : "The original clip card will be removed and the new extracted clips stay in this ideas list."
                                : targetIdea?.kind === "project"
                                    ? "The source version stays in place and the exports are added as new versions."
                                    : "The source clip stays in place and the extracted clips are added as new cards."}
                        </Text>

                        <View style={[styles.rowButtons, { justifyContent: "flex-end", marginTop: 16 }]}>
                            <Button
                                variant="secondary"
                                label="Cancel"
                                onPress={() => {
                                    safePause();
                                    resetPreviewScrubSession();
                                    setPreviewRegionId(null);
                                    setExportModalVisible(false);
                                }}
                            />
                            <Button
                                label={exportOperation === "extract" ? "Extract" : "Save Splice"}
                                onPress={() => {
                                    void handleExportSave();
                                }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const exportModalStyles = StyleSheet.create({
    modalCard: {
        maxHeight: "86%",
        width: "92%",
    },
    segmentButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        backgroundColor: "#f8fafc",
    },
    segmentButtonActive: {
        backgroundColor: "#dbeafe",
        borderColor: "#60a5fa",
    },
    segmentText: {
        color: "#475569",
        fontWeight: "600",
    },
    segmentTextActive: {
        color: "#1d4ed8",
    },
    extractList: {
        maxHeight: 360,
    },
    extractListContent: {
        gap: 12,
        paddingBottom: 4,
    },
    extractCard: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 14,
        padding: 14,
        backgroundColor: "#f8fafc",
    },
    extractCardTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    extractCardTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0f172a",
    },
    extractCardDuration: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748b",
    },
    extractPreviewRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    extractPlayButton: {
        marginTop: 0,
    },
    extractMiniWrap: {
        flex: 1,
    },
});
