import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../../../App";
import { useStore } from "../../../state/useStore";
import { useInlinePlayer } from "../../../hooks/useInlinePlayer";
import { buildClipLineages, type ClipLineage, type TimelineClipEntry } from "../../../clipGraph";
import { type ClipVersion } from "../../../types";
import { type ClipCardContextProps } from "../../IdeaDetailScreen/ClipCard";

type ClipLineageRoute = RootStackParamList["ClipLineage"];
type SortMode = "chronological" | "custom";

export function useClipLineageScreenModel() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ideaId, rootClipId } = (route.params ?? {}) as ClipLineageRoute;
  const inlinePlayer = useInlinePlayer();
  const inlineResetRef = useRef(inlinePlayer.resetInlinePlayer);
  const [sortMode, setSortMode] = useState<SortMode>("chronological");
  const [actionsClipId, setActionsClipId] = useState<string | null>(null);
  const [notesSheetClipId, setNotesSheetClipId] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingClipDraft, setEditingClipDraft] = useState("");
  const [editingClipNotesDraft, setEditingClipNotesDraft] = useState("");

  const globalCustomTags = useStore((state) => state.globalCustomClipTags);
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const updateIdeas = useStore((state) => state.updateIdeas);
  const setInlinePlayerMounted = useStore((state) => state.setInlinePlayerMounted);
  const requestInlineStop = useStore((state) => state.requestInlineStop);
  const setClipManualSortOrder = useStore((state) => state.setClipManualSortOrder);
  const setRecordingParentClipId = useStore((state) => state.setRecordingParentClipId);
  const setRecordingIdeaId = useStore((state) => state.setRecordingIdeaId);
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});

  const idea = useMemo(() => {
    const workspace = workspaces.find((candidate) => candidate.id === activeWorkspaceId);
    return workspace?.ideas.find((candidate) => candidate.id === ideaId) ?? null;
  }, [activeWorkspaceId, ideaId, workspaces]);
  const lineage = useMemo<ClipLineage | null>(() => {
    if (!idea) return null;
    const lineages = buildClipLineages(idea.clips);
    return lineages.find((candidate) => candidate.root.id === rootClipId) ?? null;
  }, [idea, rootClipId]);
  const sortedClips = useMemo(() => {
    if (!lineage) return [];
    if (sortMode === "chronological") {
      return lineage.clipsOldestToNewest;
    }
    return [...lineage.clipsOldestToNewest].sort((a, b) => {
      const aOrder = a.manualSortOrder ?? a.createdAt;
      const bOrder = b.manualSortOrder ?? b.createdAt;
      return aOrder - bOrder;
    });
  }, [lineage, sortMode]);
  const clipEntries = useMemo<TimelineClipEntry[]>(
    () =>
      sortedClips.map((clip) => ({
        kind: "timeline" as const,
        clip,
        depth: 0,
        childCount: 0,
        hasChildren: false,
      })),
    [sortedClips]
  );

  useEffect(() => {
    inlineResetRef.current = inlinePlayer.resetInlinePlayer;
  }, [inlinePlayer.resetInlinePlayer]);

  useEffect(() => {
    if (!inlinePlayer.inlineTarget) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      void inlineResetRef.current();
      return true;
    });
    return () => handler.remove();
  }, [inlinePlayer.inlineTarget]);

  useEffect(() => {
    setInlinePlayerMounted(true);
    return () => setInlinePlayerMounted(false);
  }, [setInlinePlayerMounted]);

  useEffect(
    () => () => {
      requestInlineStop();
    },
    [requestInlineStop]
  );

  const actionsClip = actionsClipId
    ? idea?.clips.find((clip) => clip.id === actionsClipId) ?? null
    : null;
  const notesSheetClip = notesSheetClipId
    ? idea?.clips.find((clip) => clip.id === notesSheetClipId) ?? null
    : null;

  const beginEditingClip = (clip: ClipVersion) => {
    setEditingClipId(clip.id);
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
  };

  const saveEditingClip = (clipId: string) => {
    updateIdeas((ideas) =>
      ideas.map((currentIdea) =>
        currentIdea.id !== ideaId
          ? currentIdea
          : {
              ...currentIdea,
              clips: currentIdea.clips.map((clip) =>
                clip.id === clipId
                  ? {
                      ...clip,
                      title: editingClipDraft.trim() || "Untitled Clip",
                      notes: editingClipNotesDraft.trim(),
                    }
                  : clip
              ),
            }
      )
    );
    setEditingClipId(null);
  };

  const openNotesSheet = (clip: ClipVersion) => {
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
    setNotesSheetClipId(clip.id);
  };

  const saveNotesSheet = () => {
    if (!notesSheetClipId) return;
    updateIdeas((ideas) =>
      ideas.map((currentIdea) =>
        currentIdea.id !== ideaId
          ? currentIdea
          : {
              ...currentIdea,
              clips: currentIdea.clips.map((clip) =>
                clip.id === notesSheetClipId
                  ? {
                      ...clip,
                      title: editingClipDraft.trim() || "Untitled Clip",
                      notes: editingClipNotesDraft.trim(),
                    }
                  : clip
              ),
            }
      )
    );
    setNotesSheetClipId(null);
  };

  const deleteClip = (clipId: string) => {
    updateIdeas((ideas) =>
      ideas.map((currentIdea) => {
        if (currentIdea.id !== ideaId) return currentIdea;
        const remaining = currentIdea.clips.filter((clip) => clip.id !== clipId);
        if (remaining.length > 0 && !remaining.some((clip) => clip.isPrimary)) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        return { ...currentIdea, clips: remaining };
      })
    );
  };

  const handleDragEnd = useCallback(
    ({ data }: { data: TimelineClipEntry[] }) => {
      setClipManualSortOrder(ideaId, data.map((entry) => entry.clip.id));
    },
    [ideaId, setClipManualSortOrder]
  );

  const openRecordingVariation = async (clip: ClipVersion) => {
    setActionsClipId(null);
    await inlinePlayer.resetInlinePlayer();
    setRecordingParentClipId(clip.id);
    setRecordingIdeaId(ideaId);
    navigation.navigate("Recording");
  };

  const clipCardContext = useMemo<ClipCardContextProps | null>(() => {
    if (!idea) return null;

    return {
      mode: {
        idea,
        displayPrimaryId: null,
        isEditMode: false,
        isDraftProject: false,
        isParentPicking: false,
        parentPickSourceIdSet: new Set(),
        parentPickInvalidTargetIdSet: new Set(),
      },
      editing: {
        editingClipId,
        editingClipDraft,
        setEditingClipDraft,
        editingClipNotesDraft,
        setEditingClipNotesDraft,
        onBeginEditing: beginEditingClip,
        onSaveEditing: saveEditingClip,
        onCancelEditing: () => setEditingClipId(null),
      },
      actions: {
        onOpenActions: (clip) => setActionsClipId(clip.id),
        longPressBehavior: "actions",
        onOpenNotesSheet: (clip) => openNotesSheet(clip),
        onPickParentTarget: () => {},
        onOpenTagPicker: (clip) => openNotesSheet(clip),
      },
      playback: {
        globalCustomTags,
        inlinePlayer,
        getHighlightValue: (clipId) => highlightMapRef.current[clipId],
      },
    };
  }, [
    editingClipDraft,
    editingClipId,
    editingClipNotesDraft,
    globalCustomTags,
    idea,
    inlinePlayer,
    saveEditingClip,
  ]);

  return {
    insets,
    goBack: () => navigation.goBack(),
    sortMode,
    setSortMode,
    idea,
    lineage,
    clipEntries,
    actionsClip,
    notesSheetClip,
    clipCardContext,
    lineageTitle: lineage?.root.title || "Untitled",
    clipCount: lineage?.clipsOldestToNewest.length ?? 0,
    setActionsClipId,
    setNotesSheetClipId,
    editingClipDraft,
    setEditingClipDraft,
    editingClipNotesDraft,
    setEditingClipNotesDraft,
    beginEditingClip,
    saveNotesSheet,
    deleteClip,
    handleDragEnd,
    openRecordingVariation,
  };
}
