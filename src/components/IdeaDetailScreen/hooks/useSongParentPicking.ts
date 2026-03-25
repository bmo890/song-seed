import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, SongIdea } from "../../../types";

type ParentPickState = {
  sourceClipIds: string[];
  appliedClipIds: string[];
};

function buildClipMap(clips: ClipVersion[]) {
  return new Map(clips.map((clip) => [clip.id, clip]));
}

function getTopLevelClipIds(clips: ClipVersion[], clipIds: string[]) {
  const clipMap = buildClipMap(clips);
  const selectedIdSet = new Set(clipIds);

  return clipIds.filter((clipId) => {
    const visitedIds = new Set<string>();
    let parentId = clipMap.get(clipId)?.parentClipId;

    while (parentId && !visitedIds.has(parentId)) {
      if (selectedIdSet.has(parentId)) return false;
      visitedIds.add(parentId);
      parentId = clipMap.get(parentId)?.parentClipId;
    }

    return true;
  });
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
      ? "Tap the clip this branches from."
      : parentPickState
        ? `Tap the clip these ${parentPickState.appliedClipIds.length} clips branch from.`
        : "";
  const parentPickMeta =
    parentPickState &&
    parentPickState.sourceClipIds.length !== parentPickState.appliedClipIds.length
      ? `${parentPickState.sourceClipIds.length} selected, ${parentPickState.appliedClipIds.length} top-level clips will move together.`
      : null;

  function updateClipParents(targetIdeaId: string, parentByClipId: Map<string, string | null>) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== targetIdeaId
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                parentByClipId.has(clip.id)
                  ? { ...clip, parentClipId: parentByClipId.get(clip.id) ?? undefined }
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
    const topLevelClipIds = getTopLevelClipIds(songClips, uniqueClipIds);
    if (topLevelClipIds.length === 0) return null;
    return { sourceClipIds: uniqueClipIds, appliedClipIds: topLevelClipIds };
  }

  function applyParentChange(sourceClipIds: string[], nextParentClipId: string | null, onUndo: (undo: () => void, message: string) => void) {
    if (!selectedIdea || selectedIdea.kind !== "project") return false;
    const previousParentByClipId = new Map<string, string | null>();
    sourceClipIds.forEach((clipId) => {
      previousParentByClipId.set(clipId, clipMap.get(clipId)?.parentClipId ?? null);
    });
    const changedClipIds = sourceClipIds.filter(
      (clipId) => (clipMap.get(clipId)?.parentClipId ?? null) !== nextParentClipId
    );
    if (changedClipIds.length === 0) return false;
    const nextParentByClipId = new Map<string, string | null>();
    changedClipIds.forEach((clipId) => nextParentByClipId.set(clipId, nextParentClipId));
    updateClipParents(selectedIdea.id, nextParentByClipId);
    onUndo(() => {
      const restoredParentByClipId = new Map<string, string | null>();
      changedClipIds.forEach((clipId) => {
        restoredParentByClipId.set(clipId, previousParentByClipId.get(clipId) ?? null);
      });
      updateClipParents(selectedIdea.id, restoredParentByClipId);
    }, changedClipIds.length === 1 ? "Parent updated" : "Parents updated");
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
