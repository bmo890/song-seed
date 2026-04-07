import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { StackActions } from "@react-navigation/native";
import { trimAudio, type AudioAnalysis } from "@siteed/audio-studio";
import { loadManagedAudioMetadata } from "../../../services/audioStorage";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, EditRegion, SongIdea } from "../../../types";
import { genClipTitle } from "../../../utils";
import {
  buildClipId,
  buildFallbackClipTitle,
  cloneEditRegions,
  clonePracticeMarkers,
  cloneTags,
  type EditableSelection,
} from "../helpers";

type MinimalPlayer = {
  seekTo: (seconds: number) => Promise<void> | void;
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
};

type UseEditorExportFlowArgs = {
  ideaId: string;
  clipId: string;
  audioUri?: string | null;
  analysisData: AudioAnalysis | null;
  targetIdea: SongIdea | null;
  sourceClip: ClipVersion | null;
  keepRegions: EditableSelection[];
  removeRegions: EditableSelection[];
  playheadTimeMs: number;
  isPlayerPlaying: boolean;
  player: MinimalPlayer;
  navigation: any;
  updateIdeas: (updater: (ideas: SongIdea[]) => SongIdea[]) => void;
  setSelectedIdeaId: (ideaId: string | null) => void;
  markRecentlyAdded: (ids: string[]) => void;
  safePause: () => void;
  safePlay: () => void;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  cancelTransportScrub: () => Promise<void>;
};

export function useEditorExportFlow({
  ideaId,
  clipId,
  audioUri,
  analysisData,
  targetIdea,
  sourceClip,
  keepRegions,
  removeRegions,
  playheadTimeMs,
  isPlayerPlaying,
  player,
  navigation,
  updateIdeas,
  setSelectedIdeaId,
  markRecentlyAdded,
  safePause,
  safePlay,
  setCurrentTime,
  cancelTransportScrub,
}: UseEditorExportFlowArgs) {
  const previewWasPlayingRef = useRef(false);
  const previewPausePromiseRef = useRef<Promise<void> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [extractNameDrafts, setExtractNameDrafts] = useState<Record<string, string>>({});
  const [spliceNameDraft, setSpliceNameDraft] = useState("");
  const [removeOriginalAfterExport, setRemoveOriginalAfterExport] = useState(false);
  const [exportOperation, setExportOperation] = useState<"extract" | "splice">("extract");
  const [previewRegionId, setPreviewRegionId] = useState<string | null>(null);

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

  const resetPreviewScrubSession = () => {
    previewWasPlayingRef.current = false;
    previewPausePromiseRef.current = null;
  };

  const buildInitialExtractDrafts = () =>
    keepRegions.reduce<Record<string, string>>((acc, region) => {
      acc[region.id] = "";
      return acc;
    }, {});

  useEffect(() => {
    if (!exportModalVisible || exportOperation !== "extract") return;
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
  }, [exportModalVisible, exportOperation, keepRegionIdsKey, keepRegions]);

  useEffect(() => {
    if (!previewRegionId) return;
    const activeRegion = keepRegions.find((region) => region.id === previewRegionId);
    if (!activeRegion) {
      resetPreviewScrubSession();
      setPreviewRegionId(null);
      return;
    }
    if (isPlayerPlaying && playheadTimeMs >= activeRegion.end) {
      safePause();
      resetPreviewScrubSession();
      setPreviewRegionId(null);
      setCurrentTime(activeRegion.end);
      try {
        player.seekTo(activeRegion.end / 1000);
      } catch (error) {
        console.warn("Preview stop seek error:", error);
      }
    }
  }, [isPlayerPlaying, keepRegions, playheadTimeMs, player, previewRegionId, safePause, setCurrentTime]);

  useEffect(() => {
    if (!exportModalVisible || !previewRegionId) return;
    safePause();
    resetPreviewScrubSession();
    setPreviewRegionId(null);
  }, [exportModalVisible, previewRegionId, safePause]);

  const openExportModal = () => {
    const keepCount = keepRegions.length;
    const removeCount = removeRegions.length;

    if (keepCount === 0 && removeCount === 0) {
      Alert.alert("No Edits", "Please add some active regions before exporting.");
      return;
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

  const closeExportModal = () => {
    safePause();
    resetPreviewScrubSession();
    setPreviewRegionId(null);
    setExportModalVisible(false);
  };

  const buildExtractTitles = () =>
    keepRegions.map((region, index) => extractNameDrafts[region.id]?.trim() || buildSuggestedTitle(index));

  const buildSpliceTitle = () => spliceNameDraft.trim() || suggestedExportTitle;

  const buildDerivedClipDraft = (
    override: Pick<ClipVersion, "title" | "audioUri" | "durationMs" | "waveformPeaks" | "editRegions">
  ): Omit<ClipVersion, "id" | "createdAt" | "isPrimary"> | null => {
    if (!sourceClip) return null;

    const parentClipId =
      targetIdea?.kind === "project"
        ? removeOriginalAfterExport
          ? sourceClip.parentClipId
          : clipId
        : undefined;

    return {
      title: override.title,
      notes: sourceClip.notes,
      importedAt: sourceClip.importedAt ?? targetIdea?.importedAt,
      sourceCreatedAt: sourceClip.sourceCreatedAt ?? targetIdea?.sourceCreatedAt,
      parentClipId,
      audioUri: override.audioUri,
      sourceAudioUri: sourceClip.sourceAudioUri ?? sourceClip.audioUri,
      durationMs: override.durationMs,
      waveformPeaks: override.waveformPeaks,
      editRegions: [...(cloneEditRegions(sourceClip.editRegions) ?? []), ...(override.editRegions ?? [])],
      tags: cloneTags(sourceClip.tags),
      practiceMarkers: clonePracticeMarkers(sourceClip.practiceMarkers),
    };
  };

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
        notes: targetIdea.notes,
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId: targetIdea.collectionId,
        clips: [{ ...clip, isPrimary: true, parentClipId: undefined }],
        createdAt: now + index,
        importedAt: targetIdea.importedAt ?? clip.importedAt,
        sourceCreatedAt: targetIdea.sourceCreatedAt ?? clip.sourceCreatedAt,
        lastActivityAt: now + index,
      }));

      updateIdeas((prev) => {
        const remainingIdeas = removeOriginalAfterExport ? prev.filter((idea) => idea.id !== ideaId) : [...prev];
        return [...createdIdeas, ...remainingIdeas];
      });
      useStore
        .getState()
        .logActivityEvents(
          createdIdeas
            .map((idea, index) => ({
              at: now + index,
              workspaceId: useStore.getState().activeWorkspaceId ?? "",
              collectionId: idea.collectionId,
              ideaId: idea.id,
              ideaKind: "clip" as const,
              ideaTitle: idea.title,
              clipId: idea.clips[0]?.id ?? null,
              metric: "created" as const,
              source: "audio-edit" as const,
            }))
            .filter((event) => !!event.workspaceId)
        );

      return createdIdeas.map((idea) => idea.id);
    }

    updateIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId) return idea;

        const remainingClips = removeOriginalAfterExport ? idea.clips.filter((clip) => clip.id !== clipId) : [...idea.clips];
        const sourceWasPrimary = !!idea.clips.find((clip) => clip.id === clipId)?.isPrimary;
        const noPrimaryRemaining = !remainingClips.some((clip) => clip.isPrimary);

        const nextNewClips = createdClips.map((clip, index) => ({
          ...clip,
          isPrimary: removeOriginalAfterExport && (sourceWasPrimary || noPrimaryRemaining) && index === 0,
        }));
        const repairedRemainingClips =
          removeOriginalAfterExport && nextNewClips[0]
            ? remainingClips.map((clip) =>
                clip.parentClipId === clipId ? { ...clip, parentClipId: nextNewClips[0]!.id } : clip
              )
            : remainingClips;

        const nextIdea = {
          ...idea,
          title:
            idea.kind === "clip" && removeOriginalAfterExport && nextNewClips.length === 1
              ? nextNewClips[0]!.title
              : idea.title,
          clips: [...nextNewClips, ...repairedRemainingClips],
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
    if (isSameRegion && isPlayerPlaying) {
      safePause();
      resetPreviewScrubSession();
      setPreviewRegionId(null);
      return;
    }

    await cancelTransportScrub();
    safePause();
    setPreviewRegionId(region.id);
    setCurrentTime(region.start);

    try {
      await player.seekTo(region.start / 1000);
      await player.play();
    } catch (error) {
      console.warn("Preview error:", error);
      setPreviewRegionId(null);
    }
  };

  const beginRegionPreviewScrub = async (region: EditableSelection) => {
    const wasPreviewPlaying = previewRegionId === region.id && isPlayerPlaying;
    previewWasPlayingRef.current = wasPreviewPlaying;
    setPreviewRegionId(region.id);
    previewPausePromiseRef.current = isPlayerPlaying ? Promise.resolve(player.pause()) : Promise.resolve();
    try {
      await previewPausePromiseRef.current;
    } catch (error) {
      console.warn("Preview scrub pause error:", error);
    }
  };

  const seekRegionPreview = async (region: EditableSelection, relativeTimeMs: number) => {
    const targetTime = Math.max(region.start, Math.min(region.end, region.start + relativeTimeMs));
    try {
      await previewPausePromiseRef.current;
    } catch (error) {
      console.warn("Preview scrub settle error:", error);
    }
    setPreviewRegionId(region.id);
    setCurrentTime((prev) => (prev === targetTime ? prev : targetTime));

    try {
      await player.seekTo(targetTime / 1000);
      if (previewWasPlayingRef.current) {
        safePlay();
      }
    } catch (error) {
      console.warn("Preview seek error:", error);
    } finally {
      previewWasPlayingRef.current = false;
      previewPausePromiseRef.current = null;
    }
  };

  const cancelRegionPreviewScrub = async () => {
    try {
      await previewPausePromiseRef.current;
    } catch (error) {
      console.warn("Preview scrub cancel settle error:", error);
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
        const result = await trimAudio({
          fileUri: audioUri,
          mode: "single",
          startTimeMs: region.start,
          endTimeMs: region.end,
        });
        const metadata = await loadManagedAudioMetadata(
          result.uri,
          `${clipId}-${region.id}-${index}`,
          region.end - region.start
        );
        const derivedClip = buildDerivedClipDraft({
          title: titles[index] ?? genClipTitle(targetIdea?.title ?? "Clip", index + 1),
          audioUri: result.uri,
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
        if (derivedClip) {
          exportedClips.push(derivedClip);
        }
      }

      const newClipIds = commitExportedClips(exportedClips);
      finishExport(newClipIds);
    } catch {
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
      const result = await trimAudio({
        fileUri: audioUri,
        mode: "remove",
        ranges: removeRegions.map((region) => ({ startTimeMs: region.start, endTimeMs: region.end })),
      });
      const keptDurationMs = Math.max(
        0,
        removeRegions.reduce((total, region) => total - (region.end - region.start), analysisData.durationMs)
      );
      const metadata = await loadManagedAudioMetadata(result.uri, `${clipId}-splice-${removeRegions.length}`, keptDurationMs);

      const derivedClip = buildDerivedClipDraft({
        title,
        audioUri: result.uri,
        durationMs: metadata.durationMs,
        waveformPeaks: metadata.waveformPeaks,
        editRegions: removeRegions.map<EditRegion>((region) => ({
          id: region.id,
          startMs: region.start,
          endMs: region.end,
          type: "remove",
        })),
      });
      const newClipIds = derivedClip ? commitExportedClips([derivedClip]) : [];

      finishExport(newClipIds);
    } catch {
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

  return {
    isExporting,
    exportModalVisible,
    extractNameDrafts,
    setExtractNameDrafts,
    spliceNameDraft,
    setSpliceNameDraft,
    removeOriginalAfterExport,
    setRemoveOriginalAfterExport,
    exportOperation,
    setExportOperation,
    previewRegionId,
    activeExportCount,
    suggestedExportTitle,
    buildSuggestedTitle,
    openExportModal,
    closeExportModal,
    toggleRegionPreview,
    beginRegionPreviewScrub,
    seekRegionPreview,
    cancelRegionPreviewScrub,
    handleExportSave,
  };
}
