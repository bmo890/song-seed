import React from "react";
import { Pressable, Text, View } from "react-native";
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

type OverdubStemEntry = {
  id: string;
  title: string;
  meta: string;
  gainDb: number;
  isMuted: boolean;
  tonePreset: string;
};

type PlayerSupportSectionsProps = {
  clipTitle: string;
  hasProjectLyrics: boolean;
  latestLyricsText: string;
  lyricsVersionCount: number;
  latestLyricsUpdatedAt: number | null;
  lyricsExpanded: boolean;
  hasClipOverdubs: boolean;
  clipOverdubStemCount: number;
  clipPlaybackUsesRenderedMix: boolean;
  overdubStemEntries: OverdubStemEntry[];
  onAddOverdub: () => void;
  onSaveCombined: () => void;
  onAdjustStemGain: (stemId: string, deltaDb: number) => void;
  onToggleStemMute: (stemId: string) => void;
  onToggleStemLowCut: (stemId: string) => void;
  onNudgeStem: (stemId: string, deltaMs: number) => void;
  onRemoveStem: (stemId: string) => void;
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
  clipTitle,
  hasProjectLyrics,
  latestLyricsText,
  lyricsVersionCount,
  latestLyricsUpdatedAt,
  lyricsExpanded,
  hasClipOverdubs,
  clipOverdubStemCount,
  clipPlaybackUsesRenderedMix,
  overdubStemEntries,
  onAddOverdub,
  onSaveCombined,
  onAdjustStemGain,
  onToggleStemMute,
  onToggleStemLowCut,
  onNudgeStem,
  onRemoveStem,
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

      {hasClipOverdubs ? (
        <PlayerSupportPanel
          title="Layers"
          meta={`${clipOverdubStemCount} ${clipOverdubStemCount === 1 ? "overdub" : "overdubs"}`}
          summary={
            clipPlaybackUsesRenderedMix
              ? "Playback is using the combined clip mix."
              : "This take has overdubs attached to the original clip."
          }
        >
          <View style={playerScreenStyles.layerToolbar}>
            <Pressable style={playerScreenStyles.layerToolbarButton} onPress={onAddOverdub}>
              <Text style={playerScreenStyles.layerToolbarButtonText}>Add overdub</Text>
            </Pressable>
            <Pressable style={playerScreenStyles.layerToolbarButton} onPress={onSaveCombined}>
              <Text style={playerScreenStyles.layerToolbarButtonText}>Save combined</Text>
            </Pressable>
          </View>

          <View style={playerScreenStyles.layerList}>
            <View style={playerScreenStyles.layerRow}>
              <View style={playerScreenStyles.layerRowCopy}>
                <Text style={playerScreenStyles.layerRowTitle} numberOfLines={1}>
                  {clipTitle}
                </Text>
                <Text style={playerScreenStyles.layerRowMeta}>Root clip</Text>
              </View>
            </View>

            {overdubStemEntries.map((stem) => (
              <View key={stem.id} style={playerScreenStyles.layerRow}>
                <View style={playerScreenStyles.layerRowCopy}>
                  <Text style={playerScreenStyles.layerRowTitle} numberOfLines={1}>
                    {stem.title}
                  </Text>
                  <Text style={playerScreenStyles.layerRowMeta}>
                    {stem.meta} • {stem.gainDb > 0 ? "+" : ""}
                    {stem.gainDb} dB
                    {stem.tonePreset === "low-cut" ? " • Low cut" : ""}
                  </Text>
                </View>
                <View style={playerScreenStyles.layerControls}>
                  <Pressable
                    style={playerScreenStyles.layerControlButton}
                    onPress={() => onAdjustStemGain(stem.id, -2)}
                  >
                    <Text style={playerScreenStyles.layerControlButtonText}>-2 dB</Text>
                  </Pressable>
                  <Pressable
                    style={playerScreenStyles.layerControlButton}
                    onPress={() => onAdjustStemGain(stem.id, 2)}
                  >
                    <Text style={playerScreenStyles.layerControlButtonText}>+2 dB</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      playerScreenStyles.layerControlButton,
                      stem.tonePreset === "low-cut" ? playerScreenStyles.layerControlButtonActive : null,
                    ]}
                    onPress={() => onToggleStemLowCut(stem.id)}
                  >
                    <Text
                      style={[
                        playerScreenStyles.layerControlButtonText,
                        stem.tonePreset === "low-cut" ? playerScreenStyles.layerControlButtonTextActive : null,
                      ]}
                    >
                      Low cut
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      playerScreenStyles.layerControlButton,
                      stem.isMuted ? playerScreenStyles.layerControlButtonActive : null,
                    ]}
                    onPress={() => onToggleStemMute(stem.id)}
                  >
                    <Text
                      style={[
                        playerScreenStyles.layerControlButtonText,
                        stem.isMuted ? playerScreenStyles.layerControlButtonTextActive : null,
                      ]}
                    >
                      {stem.isMuted ? "Muted" : "Mute"}
                    </Text>
                  </Pressable>
                </View>
                <View style={playerScreenStyles.layerControls}>
                  <Pressable
                    style={playerScreenStyles.layerControlButton}
                    onPress={() => onNudgeStem(stem.id, -25)}
                  >
                    <Text style={playerScreenStyles.layerControlButtonText}>-25 ms</Text>
                  </Pressable>
                  <Pressable
                    style={playerScreenStyles.layerControlButton}
                    onPress={() => onNudgeStem(stem.id, 25)}
                  >
                    <Text style={playerScreenStyles.layerControlButtonText}>+25 ms</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      playerScreenStyles.layerControlButton,
                      playerScreenStyles.layerControlButtonDestructive,
                    ]}
                    onPress={() => onRemoveStem(stem.id)}
                  >
                    <Text
                      style={[
                        playerScreenStyles.layerControlButtonText,
                        playerScreenStyles.layerControlButtonTextDestructive,
                      ]}
                    >
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </PlayerSupportPanel>
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
