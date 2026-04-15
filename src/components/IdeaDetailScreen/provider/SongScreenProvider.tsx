import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Alert } from "react-native";
import { hasClipPlaybackSource } from "../../../clipPresentation";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { useSongEditFlow } from "../hooks/useSongEditFlow";
import { useSongImportFlow } from "../hooks/useSongImportFlow";
import { useSongParentPicking } from "../hooks/useSongParentPicking";
import { useSongScreenEffects } from "../hooks/useSongScreenEffects";
import { useSongScreenModel } from "../hooks/useSongScreenModel";
import { useSongUndo } from "../hooks/useSongUndo";

type SongScreenContextValue = {
  screen: ReturnType<typeof useSongScreenModel>;
  importFlow: ReturnType<typeof useSongImportFlow>;
  parentPicking: ReturnType<typeof useSongParentPicking>;
  editFlow: ReturnType<typeof useSongEditFlow>;
  undo: ReturnType<typeof useSongUndo>;
  store: {
    clipClipboard: ReturnType<typeof useStore.getState>["clipClipboard"];
    cancelClipboard: ReturnType<typeof useStore.getState>["cancelClipboard"];
    clipSelectionMode: boolean;
    setRecordingIdeaId: (ideaId: string | null) => void;
    setRecordingParentClipId: (clipId: string | null) => void;
  };
  actions: {
    buildProjectQueue: (clipIds?: string[]) => Array<{ ideaId: string; clipId: string }>;
    playProjectQueue: (clipIds?: string[]) => void;
    startRecording: (parentClipId: string | null) => void;
    openLineageHistory: (rootClipId: string) => void;
    handleBackToIdeas: () => void;
  };
};

const SongScreenContext = createContext<SongScreenContextValue | null>(null);

export function SongScreenProvider({ children }: { children: ReactNode }) {
  const screen = useSongScreenModel();
  const clipClipboard = useStore((s) => s.clipClipboard);
  const cancelClipboard = useStore((s) => s.cancelClipboard);
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const setRecordingIdeaId = useStore((s) => s.setRecordingIdeaId);
  const setRecordingParentClipId = useStore((s) => s.setRecordingParentClipId);
  const setInlinePlayerMounted = useStore((s) => s.setInlinePlayerMounted);

  const importFlow = useSongImportFlow({
    selectedIdea: screen.selectedIdea,
    songClipTitles: screen.songClipTitles,
  });
  const parentPicking = useSongParentPicking(screen.selectedIdea, screen.songClips);
  const editFlow = useSongEditFlow({
    navigation: screen.navigation,
    selectedIdea: screen.selectedIdea,
    selectedIdeaId: screen.selectedIdeaId,
    activeWorkspaceId: screen.activeWorkspaceId,
    workspaces: screen.workspaces,
    isEditMode: screen.isEditMode,
    setIsEditMode: screen.setIsEditMode,
    draftTitle: screen.draftTitle,
    draftStatus: screen.draftStatus,
    draftCompletion: screen.draftCompletion,
  });
  const undo = useSongUndo({
    floatingBaseBottom: screen.floatingBaseBottom,
    isProject: !!screen.isProject,
    isEditMode: screen.isEditMode,
    clipSelectionMode,
    isParentPicking: !!parentPicking.parentPickState,
    songTab: screen.songTab,
  });

  useSongScreenEffects({
    isFocused: screen.isFocused,
    isProject: !!screen.isProject,
    songTab: screen.songTab,
    isEditMode: screen.isEditMode,
    clipSelectionMode,
    setSongTab: screen.setSongTab,
    setParentPickState: parentPicking.setParentPickState,
    setInlinePlayerMounted,
  });

  const actions = useMemo(() => {
    function buildProjectQueue(clipIds?: string[]) {
      if (!screen.selectedIdea || screen.selectedIdea.kind !== "project") return [];
      return screen.selectedIdea.clips
        .filter((clip) => hasClipPlaybackSource(clip) && (!clipIds || clipIds.includes(clip.id)))
        .map((clip) => ({
          ideaId: screen.selectedIdea!.id,
          clipId: clip.id,
        }));
    }

    function playProjectQueue(clipIds?: string[]) {
      const queue = buildProjectQueue(clipIds);
      if (queue.length === 0) {
        Alert.alert("Nothing to play", "This song does not have any playable clips yet.");
        return;
      }
      useStore.getState().setPlayerQueue(queue, 0, true);
      screen.navigation.navigate("Player" as never);
    }

    function startRecording(parentClipId: string | null) {
      if (!screen.selectedIdea) return;
      setRecordingParentClipId(parentClipId);
      setRecordingIdeaId(screen.selectedIdea.id);
      screen.navigation.navigate("Recording" as never);
    }

    function openLineageHistory(rootClipId: string) {
      if (!screen.selectedIdea) return;
      (screen.navigation as any).navigate("ClipLineage", {
        ideaId: screen.selectedIdea.id,
        rootClipId,
      });
    }

    function handleBackToIdeas() {
      useStore.getState().cancelClipSelection();
      parentPicking.setParentPickState(null);
      appActions.backToIdeas();
      screen.navigation.goBack();
    }

    return {
      buildProjectQueue,
      playProjectQueue,
      startRecording,
      openLineageHistory,
      handleBackToIdeas,
    };
  }, [parentPicking, screen.navigation, screen.selectedIdea, setRecordingIdeaId, setRecordingParentClipId]);

  return (
    <SongScreenContext.Provider
      value={{
        screen,
        importFlow,
        parentPicking,
        editFlow,
        undo,
        store: {
          clipClipboard,
          cancelClipboard,
          clipSelectionMode,
          setRecordingIdeaId,
          setRecordingParentClipId,
        },
        actions,
      }}
    >
      {children}
    </SongScreenContext.Provider>
  );
}

export function useSongScreen() {
  const context = useContext(SongScreenContext);
  if (!context) {
    throw new Error("useSongScreen must be used inside SongScreenProvider");
  }
  return context;
}
