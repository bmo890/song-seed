import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "../../../state/useStore";
import { useInlinePlayer } from "../../../hooks/useInlinePlayer";
import { useCollectionEditModal } from "../hooks/useCollectionEditModal";
import { useCollectionImportFlow } from "../hooks/useCollectionImportFlow";
import { useCollectionManagement } from "../hooks/useCollectionManagement";
import { useCollectionScreenModel } from "../hooks/useCollectionScreenModel";
import { useCollectionSelection } from "../hooks/useCollectionSelection";
import type { Collection, CustomTagDefinition, IdeaSort, WorkspaceHiddenDay } from "../../../types";

type CollectionScreenContextValue = {
  screen: ReturnType<typeof useCollectionScreenModel>;
  importFlow: ReturnType<typeof useCollectionImportFlow>;
  management: ReturnType<typeof useCollectionManagement>;
  selection: ReturnType<typeof useCollectionSelection>;
  editModal: ReturnType<typeof useCollectionEditModal>;
  inlinePlayer: ReturnType<typeof useInlinePlayer>;
  store: {
    globalCustomTags: CustomTagDefinition[];
    ideasFilter: "all" | "clips" | "projects";
    ideasSort: IdeaSort;
    setIdeasFilter: (value: "all" | "clips" | "projects") => void;
    setIdeasHidden: (collectionId: string, ideaIds: string[], hidden: boolean) => void;
    setTimelineDaysHidden: (collectionId: string, days: WorkspaceHiddenDay[], hidden: boolean) => void;
    updateCollection: (workspaceId: string, collectionId: string, patch: Partial<Collection>) => void;
    moveCollection: (collectionId: string, workspaceId: string, parentCollectionId?: string | null) => { ok: boolean; error?: string };
    deleteCollection: (collectionId: string) => void;
    setSelectedIdeaId: (ideaId: string | null) => void;
    replaceListSelection: (ideaIds: string[]) => void;
  };
};

const CollectionScreenContext = createContext<CollectionScreenContextValue | null>(null);

export function CollectionScreenProvider({ children }: { children: ReactNode }) {
  const screen = useCollectionScreenModel();
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const ideasFilter = useStore((s) => s.ideasFilter);
  const ideasSort = useStore((s) => s.ideasSort);
  const setIdeasFilter = useStore((s) => s.setIdeasFilter);
  const setIdeasHidden = useStore((s) => s.setIdeasHidden);
  const setTimelineDaysHidden = useStore((s) => s.setTimelineDaysHidden);
  const updateCollection = useStore((s) => s.updateCollection);
  const moveCollection = useStore((s) => s.moveCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
  const replaceListSelection = useStore((s) => s.replaceListSelection);
  const inlinePlayer = useInlinePlayer();
  const importFlow = useCollectionImportFlow({
    activeWorkspaceId: screen.activeWorkspaceId,
    collectionId: screen.collectionId ?? "",
    collectionIdeaTitles: screen.ideas.map((idea) => idea.title),
    currentCollectionTitle: screen.currentCollection?.title ?? "Collection",
  });
  const management = useCollectionManagement({
    workspaces: screen.workspaces,
    activeWorkspace: screen.activeWorkspace ?? null,
    activeWorkspaceId: screen.activeWorkspaceId,
    navigation: screen.navigation,
    currentCollection: screen.currentCollection,
    updateCollection,
    moveCollection,
    deleteCollection,
  });
  const selection = useCollectionSelection();
  const editModal = useCollectionEditModal(screen.ideas);

  return (
    <CollectionScreenContext.Provider
      value={{
        screen,
        importFlow,
        management,
        selection,
        editModal,
        inlinePlayer,
        store: {
          globalCustomTags,
          ideasFilter,
          ideasSort,
          setIdeasFilter,
          setIdeasHidden,
          setTimelineDaysHidden,
          updateCollection,
          moveCollection,
          deleteCollection,
          setSelectedIdeaId,
          replaceListSelection,
        },
      }}
    >
      {children}
    </CollectionScreenContext.Provider>
  );
}

export function useCollectionScreen() {
  const context = useContext(CollectionScreenContext);
  if (!context) {
    throw new Error("useCollectionScreen must be used inside CollectionScreenProvider");
  }
  return context;
}
