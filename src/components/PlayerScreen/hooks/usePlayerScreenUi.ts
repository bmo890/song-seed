import { useState } from "react";
import { clampPitchShiftSemitones } from "../../../domain/pitchShift";

export type PlayerMode = "player" | "practice" | "playalong";
export type CountInOption = "off" | "1b" | "2b";
/** Practice tools. pins/loop/sections expand inline (accordion); speed/pitch/countin open a popover. */
export type PracticeTool = "pins" | "loop" | "sections" | "speed" | "pitch" | "countin";

export function usePlayerScreenUi() {
  const [mode, setMode] = useState<PlayerMode>("player");
  const [reelExpanded, setReelExpanded] = useState(false);
  const [markersVisible, setMarkersVisible] = useState(true);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [countInOption, setCountInOption] = useState<CountInOption>("off");
  const [practiceZoomMultiple, setPracticeZoomMultiple] = useState<number>(1);
  const [pitchShiftSemitones, setPitchShiftSemitonesState] = useState(0);
  const [expandedTool, setExpandedTool] = useState<PracticeTool | null>(null);

  const setPitchShiftSemitones = (value: number) => {
    setPitchShiftSemitonesState(clampPitchShiftSemitones(value));
  };

  const toggleTool = (tool: PracticeTool) => {
    setExpandedTool((prev) => (prev === tool ? null : tool));
  };

  const closeTool = () => setExpandedTool(null);

  return {
    mode,
    setMode,
    reelExpanded,
    setReelExpanded,
    markersVisible,
    setMarkersVisible,
    repeatEnabled,
    setRepeatEnabled,
    lyricsExpanded,
    setLyricsExpanded,
    notesExpanded,
    setNotesExpanded,
    queueExpanded,
    setQueueExpanded,
    countInOption,
    setCountInOption,
    practiceZoomMultiple,
    setPracticeZoomMultiple,
    pitchShiftSemitones,
    setPitchShiftSemitones,
    expandedTool,
    toggleTool,
    closeTool,
  };
}
