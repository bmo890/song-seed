import { useEffect } from "react";
import { useStore } from "../../../state/useStore";

type UseSongScreenEffectsParams = {
  isFocused: boolean;
  isProject: boolean;
  songTab: "takes" | "lyrics" | "chart" | "notes";
  isEditMode: boolean;
  clipSelectionMode: boolean;
  setSongTab: (value: "takes" | "lyrics" | "chart" | "notes") => void;
  setParentPickState: (value: null) => void;
};

export function useSongScreenEffects({
  isFocused,
  isProject,
  songTab,
  isEditMode,
  clipSelectionMode,
  setSongTab,
  setParentPickState,
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
    if (visible) return;
    const { inlineTarget } = useStore.getState();
    if (inlineTarget) {
      useStore.getState().requestInlineStop();
    }
  }, [isFocused, isProject, songTab]);

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
