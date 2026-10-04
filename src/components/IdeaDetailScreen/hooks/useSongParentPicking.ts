import { useMemo, useState } from "react";
import { threadClipsOldestToNewest } from "../../../domain/clipLineageTitles";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, SongIdea } from "../../../types";
import { useTranslation } from "react-i18next";

type ParentPickState = {
  sourceClipIds: string[];
  appliedClipIds: string[];
};

type ParentChange = {
  parentId: string | null;
  parentAssignedAt?: number;
};

function buildClipMap(clips: ClipVersion[]) {
  return new Map(clips.map((clip) => [clip.id, clip]));
}

function collectDescendantClipIds(clips: ClipVersion[], rootClipIds: string[]) {
  const childrenByParentId = new Map<string, string[]>();
  clips.forEach((clip) => {
    if (!clip.parentClipId) return;
    const current = childrenByParentId.get(clip.parentClipId) ?? [];
    current.push(clip.id);
    childrenByParentId.set(clip.parentClipId, current);
  });

  const descendants = new Set<string>();
  const stack = [...rootClipIds];
  while (stack.length > 0) {
    const nextParentId = stack.pop();
    if (!nextParentId) continue;
    (childrenByParentId.get(nextParentId) ?? []).forEach((childId) => {
      if (descendants.has(childId)) return;
      descendants.add(childId);
      stack.push(childId);
    });
  }
  return descendants;
}

export function useSongParentPicking(selectedIdea: SongIdea | null | undefined, songClips: ClipVersion[]) {
  const { t } = useTranslation();
  const [parentPickState, setParentPickState] = useState<ParentPickState | null>(null);
  const clipMap = useMemo(() => buildClipMap(songClips), [songClips]);
  // The primary take is an ordinary member of the tree (2026-10-03): it can be
  // linked as a version of another take and be the parent of one. Only a clip's
  // own descendants (and itself) are off limits as parents.
  const parentPickInvalidTargetIds = useMemo(() => {
    if (!parentPickState) return [];
    const invalidTargetIds = new Set(parentPickState.sourceClipIds);
    const descendantIds = collectDescendantClipIds(songClips, parentPickState.appliedClipIds);
    descendantIds.forEach((clipId) => invalidTargetIds.add(clipId));
    return Array.from(invalidTargetIds);
  }, [parentPickState, songClips]);

  const parentPickPrompt = parentPickState
    ? t("songDetail.parentPrompt", { count: parentPickState.appliedClipIds.length })
    : "";
  const parentPickMeta = parentPickState
    ? t("songDetail.parentMeta")
    : null;

  function updateClipParents(targetIdeaId: string, parentByClipId: Map<string, ParentChange>) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== targetIdeaId
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                parentByClipId.has(clip.id)
                  ? (() => {
                      const change = parentByClipId.get(clip.id)!;
                      return {
                        ...clip,
                        parentClipId: change.parentId ?? undefined,
                        parentAssignedAt: change.parentAssignedAt,
                      };
                    })()
                  : clip
              ),
            }
      )
    );
  }

  function resolveParentEditingSource(rawClipIds: string[]) {
    if (!selectedIdea || selectedIdea.kind !== "project") return null;
    const uniqueClipIds = Array.from(new Set(rawClipIds)).filter((clipId) => clipMap.has(clipId));
    if (uniqueClipIds.length === 0) return null;
    return { sourceClipIds: uniqueClipIds, appliedClipIds: uniqueClipIds };
  }

  function applyParentChange(sourceClipIds: string[], nextParentClipId: string | null, onUndo: (undo: () => void, message: string) => void) {
    if (!selectedIdea || selectedIdea.kind !== "project") return false;
    const sourceIdSet = new Set(sourceClipIds);
    const previousParentByClipId = new Map<string, ParentChange>();
    const changedClipIds = sourceClipIds.filter(
      (clipId) => (clipMap.get(clipId)?.parentClipId ?? null) !== nextParentClipId
    );
    if (changedClipIds.length === 0) return false;
    const nextParentByClipId = new Map<string, ParentChange>();
    const parentAssignedAt = Date.now();
    const getDetachedChildParentId = (clipId: string) => {
      let parentId = clipMap.get(clipId)?.parentClipId ?? null;
      const visitedIds = new Set<string>();
      while (parentId && sourceIdSet.has(parentId) && !visitedIds.has(parentId)) {
        visitedIds.add(parentId);
        parentId = clipMap.get(parentId)?.parentClipId ?? null;
      }
      return parentId;
    };

    changedClipIds.forEach((clipId) => {
      const clip = clipMap.get(clipId);
      previousParentByClipId.set(clipId, {
        parentId: clip?.parentClipId ?? null,
        parentAssignedAt: clip?.parentAssignedAt,
      });
      nextParentByClipId.set(clipId, {
        parentId: nextParentClipId,
        parentAssignedAt: nextParentClipId ? parentAssignedAt : undefined,
      });

      const detachedChildParentId = getDetachedChildParentId(clipId);
      songClips.forEach((clip) => {
        if (clip.parentClipId !== clipId || sourceIdSet.has(clip.id)) return;
        if (!previousParentByClipId.has(clip.id)) {
          previousParentByClipId.set(clip.id, {
            parentId: clip.parentClipId ?? null,
            parentAssignedAt: clip.parentAssignedAt,
          });
        }
        nextParentByClipId.set(clip.id, {
          parentId: detachedChildParentId,
          parentAssignedAt: detachedChildParentId ? parentAssignedAt : undefined,
        });
      });
    });

    updateClipParents(selectedIdea.id, nextParentByClipId);
    onUndo(() => {
      const restoredParentByClipId = new Map<string, ParentChange>();
      previousParentByClipId.forEach((change, clipId) => {
        restoredParentByClipId.set(clipId, change);
      });
      updateClipParents(selectedIdea.id, restoredParentByClipId);
    }, sourceClipIds.length === 1 ? t("songDetail.clipMoved") : t("songDetail.clipsMoved"));
    return true;
  }

  function handleStartSetParent(rawClipIds: string[], onPrepareTree: () => void) {
    const source = resolveParentEditingSource(rawClipIds);
    if (!source) return;
    const invalidTargetIds = new Set(source.sourceClipIds);
    const descendantIds = collectDescendantClipIds(songClips, source.appliedClipIds);
    descendantIds.forEach((clipId) => invalidTargetIds.add(clipId));
    const hasValidTarget = songClips.some((clip) => !invalidTargetIds.has(clip.id));
    if (!hasValidTarget) {
      AppAlert.info(t("songDetail.noValidParents"), t("songDetail.noValidParentsBody"));
      return;
    }
    onPrepareTree();
    setParentPickState(source);
  }

  function handleMakeRoot(rawClipIds: string[], onUndo: (undo: () => void, message: string) => void) {
    const source = resolveParentEditingSource(rawClipIds);
    if (!source) return;
    const changed = applyParentChange(
      source.appliedClipIds,
      null,
      (undo, _message) => onUndo(undo, source.appliedClipIds.length === 1 ? t("songDetail.clipMovedRoot") : t("songDetail.clipsMovedRoot"))
    );
    if (!changed) {
      AppAlert.info(t("songDetail.alreadyRoot"), t("songDetail.alreadyRootBody"));
      return;
    }
    setParentPickState(null);
  }

  /**
   * Several selected takes become ONE thread, oldest first (2026-10-04): each a
   * version of the one before it, the newest the head. Titles stay the writer's.
   * The explicit way to build a thread inside a sketch — a new sketch never
   * threads its clips on its own.
   */
  function handleCombineIntoThread(rawClipIds: string[], onUndo: (undo: () => void, message: string) => void) {
    const source = resolveParentEditingSource(rawClipIds);
    if (!source || source.appliedClipIds.length < 2 || !selectedIdea) return;
    const clips = source.appliedClipIds
      .map((clipId) => clipMap.get(clipId))
      .filter((clip): clip is ClipVersion => !!clip);
    const threaded = threadClipsOldestToNewest(clips);
    const previousParentByClipId = new Map<string, ParentChange>();
    const nextParentByClipId = new Map<string, ParentChange>();
    threaded.forEach((clip) => {
      const before = clipMap.get(clip.id)!;
      previousParentByClipId.set(clip.id, {
        parentId: before.parentClipId ?? null,
        parentAssignedAt: before.parentAssignedAt,
      });
      nextParentByClipId.set(clip.id, {
        parentId: clip.parentClipId ?? null,
        parentAssignedAt: clip.parentAssignedAt,
      });
    });
    updateClipParents(selectedIdea.id, nextParentByClipId);
    onUndo(() => updateClipParents(selectedIdea.id, previousParentByClipId), t("songDetail.combinedThread"));
    setParentPickState(null);
  }

  function handlePickParentTarget(targetClipId: string, onUndo: (undo: () => void, message: string) => void) {
    if (!selectedIdea || selectedIdea.kind !== "project" || !parentPickState) return;
    const targetClip = clipMap.get(targetClipId);
    if (!targetClip) return;
    const hasActualChange = parentPickState.appliedClipIds.some(
      (clipId) => (clipMap.get(clipId)?.parentClipId ?? null) !== targetClipId
    );
    if (!hasActualChange) {
      setParentPickState(null);
      AppAlert.info(t("songDetail.alreadyAttached"), t("songDetail.alreadyAttachedBody"));
      return;
    }
    const confirmationMessage =
      parentPickState.appliedClipIds.length === 1
        ? t("songDetail.setParentOne", { clip: clipMap.get(parentPickState.appliedClipIds[0])?.title ?? t("songDetail.thisClip"), parent: targetClip.title })
        : t("songDetail.setParentMany", { count: parentPickState.appliedClipIds.length, parent: targetClip.title });
    AppAlert.confirm(t("songDetail.setParentTitle"), confirmationMessage, () => {
      applyParentChange(parentPickState.appliedClipIds, targetClipId, onUndo);
      setParentPickState(null);
    }, { confirmLabel: t("songDetail.confirm") });
  }

  return {
    parentPickState,
    setParentPickState,
    parentPickInvalidTargetIds,
    parentPickPrompt,
    parentPickMeta,
    handleStartSetParent,
    handleMakeRoot,
    handleCombineIntoThread,
    handlePickParentTarget,
    clipMap,
  };
}
