import { useCallback, useState } from "react";
import { clampPitchShiftSemitones } from "../../../domain/pitchShift";

/** "layers" is the bench (2026-08-07): a reel-anchored surface like practice —
 *  lanes fatten into a selector, one bench below serves the selected layer. */
export type PlayerMode = "player" | "practice" | "layers";
/** The two readable artifacts a sketch can hang on a take. */
export type ReadingArtifact = "lyrics" | "chart";
/** The reading ladder (settled 2026-08-06): closed → reading (slim reel) →
 *  full view (no reel, hairline thread). Follow is not a mode — it's the
 *  `followEnabled` property of an open artifact. */
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
  // Write-against-the-tape: the lyrics artifact open as an EDITOR (slim reel +
  // loop stay live above the text). Only meaningful with readingArtifact "lyrics".
  const [lyricsWriting, setLyricsWriting] = useState(false);
  // Text-size multiplier for the open artifact — persists across doors within a session.
  const [readingZoom, setReadingZoom] = useState(1);
  // Chord lines over the lyrics: on by default when the version carries chords;
  // the Aa sheet can switch them off for a words-only read.
  const [chordsVisible, setChordsVisible] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(false);
  // The bench's selected lane: a stem id, or "root" for the base take.
  const [benchLayerId, setBenchLayerId] = useState<string>("root");
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

  // Opening Tools or the bench closes the reading surface — both need the reel
  // back at height, and returning to "player" reopens at the doors.
  const setMode = useCallback((next: PlayerMode) => {
    setModeState(next);
    if (next !== "player") {
      setReadingArtifact(null);
      setReadingAltitude("reading");
      setFollowEnabled(false);
      setLyricsWriting(false);
    }
  }, []);

  const openReading = useCallback((artifact: ReadingArtifact) => {
    setModeState("player");
    setReadingArtifact(artifact);
    setReadingAltitude("reading");
    setLyricsWriting(false);
  }, []);

  // Writing pins the ladder at the reading altitude — the slim reel with its
  // loop is the whole point of writing against the tape.
  const openWriting = useCallback(() => {
    setModeState("player");
    setReadingArtifact("lyrics");
    setReadingAltitude("reading");
    setFollowEnabled(false);
    setLyricsWriting(true);
  }, []);

  const closeReading = useCallback(() => {
    setReadingArtifact(null);
    setReadingAltitude("reading");
    setFollowEnabled(false);
    setLyricsWriting(false);
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
    chordsVisible,
    setChordsVisible,
    openReading,
    closeReading,
    lyricsWriting,
    openWriting,
    stopWriting: () => setLyricsWriting(false),
    reelExpanded,
    setReelExpanded,
    markersVisible,
    setMarkersVisible,
    repeatEnabled,
    setRepeatEnabled,
    notesExpanded,
    setNotesExpanded,
    benchLayerId,
    setBenchLayerId,
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
