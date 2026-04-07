import React from "react";
import { Text, View } from "react-native";
import { PlayerLyricsPanel } from "../PlayerLyricsPanel";
import { PlayerQueue } from "../PlayerQueue";
import { PlayerSupportPanel } from "../PlayerSupportPanel";
import { formatDate } from "../../../utils";
import { playerScreenStyles } from "../styles";

type QueueEntry = {
  ideaId: string;
  clipId: string;
  title: string;
  subtitle: string;
};

type PlayerSupportSectionsProps = {
  hasProjectLyrics: boolean;
  latestLyricsText: string;
  lyricsVersionCount: number;
  latestLyricsUpdatedAt: number | null;
  lyricsExpanded: boolean;
  clipNotes: string;
  clipNotesSummary: string;
  notesExpanded: boolean;
  queueEntries: QueueEntry[];
  currentClipId: string;
  queueExpanded: boolean;
  onToggleLyricsExpanded: (value: boolean) => void;
  onToggleNotesExpanded: (value: boolean) => void;
  onToggleQueueExpanded: (value: boolean) => void;
  onSelectQueueEntry: (index: number) => void;
};

export function PlayerSupportSections({
  hasProjectLyrics,
  latestLyricsText,
  lyricsVersionCount,
  latestLyricsUpdatedAt,
  lyricsExpanded,
  clipNotes,
  clipNotesSummary,
  notesExpanded,
  queueEntries,
  currentClipId,
  queueExpanded,
  onToggleLyricsExpanded,
  onToggleNotesExpanded,
  onToggleQueueExpanded,
  onSelectQueueEntry,
}: PlayerSupportSectionsProps) {
  return (
    <View style={playerScreenStyles.supportStack}>
      {hasProjectLyrics && latestLyricsUpdatedAt !== null ? (
        <PlayerLyricsPanel
          text={latestLyricsText}
          versionLabel={`Version ${lyricsVersionCount}`}
          updatedAtLabel={formatDate(latestLyricsUpdatedAt)}
          autoscrollState={{
            mode: "off",
            currentTimeMs: 0,
            durationMs: 0,
            activeLineId: null,
          }}
          defaultExpanded={false}
          expanded={lyricsExpanded}
          onToggleExpanded={onToggleLyricsExpanded}
        />
      ) : null}

      <PlayerSupportPanel
        title="Clip notes"
        meta={clipNotes.trim() ? "Attached to this take" : "No notes saved"}
        summary={clipNotesSummary}
        expanded={notesExpanded}
        onToggleExpanded={onToggleNotesExpanded}
      >
        <Text
          style={[
            playerScreenStyles.notesText,
            !clipNotes.trim() ? playerScreenStyles.notesPlaceholder : null,
          ]}
        >
          {clipNotes.trim() || "This clip does not have notes yet."}
        </Text>
      </PlayerSupportPanel>

      {queueEntries.length > 1 ? (
        <PlayerSupportPanel
          title="Queue"
          meta={`${queueEntries.length} clips`}
          summary={`${queueEntries.length} clips lined up for playback.`}
          expanded={queueExpanded}
          onToggleExpanded={onToggleQueueExpanded}
        >
          <PlayerQueue
            entries={queueEntries}
            currentClipId={currentClipId}
            compact={hasProjectLyrics}
            onSelect={onSelectQueueEntry}
          />
        </PlayerSupportPanel>
      ) : null}
    </View>
  );
}
