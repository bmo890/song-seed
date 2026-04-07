import React from "react";
import { PlayerLyricsPanel } from "../PlayerScreen/PlayerLyricsPanel";
import { formatDate } from "../../utils";

type RecordingLyricsSectionProps = {
  text: string;
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
  return (
    <PlayerLyricsPanel
      text={text}
      versionLabel={`Version ${versionCount}`}
      updatedAtLabel={formatDate(updatedAt)}
      autoscrollState={{
        mode: autoscrollMode,
        currentTimeMs: elapsedMs,
        durationMs: elapsedMs,
        activeLineId: null,
      }}
      variant="recording"
      expanded={expanded}
      defaultExpanded={false}
      onToggleExpanded={onToggleExpanded}
      autoscrollEnabled={autoscrollMode === "follow"}
      autoscrollActive={isRecording && !isPaused}
      autoscrollSpeedMultiplier={autoscrollSpeedMultiplier}
      onToggleAutoscroll={onToggleAutoscroll}
      onAutoscrollInterrupted={onAutoscrollInterrupted}
      onSelectAutoscrollSpeedMultiplier={onSelectAutoscrollSpeedMultiplier}
    />
  );
}
