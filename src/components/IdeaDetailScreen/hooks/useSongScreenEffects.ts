import { useEffect } from "react";
import { useStore } from "../../../state/useStore";

type UseSongScreenEffectsParams = {
  isFocused: boolean;
  isProject: boolean;
  songTab: "takes" | "lyrics" | "notes";
  isEditMode: boolean;
  clipSelectionMode: boolean;
  setSongTab: (value: "takes" | "lyrics" | "notes") => void;
  setParentPickState: (value: null) => void;
  setInlinePlayerMounted: (value: boolean) => void;
};

export function useSongScreenEffects({
  isFocused,
  isProject,
  songTab,
  isEditMode,
  clipSelectionMode,
  setSongTab,
  setParentPickState,
  setInlinePlayerMounted,
}: UseSongScreenEffectsParams) {
  useEffect(() => {
    if (isEditMode || clipSelectionMode) {
      setSongTab("takes");
    }
  }, [clipSelectionMode, isEditMode, setSongTab]);

  useEffect(() => {
    if (isFocused) return;

    useStore.getState().cancelClipSelection();
    setParentPickState(null);
  }, [isFocused, setParentPickState]);

  useEffect(() => {
    const visible = isFocused && (!isProject || songTab === "takes");
    setInlinePlayerMounted(visible);
    return () => setInlinePlayerMounted(false);
  }, [isFocused, isProject, setInlinePlayerMounted, songTab]);

  useEffect(() => {
    if (isEditMode || songTab !== "takes") {
      setParentPickState(null);
    }
  }, [isEditMode, setParentPickState, songTab]);

  useEffect(() => {
    return () => {
      const { inlineTarget } = useStore.getState();
      if (inlineTarget) {
        useStore.getState().requestInlineStop();
      }
    };
  }, []);
}
