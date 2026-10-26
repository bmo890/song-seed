import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { colors, spacing, text } from "../../design/tokens";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet } from "react-native";
import { Spinner } from "../common/Spinner";
import { StackActions, useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAudioPlayer } from "expo-audio";
import { useThrottledAudioPlayerStatus } from "../../hooks/useThrottledAudioPlayerStatus";
import { MultiTimeRangeSelector } from "../common/TimeRangeSelector";
import { AudioAnalysis } from "@siteed/audio-studio";
import { styles } from "../../styles";
import { RootStackParamList } from "../../navigation";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { AudioReel } from "../common/AudioReel";
import { TransportBar } from "../common/TransportBar";
import { EmptyState } from "../common/EmptyState";
import { ensurePro } from "../common/proUpsell";
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
import { EditorPartsHead } from "./components/EditorPartsHead";
import { SegmentedControl } from "../common/SegmentedControl";
import { EditorPartsList } from "./components/EditorPartsList";
import { LoopMoveHandle } from "../common/LoopMoveHandle";
import { SpanInspector, spanNeighbors } from "../common/SpanInspector";
import { getVisibleTimelineRange } from "../PlayerScreen/helpers";
import { EditorSaveSheet } from "./components/EditorSaveSheet";
import { AppAlert } from "../common/AppAlert";
import { useEditorExportFlow } from "./hooks/useEditorExportFlow";
import { useEditorTransformState } from "./hooks/useEditorTransformState";
import { useEditorPreviewTransport } from "./hooks/useEditorPreviewTransport";
import { EditorTransformSection } from "./components/EditorTransformSection";
import { clipHasOverdubs, isClipWaveformPending } from "../../domain/clipPresentation";
import { HelpSheet } from "../common/HelpSheet";
import { EDITOR_HELP } from "../common/helpContent";
import { useTranslation } from "react-i18next";
import { complementSpans, remapClipForRate, remapClipForSpans } from "../../domain/clipEditRemap";
import { SECTION_FILL_ALPHA, buildSectionBands, hexToRgba } from "../../domain/playerSections";
import { fmtDuration } from "../../utils";
import { canSnapToGrid, snapToGrid } from "../../domain/editSnap";
import { CUT_COLOR, KEEP_COLOR, MIN_REGION_DURATION_MS } from "./helpers";
import { UserFacingError, userFacingMessage } from "../../i18n/userFacingError";
import { signedNumberText } from "../../i18n/direction";

/** Picking an end edge cues two seconds before it, as the player's loop does. */
const EDGE_END_PREROLL_MS = 2000;

type Props = NativeStackScreenProps<RootStackParamList, "Editor">;

/** Tagged, greppable editor diagnostics — filter logs by "[editor]". */
const editorLog = (...args: unknown[]) => console.log("[editor]", ...args);

const editorLocalStyles = StyleSheet.create({
    partsWrap: {
        paddingHorizontal: 16,
    },
    /** The canon transport sits directly under the tape, at the dock's compact
     *  size — the tape's own control, not a second headline. */
    transportRow: {
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
    },
    loadingText: {
        ...text.supporting,
        marginTop: spacing.md,
    },
    noFile: {
        ...text.supporting,
        textAlign: "center",
        marginTop: 40,
    },
});

export function EditorScreen() {
    const { t } = useTranslation();
    // One row of tabs (2026-10-16, founder picked A): keep and remove are the
    // trim's two tools, speed & pitch the third, all said in one place.
    const editorTabs = useMemo(() => [
        { key: "keep" as const, label: t("editor.keepTab") },
        { key: "remove" as const, label: t("editor.removeTab") },
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

    /** Adding at a playhead that sits inside a part splits that part rather than making
     *  a new one. That is useful, but it used to happen silently — the link now says
     *  which of the two it will do before you press it. */
    const playheadSplitsPart = useMemo(
        () =>
            selectedRanges.some(
                (range) =>
                    playheadTimeMs >= range.start + MIN_REGION_DURATION_MS &&
                    playheadTimeMs <= range.end - MIN_REGION_DURATION_MS
            ),
        [playheadTimeMs, selectedRanges]
    );

    /** Removals that swallow the whole clip leave nothing to render. */
    const removesEverything = useMemo(() => {
        if (editMode !== "remove" || !analysisData || removeRegions.length === 0) return false;
        return (
            complementSpans(
                removeRegions.map((region) => ({ startMs: region.start, endMs: region.end })),
                analysisData.durationMs
            ).length === 0
        );
    }, [analysisData, editMode, removeRegions]);

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

    /** The part the inspector holds, drawn on the reel the way the player's loop is. */
    const heldPart = editorMode === "trim" ? selectedRange : null;
    const sharedHeldStartMs = useSharedValue(heldPart?.start ?? 0);
    const sharedHeldEndMs = useSharedValue(heldPart?.end ?? 0);
    useEffect(() => {
        if (!heldPart) return;
        sharedHeldStartMs.value = heldPart.start;
        sharedHeldEndMs.value = heldPart.end;
    }, [heldPart, sharedHeldEndMs, sharedHeldStartMs]);
    const lanesReel = !useStore((state) => state.classicReel);
    /** What the reel shows, so the inspector's slider spans the same stretch. */
    const visibleWindow = useMemo(
        () => getVisibleTimelineRange(editDurationMs, playheadTimeMs, zoomMultiple),
        [editDurationMs, playheadTimeMs, zoomMultiple]
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

    /**
     * The song's own marks, drawn on the editor's reel as context you cut against — the
     * same bands and pins the player shows, faded back so the keep/remove washes stay the
     * loudest thing on the tape. They are identity here, never editable: the reel draws
     * them inside its canvas, and the editor renders none of the player's pin badges.
     */
    const ghostSectionBands = useMemo(() => {
        if (!sourceClip?.sections?.length || !analysisData) return undefined;
        return buildSectionBands(sourceClip.sections, analysisData.durationMs).map((band) => ({
            ...band,
            color: hexToRgba(band.railColor, 0.07),
            railColor: hexToRgba(band.railColor, 0.35),
        }));
    }, [analysisData, sourceClip?.sections]);

    /** What the pending edit will do to the take's grid — the same pure remap the save
     *  itself runs, so the line can never disagree with the result. */
    const gridOutcomeLine = useMemo(() => {
        if (!sourceClip?.recordingGrid || !analysisData) return null;

        // A baked speed change stretches the timebase, so it owes the same honesty the
        // trim path gives: say what the musician's click will be worth afterwards.
        if (editorMode === "transform") {
            if (!transformState.hasActiveTransforms) return null;
            const { gridOutcome } = remapClipForRate(
                sourceClip,
                transformState.playbackRate,
                analysisData.durationMs / (transformState.playbackRate || 1)
            );
            if (gridOutcome.kind === "none") return null;
            if (gridOutcome.kind === "kept") return t("editor.gridKept");
            if (gridOutcome.kind === "partial") {
                return t("editor.gridKeptTo", { time: fmtDuration(gridOutcome.validToMs) });
            }
            return t("editor.gridNone");
        }

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
        transformState.hasActiveTransforms,
        transformState.playbackRate,
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

    /** The song's sections (ghosted), then every part not held, drawn as the
     *  player draws sections: a band in the part's ink with its name on the rail. */
    const reelBands = useMemo(() => {
        const ink = editMode === "keep" ? KEEP_COLOR : CUT_COLOR;
        const ordered = editorMode === "trim" ? [...selectedRanges].sort((a, b) => a.start - b.start) : [];
        const partBands = ordered.flatMap((range, index) =>
            range.id === heldPart?.id
                ? []
                : [
                      {
                          id: `part-${range.id}`,
                          startMs: range.start,
                          endMs: range.end,
                          // The band says what the row says: a kept part's name (or
                          // the one it will get), a removed part's number.
                          label:
                              editMode === "keep"
                                  ? range.title?.trim() || exportFlow.buildSuggestedTitle(index)
                                  : t("editor.partLabel", { n: index + 1 }),
                          color: hexToRgba(ink, SECTION_FILL_ALPHA),
                          railColor: ink,
                      },
                  ]
        );
        const bands = [...(ghostSectionBands ?? []), ...partBands];
        return bands.length > 0 ? bands : undefined;
    }, [editMode, editorMode, exportFlow, ghostSectionBands, heldPart?.id, selectedRanges, t]);

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
                    throw new UserFacingError(t("editor.durationUnavailable"));
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
                throw new UserFacingError(t("editor.combinedCouldNotSave"));
            }
            editorLog("flatten overdub: saved combined", savedTarget);

            const savedIdea = useStore
                .getState()
                .workspaces.flatMap((workspace) => workspace.ideas)
                .find((idea) => idea.id === savedTarget.ideaId);
            const savedClip = savedIdea?.clips.find((clip) => clip.id === savedTarget.clipId) ?? null;
            if (!savedIdea || !savedClip?.audioUri) {
                throw new UserFacingError(t("editor.combinedCouldNotOpen"));
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
            AppAlert.error(
                t("editor.saveCombinedFailed"),
                userFacingMessage(error, t("editor.combinedFailedBody"))
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
                            removesEverything={removesEverything}
                            onExport={exportFlow.openExportModal}
                            onSaveTransform={exportFlow.openTransformExportModal}
                        />
                    ) : null
                }
                scrollable
            >
                {sourceClipHasOverdubs ? (
                    <EmptyState
                        icon="layers-outline"
                        title={t("editor.flattenFirst")}
                        body={t("editor.flattenReason")}
                        actionLabel={isFlatteningOverdub ? t("editor.savingCombined") : t("editor.saveCombinedContinue")}
                        actionDisabled={isFlatteningOverdub}
                        onAction={() => {
                            void handleFlattenOverdubAndContinue();
                        }}
                    />
                ) : isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <Spinner size="large" color={colors.primary} />
                        <Text style={editorLocalStyles.loadingText}>{t("editor.analyzing")}</Text>
                    </View>
                ) : analysisData ? (
                    <>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                            <SegmentedControl
                                options={editorTabs}
                                value={editorMode === "transform" ? "transform" : editMode}
                                onChange={(key) => {
                                    if (key === "transform") {
                                        if (!ensurePro("full-editor")) return;
                                        setEditorMode("transform");
                                        return;
                                    }
                                    setEditorMode("trim");
                                    if (key !== editMode) setIntent(key);
                                }}
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
                            showExpandToggle={false}
                            onZoomMultipleChange={setZoomMultiple}
                            grid={sourceClip?.recordingGrid ?? null}
                            sectionBands={reelBands}
                            practiceMarkers={sourceClip?.practiceMarkers}
                            sharedCurrentTimeMs={transportClock.sharedCurrentTimeMs}
                            sharedDurationMs={transportClock.sharedDurationMs}
                            sharedTransportUpdateToken={transportClock.sharedUpdateToken}
                            isPlaying={previewTransport.effectiveIsPlaying}
                            sharedIsPlaying={transportClock.sharedIsPlaying}
                            playbackRate={previewTransport.effectivePlaybackRate}
                            sharedPlaybackRate={transportClock.sharedPlaybackRate}
                            isScrubbing={transportScrub.isScrubbing}
                            onSeek={transportScrub.scrubTo}
                            onScrubStateChange={(scrubbing) => {
                                if (scrubbing) {
                                    void transportScrub.beginScrub();
                                    return;
                                }
                                void transportScrub.endScrub();
                            }}
                            // The held part is drawn exactly as the player's loop: inside the
                            // reel's canvas, from shared values, with an invisible edge grab
                            // over it and the move bar beneath (2026-10-16). The other parts
                            // ride as section bands (reelBands).
                            selectedRanges={heldPart ? [heldPart] : undefined}
                            sharedSelectedRangeStartMs={heldPart ? sharedHeldStartMs : undefined}
                            sharedSelectedRangeEndMs={heldPart ? sharedHeldEndMs : undefined}
                            selectedRangeType={editMode}
                            freezeSelectedRangeWhenFullyVisible={!!heldPart}
                            renderOverlay={
                                heldPart
                                    ? ({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress }) => (
                                          <MultiTimeRangeSelector
                                              durationMs={analysisData.durationMs}
                                              pixelsPerMs={pixelsPerMs}
                                              regions={[heldPart]}
                                              sharedTranslateX={timelineTranslateX}
                                              sharedScale={timelineScale}
                                              sharedAudioProgress={sharedAudioProgress}
                                              sharedPreviewStartMs={sharedHeldStartMs}
                                              sharedPreviewEndMs={sharedHeldEndMs}
                                              showVisuals={false}
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
                            renderBelowSurface={
                                heldPart
                                    ? ({ pixelsPerMs, timelineTranslateX, timelineScale }) => (
                                          <LoopMoveHandle
                                              range={heldPart}
                                              durationMs={analysisData.durationMs}
                                              pixelsPerMs={pixelsPerMs}
                                              timelineTranslateX={timelineTranslateX}
                                              timelineScale={timelineScale}
                                              sharedPreviewStartMs={sharedHeldStartMs}
                                              sharedPreviewEndMs={sharedHeldEndMs}
                                              onRangeChange={(start, end) => {
                                                  setSelectedRanges((prev) =>
                                                      prev.map((r) => (r.id === heldPart.id ? { ...r, start, end } : r))
                                                  );
                                              }}
                                              onScrubStateChange={(scrubbing) => {
                                                  if (scrubbing) {
                                                      void transportScrub.beginScrub();
                                                      return;
                                                  }
                                                  void transportScrub.endScrub();
                                              }}
                                              quiet={lanesReel}
                                              ink={editMode === "remove" ? CUT_COLOR : undefined}
                                          />
                                      )
                                    : undefined
                            }
                        />

                        {/* The skips go to the clip's ends: pause-seek-settle-resume, the
                            same round trip the reel's own scrub makes (seekAndSettle). */}
                        <View style={editorLocalStyles.transportRow}>
                            <TransportBar
                                size="compact"
                                isPlaying={previewTransport.effectiveIsPlaying}
                                canGoPrevious
                                canGoNext
                                onPrevious={() => void transportScrub.seekAndSettle(0)}
                                onTogglePlay={togglePlay}
                                onNext={() => void transportScrub.seekAndSettle(analysisData.durationMs)}
                                previousLabel={t("editor.toStart")}
                                nextLabel={t("editor.toEnd")}
                            />
                        </View>

                        {editorMode === "trim" ? (
                            <>
                                <View style={editorLocalStyles.partsWrap}>
                                    <EditorPartsHead
                                        count={selectedRanges.length}
                                        gridAvailable={gridAvailable}
                                        keepToGrid={keepToGrid}
                                        onToggleKeepToGrid={() => setKeepToGrid((prev) => !prev)}
                                        addLabel={playheadSplitsPart ? t("editor.splitHere") : t("editor.addPlayhead")}
                                        onAdd={addRange}
                                    />
                                    {selectedRanges.length === 0 ? (
                                        <EmptyState
                                            compact
                                            title={t("editor.noPartsTitle")}
                                            body={editMode === "keep" ? t("editor.noPartsKeep") : t("editor.noPartsRemove")}
                                        />
                                    ) : (
                                        <EditorPartsList
                                            parts={selectedRanges}
                                            intent={editMode}
                                            heldId={selectedRangeId}
                                            suggestedTitleFor={exportFlow.buildSuggestedTitle}
                                            showNames={editMode === "keep"}
                                            onHold={(part) => selectRange(part?.id ?? null, "start")}
                                            onRename={renameRange}
                                            onRemove={removeRange}
                                            onPlayFrom={(ms) => {
                                                transportClock.setDisplayPositionMs(ms);
                                                setCurrentTime(ms);
                                                void transportScrub.seekAndSettle(ms).then(() => previewTransport.play());
                                            }}
                                            renderInspector={(part) => (
                                                <SpanInspector
                                                    startMs={part.start}
                                                    endMs={part.end}
                                                    edge={selectedEdge}
                                                    // The looper's rule: picking an edge cues it, the start
                                                    // exactly, the end two seconds early so you hear it arrive.
                                                    onPickEdge={(edge) => {
                                                        setSelectedEdge(edge);
                                                        void transportScrub.seekAndSettle(
                                                            edge === "start"
                                                                ? part.start
                                                                : Math.max(part.start, part.end - EDGE_END_PREROLL_MS)
                                                        );
                                                    }}
                                                    durationMs={editDurationMs}
                                                    minLengthMs={MIN_REGION_DURATION_MS}
                                                    visibleStartMs={visibleWindow.start}
                                                    visibleEndMs={visibleWindow.end}
                                                    zoomMultiple={zoomMultiple}
                                                    playheadMs={playheadTimeMs}
                                                    neighbors={spanNeighbors(
                                                        selectedRanges.map((r) => ({ id: r.id, startMs: r.start, endMs: r.end })),
                                                        { id: part.id, startMs: part.start, endMs: part.end }
                                                    )}
                                                    onEdge={(edge, ms, cause) => {
                                                        // A release or use-playhead lands on the grid; a slide
                                                        // previews raw, and the carets stay a surgical escape.
                                                        const landed = cause === "slideEnd" || cause === "playhead" ? snapEdge(ms) : ms;
                                                        applyEdge(part.id, edge, landed);
                                                    }}
                                                />
                                            )}
                                        />
                                    )}
                                </View>

                                <View style={{ height: 24 }} />
                            </>
                        ) : (
                            <EditorTransformSection
                                playbackRate={transformState.playbackRate}
                                pitchShiftSemitones={transformState.pitchShiftSemitones}
                                supportsPitchPreview={previewTransport.isPitchPreviewAvailable}
                                onAdjustPlaybackRate={transformState.setPlaybackRate}
                                onAdjustPitchShift={transformState.setPitchShiftSemitones}
                            />
                        )}
                    </>
                ) : (
                    <Text style={editorLocalStyles.noFile}>{t("editor.noFile")}</Text>
                )}
            </TransportLayout>

            <HelpSheet
                visible={helpVisible}
                onClose={() => setHelpVisible(false)}
                thesis={EDITOR_HELP.thesis}
                items={EDITOR_HELP.items}
            />

            <EditorSaveSheet
                visible={exportFlow.exportModalVisible || exportFlow.transformExportModalVisible}
                operation={
                    exportFlow.transformExportModalVisible ? "transform" : exportFlow.exportOperation
                }
                summaryLine={
                    exportFlow.transformExportModalVisible
                        ? `${transformState.playbackRate.toFixed(2)}x · ${signedNumberText(
                              `${transformState.pitchShiftSemitones > 0 ? "+" : ""}${transformState.pitchShiftSemitones}`
                          )} ${t("player.semitones")}`
                        : undefined
                }
                sourceTitle={sourceClip?.title ?? ""}
                targetIdeaKind={targetIdea?.kind ?? null}
                keepRegions={keepRegions}
                removedMs={removeRegions.reduce((sum, region) => sum + (region.end - region.start), 0)}
                gridOutcomeLine={gridOutcomeLine}
                spliceNameDraft={
                    exportFlow.transformExportModalVisible
                        ? exportFlow.transformNameDraft
                        : exportFlow.spliceNameDraft
                }
                suggestedExportTitle={exportFlow.suggestedExportTitle}
                suggestedTitleFor={exportFlow.buildSuggestedTitle}
                removeOriginalAfterExport={exportFlow.removeOriginalAfterExport}
                saving={exportFlow.isExporting}
                onChangeSpliceNameDraft={
                    exportFlow.transformExportModalVisible
                        ? exportFlow.setTransformNameDraft
                        : exportFlow.setSpliceNameDraft
                }
                onToggleRemoveOriginalAfterExport={() =>
                    exportFlow.setRemoveOriginalAfterExport((prev) => !prev)
                }
                onClose={
                    exportFlow.transformExportModalVisible
                        ? exportFlow.closeTransformExportModal
                        : exportFlow.closeExportModal
                }
                onSave={() => {
                    if (exportFlow.transformExportModalVisible) {
                        void exportFlow.handleTransformSave();
                        return;
                    }
                    void exportFlow.handleExportSave();
                }}
            />
        </SafeAreaView>
    );
}
