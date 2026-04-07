import { useCallback, useState } from "react";
import type { PracticeMarker } from "../../../types";
import { useStore } from "../../../state/useStore";

type UsePlayerPinsArgs = {
  playerIdeaId: string | null | undefined;
  playerClipId: string | null | undefined;
  practiceMarkers: PracticeMarker[];
  displayDuration: number;
  playerPosition: number;
};

export function usePlayerPins({
  playerIdeaId,
  playerClipId,
  practiceMarkers,
  displayDuration,
  playerPosition,
}: UsePlayerPinsArgs) {
  const [newPinLabel, setNewPinLabel] = useState("");
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinActionsTarget, setPinActionsTarget] = useState<PracticeMarker | null>(null);
  const [pinActionsVisible, setPinActionsVisible] = useState(false);
  const [pinRenameValue, setPinRenameValue] = useState("");

  const handleAddPin = useCallback(
    (label?: string) => {
      if (!playerIdeaId || !playerClipId) return;
      const resolvedLabel = (label ?? newPinLabel).trim();

      const newMarker: PracticeMarker = {
        id: `pin-${Date.now()}`,
        label: resolvedLabel,
        atMs: playerPosition,
      };

      useStore.getState().addClipPracticeMarker(playerIdeaId, playerClipId, newMarker);
      setNewPinLabel("");
      setPinModalVisible(false);
    },
    [newPinLabel, playerClipId, playerIdeaId, playerPosition]
  );

  const handleRepositionMarker = useCallback(
    (markerId: string, newAtMs: number) => {
      if (!playerIdeaId || !playerClipId) return;
      const updated = practiceMarkers.map((marker) =>
        marker.id === markerId
          ? { ...marker, atMs: Math.round(Math.max(0, Math.min(displayDuration, newAtMs))) }
          : marker
      );
      useStore.getState().setClipPracticeMarkers(playerIdeaId, playerClipId, updated);
    },
    [displayDuration, playerClipId, playerIdeaId, practiceMarkers]
  );

  const handlePinActions = useCallback((marker: PracticeMarker) => {
    setPinActionsTarget(marker);
    setPinRenameValue(marker.label);
    setPinActionsVisible(true);
  }, []);

  const handleRenamePin = useCallback(() => {
    if (!playerIdeaId || !playerClipId || !pinActionsTarget) return;
    const label = pinRenameValue.trim();
    if (!label) return;
    const updated = practiceMarkers.map((marker) =>
      marker.id === pinActionsTarget.id ? { ...marker, label } : marker
    );
    useStore.getState().setClipPracticeMarkers(playerIdeaId, playerClipId, updated);
    setPinActionsVisible(false);
    setPinActionsTarget(null);
  }, [pinActionsTarget, pinRenameValue, playerClipId, playerIdeaId, practiceMarkers]);

  const handleDeletePin = useCallback(() => {
    if (!playerIdeaId || !playerClipId || !pinActionsTarget) return;
    useStore.getState().removeClipPracticeMarker(playerIdeaId, playerClipId, pinActionsTarget.id);
    setPinActionsVisible(false);
    setPinActionsTarget(null);
  }, [pinActionsTarget, playerClipId, playerIdeaId]);

  return {
    newPinLabel,
    pinModalVisible,
    pinActionsTarget,
    pinActionsVisible,
    pinRenameValue,
    setNewPinLabel,
    setPinModalVisible,
    setPinActionsTarget,
    setPinActionsVisible,
    setPinRenameValue,
    handleAddPin,
    handleRepositionMarker,
    handlePinActions,
    handleRenamePin,
    handleDeletePin,
  };
}
