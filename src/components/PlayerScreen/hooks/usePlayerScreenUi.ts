import { useState } from "react";
import { clampPitchShiftSemitones } from "../../../pitchShift";

export type PlayerMode = "player" | "practice";
export type CountInOption = "off" | "1b" | "2b";

export function usePlayerScreenUi() {
  const [mode, setMode] = useState<PlayerMode>("player");
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [countInOption, setCountInOption] = useState<CountInOption>("off");
  const [practiceZoomMultiple, setPracticeZoomMultiple] = useState<number>(1);
  const [pitchShiftSemitones, setPitchShiftSemitonesState] = useState(0);

  const setPitchShiftSemitones = (value: number) => {
    setPitchShiftSemitonesState(clampPitchShiftSemitones(value));
  };

  return {
    mode,
    setMode,
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
  };
}
