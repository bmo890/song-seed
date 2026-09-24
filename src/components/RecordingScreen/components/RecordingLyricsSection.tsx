import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PlayerLyricsPanel } from "../../PlayerScreen/PlayerLyricsPanel";
import { formatClipDate } from "../../../utils";
import type { LyricsLine } from "../../../types";

type RecordingLyricsSectionProps = {
  text: string;
  chordLines?: LyricsLine[];
  versionCount: number;
  updatedAt: number;
  elapsedMs: number;
  isRecording: boolean;
  isPaused: boolean;
  expanded: boolean;
  autoscrollMode: "off" | "follow" | "manual";
  autoscrollSpeedMultiplier: number;
  onToggleExpanded: (value: boolean) => void;
  onToggleAutoscroll: (enabled: boolean) => void;
  onAutoscrollInterrupted: () => void;
  onSelectAutoscrollSpeedMultiplier: (value: number) => void;
};

export function RecordingLyricsSection({
  text,
  chordLines,
  versionCount,
  updatedAt,
  elapsedMs,
  isRecording,
  isPaused,
  expanded,
  autoscrollMode,
  autoscrollSpeedMultiplier,
  onToggleExpanded,
  onToggleAutoscroll,
  onAutoscrollInterrupted,
  onSelectAutoscrollSpeedMultiplier,
}: RecordingLyricsSectionProps) {
  // One object per (mode, tenth of a second): PlayerLyricsPanel is memoized and a
  // fresh literal here defeated that memo on every recorder render.
  const autoscrollState = useMemo(
    () => ({ mode: autoscrollMode, currentTimeMs: elapsedMs, durationMs: elapsedMs, activeLineId: null }),
    [autoscrollMode, elapsedMs]
  );
  const { t } = useTranslation();
  return (
    <PlayerLyricsPanel
      text={text}
      chordLines={chordLines}
      versionLabel={t("lyrics.version", { number: versionCount })}
      // The app's recency ladder ("Yesterday", "Tue", "Jun 26"), not
      // toLocaleString's "27/07/2026, 16:08:48" — a machine stamp is the one
      // voice this app never uses.
      updatedAtLabel={formatClipDate(updatedAt)}
      autoscrollState={autoscrollState}
      variant="recording"
      expanded={expanded}
      defaultExpanded={false}
      onToggleExpanded={onToggleExpanded}
      autoscrollEnabled={autoscrollMode === "follow"}
      // Scroll is allowed when not take-paused; the panel decides idle (Test) vs take.
      autoscrollActive={!isPaused}
      isRecording={isRecording}
      autoscrollSpeedMultiplier={autoscrollSpeedMultiplier}
      onToggleAutoscroll={onToggleAutoscroll}
      onAutoscrollInterrupted={onAutoscrollInterrupted}
      onSelectAutoscrollSpeedMultiplier={onSelectAutoscrollSpeedMultiplier}
    />
  );
}
