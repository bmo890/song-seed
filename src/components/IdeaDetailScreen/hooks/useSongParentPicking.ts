import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, SongIdea } from "../../../types";

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
  const [parentPickState, setParentPickState] = useState<ParentPickState | null>(null);
  const clipMap = useMemo(() => buildClipMap(songClips), [songClips]);
  const primaryClipId = useMemo(
    () => songClips.find((clip) => clip.isPrimary)?.id ?? null,
    [songClips]
  );
  const parentPickInvalidTargetIds = useMemo(() => {
    if (!parentPickState) return [];
    const invalidTargetIds = new Set(parentPickState.sourceClipIds);
    const descendantIds = collectDescendantClipIds(songClips, parentPickState.appliedClipIds);
    descendantIds.forEach((clipId) => invalidTargetIds.add(clipId));
    if (primaryClipId) invalidTargetIds.add(primaryClipId);
    return Array.from(invalidTargetIds);
  }, [parentPickState, primaryClipId, songClips]);

  const parentPickPrompt =
    parentPickState?.appliedClipIds.length === 1
      ? "Tap the parent for this clip."
      : parentPickState
        ? `Tap the parent for these ${parentPickState.appliedClipIds.length} clips.`
        : "";
  const parentPickMeta = parentPickState
    ? "Only selected clips move. Their existing children stay in the old lineage."
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
    if (primaryClipId && uniqueClipIds.includes(primaryClipId)) {
      Alert.alert("Primary clip unavailable", "The primary clip stays outside the evolution tree for now. Deselect it and try again.");
      return null;
    }
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
    }, sourceClipIds.length === 1 ? "Clip moved" : "Clips moved");
    return true;
  }

  function handleStartSetParent(rawClipIds: string[], onPrepareTree: () => void) {
    const source = resolveParentEditingSource(rawClipIds);
    if (!source) return;
    const invalidTargetIds = new Set(source.sourceClipIds);
    const descendantIds = collectDescendantClipIds(songClips, source.appliedClipIds);
    descendantIds.forEach((clipId) => invalidTargetIds.add(clipId));
    if (primaryClipId) invalidTargetIds.add(primaryClipId);
    const hasValidTarget = songClips.some((clip) => !invalidTargetIds.has(clip.id));
    if (!hasValidTarget) {
      Alert.alert("No valid parent clips", "There is no other clip in this song that can be used as a parent yet.");
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
      (undo, _message) => onUndo(undo, source.appliedClipIds.length === 1 ? "Clip moved to root" : "Clips moved to root")
    );
    if (!changed) {
      Alert.alert("Already root", "Those clips are already at the top level.");
      return;
    }
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
      Alert.alert("Already attached", "Those clips already branch from that parent.");
      return;
    }
    const confirmationMessage =
      parentPickState.appliedClipIds.length === 1
        ? `Make "${clipMap.get(parentPickState.appliedClipIds[0])?.title ?? "this clip"}" a variation of "${targetClip.title}"?`
        : `Make ${parentPickState.appliedClipIds.length} clips variations of "${targetClip.title}"?`;
    Alert.alert("Set parent clip?", confirmationMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          applyParentChange(parentPickState.appliedClipIds, targetClipId, onUndo);
          setParentPickState(null);
        },
      },
    ]);
  }

  return {
    parentPickState,
    setParentPickState,
    parentPickInvalidTargetIds,
    parentPickPrompt,
    parentPickMeta,
    handleStartSetParent,
    handleMakeRoot,
    handlePickParentTarget,
    clipMap,
    primaryClipId,
  };
}
