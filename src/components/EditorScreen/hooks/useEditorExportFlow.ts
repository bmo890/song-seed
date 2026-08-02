import { useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { AppAlert } from "../../common/AppAlert";
import { StackActions } from "@react-navigation/native";
import { type AudioAnalysis } from "@siteed/audio-studio";
import { trimAudioRanges } from "../../../services/audioTrim";
import { ensureWaveformSidecar } from "../../../services/waveformSidecar";
import { importAudioAsset } from "../../../services/audioStorage";
import { renderPitchShiftedFile } from "../../../services/pitchShift";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, EditRegion, SongIdea } from "../../../types";
import { genClipTitle } from "../../../utils";
import { haptic } from "../../../design/haptics";
import { toast } from "../../common/toastStore";
import {
  complementSpans,
  remapClipForRate,
  remapClipForSpans,
  type ClipEditRemap,
  type GridPolicy,
} from "../../../domain/clipEditRemap";
import {
  buildClipId,
  buildFallbackClipTitle,
  cloneEditRegions,
  cloneTags,
  type EditableSelection,
} from "../helpers";
import { useTranslation } from "react-i18next";

type MinimalPlayer = {
  seekTo: (seconds: number) => Promise<void> | void;
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
};

/**
 * Copy a freshly-rendered file (trim/splice/transform output, which the native libraries
 * write to the app's temp/files dir) into managed SongNook storage, then remove the temp
 * source. Editor-created clips must reference managed audio so they are rebased on
 * reinstall/restore and included in disaster-recovery backups — otherwise they'd point at
 * an unmanaged (and on iOS, purgeable temporary) path.
 */
async function importRenderedFileToManaged(renderedUri: string) {
  const baseName = renderedUri.split("/").pop() || "edit.wav";
  const imported = await importAudioAsset({ uri: renderedUri, name: baseName }, buildClipId(), {
    // The save spinner is on screen: decode now, even against dock playback.
    decodeMode: "interactive",
  });
  if (imported.audioUri !== renderedUri) {
    await FileSystem.deleteAsync(renderedUri, { idempotent: true }).catch(() => {});
  }
  return imported;
}

type UseEditorExportFlowArgs = {
  ideaId: string;
  clipId: string;
  audioUri?: string | null;
  analysisData: AudioAnalysis | null;
  targetIdea: SongIdea | null;
  sourceClip: ClipVersion | null;
  keepRegions: EditableSelection[];
  removeRegions: EditableSelection[];
  /** Whether the musician is editing to the bar grid or reaching freely — decides what
   *  an edit that breaks the grid leaves behind. The toggle that sets this ships with
   *  snapping; until then a gridded clip edits in the safe `preserve` mode. */
  gridPolicy?: GridPolicy;
  transformPitchShiftSemitones: number;
  transformPlaybackRate: number;
  hasActiveTransforms: boolean;
  playheadTimeMs: number;
  player: MinimalPlayer;
  navigation: any;
  updateIdeas: (updater: (ideas: SongIdea[]) => SongIdea[]) => void;
  setSelectedIdeaId: (ideaId: string | null) => void;
  markRecentlyAdded: (ids: string[]) => void;
  safePause: () => Promise<void> | void;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
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
  gridPolicy = "preserve",
  transformPitchShiftSemitones,
  transformPlaybackRate,
  hasActiveTransforms,
  playheadTimeMs,
  player,
  navigation,
  updateIdeas,
  setSelectedIdeaId,
  markRecentlyAdded,
  safePause,
  setCurrentTime,
}: UseEditorExportFlowArgs) {
  const { t } = useTranslation();
  const previewWasPlayingRef = useRef(false);
  const previewPausePromiseRef = useRef<Promise<void> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [spliceNameDraft, setSpliceNameDraft] = useState("");
  const [removeOriginalAfterExport, setRemoveOriginalAfterExport] = useState(false);
  const [transformExportModalVisible, setTransformExportModalVisible] = useState(false);
  const [transformNameDraft, setTransformNameDraft] = useState("");

  // Intent is global (`setIntent` retypes every part), so exactly one of these lists is
  // ever populated — the operation is derived, never chosen. The modal used to offer a
  // switcher for the mixed case, which could not occur.
  const exportOperation: "extract" | "splice" = keepRegions.length > 0 ? "extract" : "splice";

  const keepRegionIdsKey = keepRegions.map((region) => region.id).join("|");
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

  const openExportModal = () => {
    const keepCount = keepRegions.length;
    const removeCount = removeRegions.length;

    if (keepCount === 0 && removeCount === 0) {
      AppAlert.info(t("editor.noEdits"), t("editor.noEditsBody"));
      return;
    }

    void Promise.resolve(safePause()).catch((error) => {
      console.warn("Preview open pause error:", error);
    });
    setSpliceNameDraft("");
    setRemoveOriginalAfterExport(false);
    setExportModalVisible(true);
  };

  const closeExportModal = () => {
    void Promise.resolve(safePause()).catch((error) => {
      console.warn("Preview close pause error:", error);
    });
    setExportModalVisible(false);
  };

  const openTransformExportModal = () => {
    if (!hasActiveTransforms) {
      AppAlert.info(t("editor.noTransform"), t("editor.noTransformBody"));
      return;
    }

    void Promise.resolve(safePause()).catch((error) => {
      console.warn("Transform modal open pause error:", error);
    });
    setTransformNameDraft("");
    setRemoveOriginalAfterExport(false);
    setTransformExportModalVisible(true);
  };

  const closeTransformExportModal = () => {
    void Promise.resolve(safePause()).catch((error) => {
      console.warn("Transform modal close pause error:", error);
    });
    setTransformExportModalVisible(false);
  };

  const buildExtractTitles = () =>
    keepRegions.map((region, index) => region.title?.trim() || buildSuggestedTitle(index));

  const buildSpliceTitle = () => spliceNameDraft.trim() || suggestedExportTitle;

  /**
   * Build the clip an edit produces. `remap` re-expresses everything musical the source
   * carried — pins, sections, the recording grid, the detected tempo — against the new
   * timeline (domain/clipEditRemap). Carrying any of it verbatim would point it at the
   * wrong moment in a file that is now a different length.
   */
  const buildDerivedClipDraft = (
    override: Pick<ClipVersion, "title" | "audioUri" | "durationMs" | "waveformPeaks" | "editRegions">,
    remap: ClipEditRemap
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
      practiceMarkers: remap.practiceMarkers,
      sections: remap.sections,
      recordingGrid: remap.recordingGrid,
      analysis: remap.analysis,
    };
  };

  const finishExport = (highlightIds: string[]) => {
    if (highlightIds.length > 0) {
      markRecentlyAdded(highlightIds);
      // Quiet completion: the editor pops away — the toast confirms the save landed.
      haptic.success();
      toast(
        t("editor.clipSaved", { count: highlightIds.length }),
        "checkmark-circle-outline"
      );
    }
    setExportModalVisible(false);
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

  const exportExtract = async () => {
    if (!audioUri || !sourceClip) return;

    setIsExporting(true);
    try {
      await safePause();
      console.log("[editor:export] extract start", { regions: keepRegions.length });
      const titles = buildExtractTitles();
      const exportedClips: Omit<ClipVersion, "id" | "createdAt" | "isPrimary">[] = [];

      for (const [index, region] of keepRegions.entries()) {
        console.log("[editor:export] extract region", {
          index,
          startMs: region.start,
          endMs: region.end,
        });
        const result = await trimAudioRanges({
          fileUri: audioUri,
          mode: "single",
          startTimeMs: region.start,
          endTimeMs: region.end,
        });
        const metadata = await importRenderedFileToManaged(result.uri);
        void ensureWaveformSidecar(metadata.audioUri, metadata.durationMs);
        const remap = remapClipForSpans(
          sourceClip,
          [{ startMs: region.start, endMs: region.end }],
          analysisData?.durationMs ?? sourceClip.durationMs ?? region.end,
          { gridPolicy }
        );
        console.log("[editor:export] extract grid", { index, outcome: remap.gridOutcome });
        const derivedClip = buildDerivedClipDraft(
          {
            title: titles[index] ?? genClipTitle(targetIdea?.title ?? t("editor.clipFallback"), index + 1),
            audioUri: metadata.audioUri,
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
          },
          remap
        );
        if (derivedClip) {
          exportedClips.push(derivedClip);
        }
      }

      const newClipIds = commitExportedClips(exportedClips);
      console.log("[editor:export] extract done", { newClipIds });
      finishExport(newClipIds);
    } catch (error) {
      console.warn("Editor extract failed", error);
      AppAlert.info(t("editor.exportError"), t("editor.extractFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  const exportSplice = async () => {
    if (!audioUri || !sourceClip || !analysisData) return;

    setIsExporting(true);
    try {
      await safePause();
      console.log("[editor:export] splice start", {
        ranges: removeRegions.map((region) => ({ startMs: region.start, endMs: region.end })),
      });
      const title = buildSpliceTitle();
      const result = await trimAudioRanges({
        fileUri: audioUri,
        mode: "remove",
        ranges: removeRegions.map((region) => ({ startTimeMs: region.start, endTimeMs: region.end })),
        durationMs: analysisData.durationMs,
      });
      const metadata = await importRenderedFileToManaged(result.uri);
      void ensureWaveformSidecar(metadata.audioUri, metadata.durationMs);

      // The same kept spans the renderer just concatenated, so the audio and its
      // musical metadata cannot disagree about what survived.
      const remap = remapClipForSpans(
        sourceClip,
        complementSpans(
          removeRegions.map((region) => ({ startMs: region.start, endMs: region.end })),
          analysisData.durationMs
        ),
        analysisData.durationMs,
        { gridPolicy }
      );
      console.log("[editor:export] splice grid", { outcome: remap.gridOutcome });

      const derivedClip = buildDerivedClipDraft(
        {
          title,
          audioUri: metadata.audioUri,
          durationMs: metadata.durationMs,
          waveformPeaks: metadata.waveformPeaks,
          editRegions: removeRegions.map<EditRegion>((region) => ({
            id: region.id,
            startMs: region.start,
            endMs: region.end,
            type: "remove",
          })),
        },
        remap
      );
      const newClipIds = derivedClip ? commitExportedClips([derivedClip]) : [];
      console.log("[editor:export] splice done", { newClipIds });

      finishExport(newClipIds);
    } catch (error) {
      console.warn("Editor splice failed", error);
      AppAlert.info(t("editor.exportError"), t("editor.spliceFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  const exportTransform = async () => {
    if (!audioUri || !sourceClip) return;

    setIsExporting(true);
    try {
      await safePause();
      console.log("[editor:export] transform start", {
        semitones: transformPitchShiftSemitones,
        playbackRate: transformPlaybackRate,
      });
      const title = transformNameDraft.trim() || suggestedExportTitle;
      const result = await renderPitchShiftedFile({
        inputUri: audioUri,
        semitones: transformPitchShiftSemitones,
        playbackRate: transformPlaybackRate,
        outputFileName: title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || undefined,
      });
      const metadata = await importRenderedFileToManaged(result.outputUri);
      void ensureWaveformSidecar(metadata.audioUri, metadata.durationMs);
      // A rate change stretches the timeline: every pin, section and tempo scales with it.
      const renderedDurationMs =
        metadata.durationMs ??
        (analysisData?.durationMs ?? sourceClip.durationMs ?? 0) / (transformPlaybackRate || 1);
      const remap = remapClipForRate(sourceClip, transformPlaybackRate, renderedDurationMs);
      console.log("[editor:export] transform grid", { outcome: remap.gridOutcome });
      const derivedClip = buildDerivedClipDraft(
        {
          title,
          audioUri: metadata.audioUri,
          durationMs: metadata.durationMs,
          waveformPeaks: metadata.waveformPeaks,
          editRegions: [],
        },
        remap
      );
      const newClipIds = derivedClip ? commitExportedClips([derivedClip]) : [];
      console.log("[editor:export] transform done", { newClipIds });
      setTransformExportModalVisible(false);
      finishExport(newClipIds);
    } catch (error) {
      console.warn("Editor transform save failed", error);
      AppAlert.info(
        t("editor.transformSaveError"),
        error instanceof Error ? error.message : t("editor.transformSaveFailed")
      );
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
    spliceNameDraft,
    setSpliceNameDraft,
    removeOriginalAfterExport,
    setRemoveOriginalAfterExport,
    exportOperation,
    suggestedExportTitle,
    buildSuggestedTitle,
    openExportModal,
    closeExportModal,
    handleExportSave,
    transformExportModalVisible,
    transformNameDraft,
    setTransformNameDraft,
    openTransformExportModal,
    closeTransformExportModal,
    handleTransformSave: exportTransform,
  };
}
