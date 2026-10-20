import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PracticeMarker } from "../../../types";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import { toast } from "../../common/toastStore";
import { clampPinLabel } from "../../../domain/practicePinLayout";
import { fmtDuration } from "../../../utils";
import { PIN_ICON_OUTLINE } from "../../../design/markIcons";

type UsePlayerPinsArgs = {
  playerIdeaId: string | null | undefined;
  playerClipId: string | null | undefined;
  practiceMarkers: PracticeMarker[];
  displayDuration: number;
  playerPosition: number;
  /** Called right before any persisted change — the marks undo history records
   *  its pre-change snapshot here. */
  onBeforeChange?: () => void;
};

export function usePlayerPins({
  playerIdeaId,
  playerClipId,
  practiceMarkers,
  displayDuration,
  playerPosition,
  onBeforeChange,
}: UsePlayerPinsArgs) {
  const { t } = useTranslation();
  const [pinActionsTarget, setPinActionsTarget] = useState<PracticeMarker | null>(null);
  const [pinActionsVisible, setPinActionsVisible] = useState(false);
  const [expandedPinId, setExpandedPinId] = useState<string | null>(null);
  const [pinNoteDraft, setPinNoteDraft] = useState("");

  // Read at call time through a ref: the value is the same the render had, but the
  // callback keeps its identity across the once-a-second position commit — which is
  // what lets the timeline (and the reel under it) skip that commit (2026-09-24).
  const playerPositionRef = useRef(playerPosition);
  playerPositionRef.current = playerPosition;

  /** Returns the new pin's id so the caller can offer to name it immediately. */
  const handleAddPin = useCallback(
    (label?: string) => {
      if (!playerIdeaId || !playerClipId) return null;
      const resolvedLabel = clampPinLabel(label ?? "");

      const atMs = playerPositionRef.current;
      const newMarker: PracticeMarker = {
        id: `pin-${Date.now()}`,
        label: resolvedLabel,
        atMs,
      };

      onBeforeChange?.();
      useStore.getState().addClipPracticeMarker(playerIdeaId, playerClipId, newMarker);
      // Haptics: `light` — a small state flip that should land (a mark dropped).
      haptic.light();
      toast(t("player.pinAddedAt", { time: fmtDuration(atMs) }), PIN_ICON_OUTLINE);
      return newMarker.id;
    },
    [onBeforeChange, playerClipId, playerIdeaId, t]
  );

  const handleRepositionMarker = useCallback(
    (markerId: string, newAtMs: number) => {
      if (!playerIdeaId || !playerClipId) return;
      const updated = practiceMarkers.map((marker) =>
        marker.id === markerId
          ? { ...marker, atMs: Math.round(Math.max(0, Math.min(displayDuration, newAtMs))) }
          : marker
      );
      onBeforeChange?.();
      useStore.getState().setClipPracticeMarkers(playerIdeaId, playerClipId, updated);
    },
    [displayDuration, onBeforeChange, playerClipId, playerIdeaId, practiceMarkers]
  );

  const handlePinActions = useCallback((marker: PracticeMarker) => {
    setPinActionsTarget(marker);
    setPinActionsVisible(true);
  }, []);

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
      onBeforeChange?.();
      useStore.getState().setClipPracticeMarkers(playerIdeaId, playerClipId, updated);
    },
    [onBeforeChange, playerClipId, playerIdeaId, practiceMarkers]
  );

  // The caret just toggles the inline timing adjuster now; name/note live in the editor modal.
  const togglePinExpanded = useCallback((marker: PracticeMarker) => {
    setExpandedPinId((prev) => (prev === marker.id ? null : marker.id));
  }, []);

  const handleEditPin = useCallback(
    (markerId: string, edits: { label: string; note: string }) => {
      if (!playerIdeaId || !playerClipId) return;
      const label = clampPinLabel(edits.label);
      const note = edits.note.trim() || undefined;
      // A no-op save (dialog confirmed without changes) writes nothing — it
      // would otherwise pollute the undo history with an invisible step.
      const current = practiceMarkers.find((marker) => marker.id === markerId);
      if (current && current.label === label && (current.note ?? undefined) === note) return;
      const updated = practiceMarkers.map((marker) =>
        marker.id === markerId ? { ...marker, label, note } : marker
      );
      onBeforeChange?.();
      useStore.getState().setClipPracticeMarkers(playerIdeaId, playerClipId, updated);
    },
    [onBeforeChange, playerClipId, playerIdeaId, practiceMarkers]
  );

  const handleDeletePinId = useCallback(
    (markerId: string) => {
      if (!playerIdeaId || !playerClipId) return;
      onBeforeChange?.();
      useStore.getState().removeClipPracticeMarker(playerIdeaId, playerClipId, markerId);
      setExpandedPinId((prev) => (prev === markerId ? null : prev));
    },
    [onBeforeChange, playerClipId, playerIdeaId]
  );

  return {
    pinActionsTarget,
    pinActionsVisible,
    expandedPinId,
    pinNoteDraft,
    setPinActionsTarget,
    setPinActionsVisible,
    setPinNoteDraft,
    handleAddPin,
    handleRepositionMarker,
    handlePinActions,
    handleEditPin,
    handleDeletePinId,
    togglePinExpanded,
    commitPinNote,
  };
}
