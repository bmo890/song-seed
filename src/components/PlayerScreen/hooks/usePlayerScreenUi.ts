import { useCallback, useState } from "react";
import { clampPitchShiftSemitones } from "../../../domain/pitchShift";

export type PlayerMode = "player" | "practice";
/** The two readable artifacts a sketch can hang on a take. */
export type ReadingArtifact = "lyrics" | "chart";
/** The reading ladder (settled 2026-08-06): closed → reading (slim reel) →
 *  full view (no reel, hairline thread). Play-along is no longer a mode — it's
 *  the `followEnabled` property of an open artifact. */
export type ReadingAltitude = "reading" | "full";
// "3s" is a run-up of the SONG (seek back three seconds, then play) — the honest
// count-in for a take without a grid; the bar options click the take's own grid.
export type CountInOption = "off" | "3s" | "1b" | "2b";
/** Practice tools. pins/loop/sections expand inline (accordion); speed/pitch/countin/click open a popover. */
export type PracticeTool = "pins" | "loop" | "sections" | "speed" | "pitch" | "countin" | "click";

export function usePlayerScreenUi() {
  const [mode, setModeState] = useState<PlayerMode>("player");
  const [reelExpanded, setReelExpanded] = useState(false);
  const [markersVisible, setMarkersVisible] = useState(true);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [readingArtifact, setReadingArtifact] = useState<ReadingArtifact | null>(null);
  const [readingAltitude, setReadingAltitude] = useState<ReadingAltitude>("reading");
  const [followEnabled, setFollowEnabled] = useState(false);
  // Text-size multiplier for the open artifact — persists across doors within a session.
  const [readingZoom, setReadingZoom] = useState(1);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [layersExpanded, setLayersExpanded] = useState(false);
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

  // Opening Tools closes the reading surface — the practice console needs the
  // full-height reel back, and returning to "player" reopens at the doors.
  const setMode = useCallback((next: PlayerMode) => {
    setModeState(next);
    if (next === "practice") {
      setReadingArtifact(null);
      setReadingAltitude("reading");
      setFollowEnabled(false);
    }
  }, []);

  const openReading = useCallback((artifact: ReadingArtifact) => {
    setModeState("player");
    setReadingArtifact(artifact);
    setReadingAltitude("reading");
  }, []);

  const closeReading = useCallback(() => {
    setReadingArtifact(null);
    setReadingAltitude("reading");
    setFollowEnabled(false);
  }, []);

  return {
    mode,
    setMode,
    readingArtifact,
    readingAltitude,
    setReadingAltitude,
    followEnabled,
    setFollowEnabled,
    readingZoom,
    setReadingZoom,
    openReading,
    closeReading,
    reelExpanded,
    setReelExpanded,
    markersVisible,
    setMarkersVisible,
    repeatEnabled,
    setRepeatEnabled,
    notesExpanded,
    setNotesExpanded,
    layersExpanded,
    setLayersExpanded,
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
