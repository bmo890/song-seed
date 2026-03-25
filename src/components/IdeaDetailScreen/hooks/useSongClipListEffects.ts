import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";

type UseSongClipListEffectsArgs = {
  inlineTarget: { ideaId: string; clipId: string } | null;
  resetInlinePlayer: () => Promise<void>;
  isParentPicking: boolean;
  clipViewMode: "timeline" | "evolution";
  setClipViewMode: (mode: "timeline" | "evolution") => void;
  clearEditing: () => void;
};

export function useSongClipListEffects({
  inlineTarget,
  resetInlinePlayer,
  isParentPicking,
  clipViewMode,
  setClipViewMode,
  clearEditing,
}: UseSongClipListEffectsArgs) {
  const inlineResetRef = useRef(resetInlinePlayer);

  useEffect(() => {
    inlineResetRef.current = resetInlinePlayer;
  }, [resetInlinePlayer]);

  useEffect(() => {
    if (!inlineTarget) return;

    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      void inlineResetRef.current();
      return true;
    });

    return () => handler.remove();
  }, [inlineTarget]);

  useEffect(() => {
    if (isParentPicking && clipViewMode !== "evolution") {
      setClipViewMode("evolution");
    }
  }, [clipViewMode, isParentPicking, setClipViewMode]);

  useEffect(() => {
    if (!isParentPicking) return;
    clearEditing();
  }, [clearEditing, isParentPicking]);
}
