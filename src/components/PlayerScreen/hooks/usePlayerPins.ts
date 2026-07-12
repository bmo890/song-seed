import { useCallback, useState } from "react";
import type { PracticeMarker } from "../../../types";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import { toast } from "../../common/toastStore";
import { fmtDuration } from "../../../utils";

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
  const [expandedPinId, setExpandedPinId] = useState<string | null>(null);
  const [pinNoteDraft, setPinNoteDraft] = useState("");

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
      haptic.light();
      toast(`Pin added at ${fmtDuration(playerPosition)}`, "pin-outline");
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

  const commitPinNote = useCallback(
    (markerId: string, note: string) => {
      if (!playerIdeaId || !playerClipId) return;
      const trimmed = note.trim();
      const nextNote = trimmed ? trimmed : undefined;
      const current = practiceMarkers.find((marker) => marker.id === markerId);
      // Skip the (snapshot-serializing) store write when the note hasn't actually changed.
      if (!current || (current.note ?? undefined) === nextNote) return;
      const updated = practiceMarkers.map((marker) =>
        marker.id === markerId ? { ...marker, note: nextNote } : marker
      );
      useStore.getState().setClipPracticeMarkers(playerIdeaId, playerClipId, updated);
    },
    [playerClipId, playerIdeaId, practiceMarkers]
  );

  // The caret just toggles the inline timing adjuster now; name/note live in the editor modal.
  const togglePinExpanded = useCallback((marker: PracticeMarker) => {
    setExpandedPinId((prev) => (prev === marker.id ? null : marker.id));
  }, []);

  const handleEditPin = useCallback(
    (markerId: string, edits: { label: string; note: string }) => {
      if (!playerIdeaId || !playerClipId) return;
      const label = edits.label.trim();
      const note = edits.note.trim() || undefined;
      const updated = practiceMarkers.map((marker) =>
        marker.id === markerId ? { ...marker, label, note } : marker
      );
      useStore.getState().setClipPracticeMarkers(playerIdeaId, playerClipId, updated);
    },
    [playerClipId, playerIdeaId, practiceMarkers]
  );

  const handleDeletePinId = useCallback(
    (markerId: string) => {
      if (!playerIdeaId || !playerClipId) return;
      useStore.getState().removeClipPracticeMarker(playerIdeaId, playerClipId, markerId);
      setExpandedPinId((prev) => (prev === markerId ? null : prev));
    },
    [playerClipId, playerIdeaId]
  );

  return {
    newPinLabel,
    pinModalVisible,
    pinActionsTarget,
    pinActionsVisible,
    pinRenameValue,
    expandedPinId,
    pinNoteDraft,
    setNewPinLabel,
    setPinModalVisible,
    setPinActionsTarget,
    setPinActionsVisible,
    setPinRenameValue,
    setPinNoteDraft,
    handleAddPin,
    handleRepositionMarker,
    handlePinActions,
    handleRenamePin,
    handleDeletePin,
    handleEditPin,
    handleDeletePinId,
    togglePinExpanded,
    commitPinNote,
  };
}
