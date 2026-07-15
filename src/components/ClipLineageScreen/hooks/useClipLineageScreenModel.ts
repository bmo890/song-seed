import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler } from "react-native";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../../navigation";
import { useStore } from "../../../state/useStore";
import { useMiniPlayerContext } from "../../../hooks/FullPlayerProvider";
import { buildClipLineages, type ClipLineage, type TimelineClipEntry } from "../../../domain/clipGraph";
import {
  buildLineageTitlePlan,
} from "../../../domain/clipLineageTitles";
import {
  showLineageRenamePrompt,
  type LineageRenamePromptInfo,
} from "../../../domain/clipLineageRenamePrompt";
import { type ClipVersion } from "../../../types";
import { type ClipCardContextProps } from "../../IdeaDetailScreen/components/ClipCard";

type ClipLineageRoute = RootStackParamList["ClipLineage"];
type SortDirection = "asc" | "desc";

export function useClipLineageScreenModel() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ideaId, rootClipId } = (route.params ?? {}) as ClipLineageRoute;
  const inlinePlayer = useMiniPlayerContext();
  const inlineResetRef = useRef(inlinePlayer.resetInlinePlayer);
  const inlineTarget = useStore((state) => state.inlineTarget);
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [actionsClipId, setActionsClipId] = useState<string | null>(null);
  const [notesSheetClipId, setNotesSheetClipId] = useState<string | null>(null);
  const [tagPickerClipId, setTagPickerClipId] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingClipDraft, setEditingClipDraft] = useState("");
  const [editingClipNotesDraft, setEditingClipNotesDraft] = useState("");

  const globalCustomTags = useStore((state) => state.globalCustomClipTags);
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const updateIdeas = useStore((state) => state.updateIdeas);
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
    return direction === "asc"
      ? lineage.clipsOldestToNewest
      : lineage.clipsNewestToOldest;
  }, [lineage, direction]);
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

  // Focus-scoped: without the gate, back on a screen pushed above this one
  // silently stopped the inline preview here instead of popping that screen.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!inlineTarget || !isFocused) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      void inlineResetRef.current();
      return true;
    });
    return () => handler.remove();
  }, [inlineTarget, isFocused]);

  useEffect(
    () => () => {
      void inlineResetRef.current();
    },
    []
  );

  const actionsClip = actionsClipId
    ? idea?.clips.find((clip) => clip.id === actionsClipId) ?? null
    : null;
  const notesSheetClip = notesSheetClipId
    ? idea?.clips.find((clip) => clip.id === notesSheetClipId) ?? null
    : null;
  const tagPickerClip = tagPickerClipId
    ? idea?.clips.find((clip) => clip.id === tagPickerClipId) ?? null
    : null;

  const beginEditingClip = (clip: ClipVersion) => {
    setEditingClipId(clip.id);
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
  };

  const commitClipTitleSave = (clipId: string): LineageRenamePromptInfo | null => {
    const state = useStore.getState();
    const workspace = state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId);
    const currentIdea = workspace?.ideas.find((candidate) => candidate.id === ideaId) ?? null;
    const plan = currentIdea
      ? buildLineageTitlePlan(currentIdea.clips, clipId, editingClipDraft)
      : null;
    const newNotes = editingClipNotesDraft.trim();

    if (!currentIdea || !plan) {
      console.warn("[renameThread] lineage screen save skipped", {
        ideaId,
        clipId,
        hasIdea: !!currentIdea,
        hasPlan: !!plan,
      });
      return null;
    }

    state.updateIdeas((ideas) =>
      ideas.map((currentIdea) =>
        currentIdea.id !== ideaId
          ? currentIdea
          : {
              ...currentIdea,
              clips: currentIdea.clips.map((clip) =>
                clip.id === clipId
                  ? {
                      ...clip,
                      title: plan.savedTitle,
                      notes: newNotes,
                      isTitleAutoGenerated: false,
                    }
                  : clip
              ),
          }
      )
    );

    console.log("[renameThread] lineage screen save", {
      clipId,
      previousTitle: plan.clip.title,
      savedTitle: plan.savedTitle,
      lineageSize: plan.orderedClips.length,
      targetIndex: plan.targetIndex,
      isEditingRoot: plan.isEditingRoot,
      renameCount: plan.renames.length,
    });

    if (!plan.lineage || plan.orderedClips.length <= 1 || plan.renames.length === 0) {
      return null;
    }

    return { ideaId, renames: plan.renames };
  };

  const saveEditingClip = (clipId: string) => {
    const promptInfo = commitClipTitleSave(clipId);
    setEditingClipId(null);
    if (promptInfo) {
      setTimeout(() => showLineageRenamePrompt(promptInfo), 100);
    }
  };

  const openNotesSheet = (clip: ClipVersion) => {
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
    setNotesSheetClipId(clip.id);
  };

  const saveNotesSheet = () => {
    if (!notesSheetClipId) return;
    const promptInfo = commitClipTitleSave(notesSheetClipId);
    setNotesSheetClipId(null);
    if (promptInfo) {
      setTimeout(() => showLineageRenamePrompt(promptInfo), 400);
    }
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

  const openRecordingVariation = async (clip: ClipVersion) => {
    setActionsClipId(null);
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().requestPlayerClose();
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
        onOpenTagPicker: (clip) => setTagPickerClipId(clip.id),
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
    direction,
    toggleDirection: () => setDirection((d) => (d === "asc" ? "desc" : "asc")),
    idea,
    lineage,
    clipEntries,
    actionsClip,
    notesSheetClip,
    tagPickerClip,
    clipCardContext,
    lineageTitle: lineage?.root.title || "Untitled",
    clipCount: lineage?.clipsOldestToNewest.length ?? 0,
    setActionsClipId,
    setNotesSheetClipId,
    setTagPickerClipId,
    editingClipDraft,
    setEditingClipDraft,
    editingClipNotesDraft,
    setEditingClipNotesDraft,
    beginEditingClip,
    saveNotesSheet,
    deleteClip,
    openRecordingVariation,
  };
}
