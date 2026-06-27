import { useState } from "react";
import { AppAlert } from "../../../components/common/AppAlert";
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
      AppAlert.info("No room", "Selections must be at least 1 second long.");
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

  // Intent is global: flipping it recolors EVERY region to the new type so the
  // edit always produces one kind of output (N extracted clips, or 1 trimmed
  // clip) — never a confusing mix.
  const setIntent = (mode: "keep" | "remove") => {
    setEditMode(mode);
    setSelectedRanges((prev) =>
      prev.every((range) => range.type === mode) ? prev : prev.map((range) => ({ ...range, type: mode }))
    );
  };

  const keepRegions = selectedRanges.filter((range) => range.type === "keep");
  const removeRegions = selectedRanges.filter((range) => range.type === "remove");

  return {
    selectedRanges,
    setSelectedRanges,
    editMode,
    setEditMode,
    setIntent,
    keepRegions,
    removeRegions,
    addRange,
    removeRange,
  };
}
