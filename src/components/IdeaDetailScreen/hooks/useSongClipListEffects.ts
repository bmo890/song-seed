import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { useIsFocused } from "@react-navigation/native";

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
  // Focus-scoped: this screen stays mounted under anything pushed above it
  // (Recording, Editor…). Without the gate, back on THOSE screens silently
  // stopped the inline preview here instead of popping them.
  const isFocused = useIsFocused();

  useEffect(() => {
    inlineResetRef.current = resetInlinePlayer;
  }, [resetInlinePlayer]);

  useEffect(() => {
    if (!inlineTarget || !isFocused) return;

    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      void inlineResetRef.current();
      return true;
    });

    return () => handler.remove();
  }, [inlineTarget, isFocused]);

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
