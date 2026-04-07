import { useState } from "react";
import { Alert } from "react-native";
import { EditableSelection, getInitialRegionDurationMs, MIN_REGION_DURATION_MS } from "../helpers";

type UseEditorSelectionStateArgs = {
  analysisDurationMs: number | null;
  playheadTimeMs: number;
};

export function useEditorSelectionState({
  analysisDurationMs,
  playheadTimeMs,
}: UseEditorSelectionStateArgs) {
  const [selectedRanges, setSelectedRanges] = useState<EditableSelection[]>([]);
  const [regionIdCounter, setRegionIdCounter] = useState(1);
  const [editMode, setEditMode] = useState<"keep" | "remove">("keep");

  const addRange = () => {
    if (!analysisDurationMs) return;
    const durationMs = analysisDurationMs;
    let newStart = playheadTimeMs;

    const sorted = [...selectedRanges].sort((a, b) => a.start - b.start);
    const insideRange = sorted.find(
      (range) => newStart >= range.start + MIN_REGION_DURATION_MS && newStart <= range.end - MIN_REGION_DURATION_MS
    );

    if (insideRange) {
      setSelectedRanges((prev) => {
        const mapped = prev.map((range) => (range.id === insideRange.id ? { ...range, end: newStart } : range));
        return [
          ...mapped,
          { id: regionIdCounter.toString(), start: newStart, end: insideRange.end, type: insideRange.type },
        ];
      });
      setRegionIdCounter((prev) => prev + 1);
      return;
    }

    const touchingRange = sorted.find((range) => newStart >= range.start && newStart <= range.end);
    if (touchingRange) {
      newStart = touchingRange.end;
    }

    let maxEnd = durationMs;
    let spawned = false;

    for (const range of sorted) {
      if (range.start >= newStart) {
        if (range.start - newStart >= MIN_REGION_DURATION_MS) {
          maxEnd = range.start;
          spawned = true;
          break;
        }
        newStart = range.end;
      }
    }

    if (!spawned && newStart >= durationMs - MIN_REGION_DURATION_MS) {
      newStart = 0;
      maxEnd = durationMs;
      for (const range of sorted) {
        if (range.start >= newStart) {
          if (range.start - newStart >= MIN_REGION_DURATION_MS) {
            maxEnd = range.start;
            break;
          }
          newStart = range.end;
        }
      }
      if (newStart >= durationMs - MIN_REGION_DURATION_MS) {
        return;
      }
    }

    if (maxEnd - newStart < MIN_REGION_DURATION_MS) {
      Alert.alert("No room", "Selections must be at least 1 second long.");
      return;
    }

    const initialRegionDurationMs = getInitialRegionDurationMs(durationMs);
    const newEnd = Math.min(maxEnd, newStart + initialRegionDurationMs);

    setSelectedRanges((prev) => [
      ...prev,
      { id: regionIdCounter.toString(), start: newStart, end: newEnd, type: editMode },
    ]);
    setRegionIdCounter((prev) => prev + 1);
  };

  const removeRange = (id: string) => {
    setSelectedRanges((prev) => prev.filter((range) => range.id !== id));
  };

  const keepRegions = selectedRanges.filter((range) => range.type === "keep");
  const removeRegions = selectedRanges.filter((range) => range.type === "remove");

  return {
    selectedRanges,
    setSelectedRanges,
    editMode,
    setEditMode,
    keepRegions,
    removeRegions,
    addRange,
    removeRange,
  };
}
