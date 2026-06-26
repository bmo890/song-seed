import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { colors, spacing } from "../../../design/tokens";

type PickerWorkspace = { id: string; title: string; songs: Array<{ id: string; title: string }> };
type BuilderSong = {
  title: string;
  clips: Array<{ id: string; title: string; isPrimary: boolean }>;
  versions: Array<{ id: string; label: string }>;
  hasChordSheet: boolean;
};

function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name={checked ? "checkmark-circle" : "ellipse-outline"}
          size={20}
          color={checked ? colors.primary : "#cbd5e1"}
        />
      </View>
    </Pressable>
  );
}

export function SetlistEntryBuilderView({
  ideaId,
  isEditing,
  song,
  workspaces,
  clipIds,
  lyricVersionIds,
  includeChordSheet,
  onSelectSong,
  onToggleClip,
  onToggleVersion,
  onToggleChordSheet,
  onConfirm,
}: {
  ideaId: string | null;
  isEditing: boolean;
  song: BuilderSong | null;
  workspaces: PickerWorkspace[];
  clipIds: string[];
  lyricVersionIds: string[];
  includeChordSheet: boolean;
  onSelectSong: (workspaceId: string, ideaId: string) => void;
  onToggleClip: (clipId: string) => void;
  onToggleVersion: (versionId: string) => void;
  onToggleChordSheet: () => void;
  onConfirm: () => void;
}) {
  if (!ideaId || !song) {
    return (
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.libraryScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.cardMeta}>Pick a song to add to the setlist.</Text>
        <View style={styles.listContent}>
          {workspaces.map((workspace) => (
            <View key={workspace.id}>
              <Text style={[styles.cardMeta, { marginTop: 12, marginBottom: 4 }]}>{workspace.title}</Text>
              {workspace.songs.map((s) => (
                <Pressable
                  key={s.id}
                  style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                  onPress={() => onSelectSong(workspace.id, s.id)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name="musical-notes-outline" size={16} color="#0f172a" />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {s.title}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          {workspaces.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMeta}>No songs available.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  const total = clipIds.length + lyricVersionIds.length + (includeChordSheet ? 1 : 0);

  return (
    <View style={styles.flexFill}>
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.libraryScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.cardTitle}>{song.title}</Text>

        <Text style={[styles.cardMeta, { marginTop: spacing.md, marginBottom: 4 }]}>CLIPS</Text>
        {song.clips.length === 0 ? (
          <Text style={styles.cardMeta}>No clips recorded for this song.</Text>
        ) : (
          <View style={styles.listContent}>
            {song.clips.map((clip) => (
              <CheckRow
                key={clip.id}
                label={clip.isPrimary ? `${clip.title}  (main)` : clip.title}
                checked={clipIds.includes(clip.id)}
                onPress={() => onToggleClip(clip.id)}
              />
            ))}
          </View>
        )}

        <Text style={[styles.cardMeta, { marginTop: spacing.md, marginBottom: 4 }]}>CHARTS</Text>
        <View style={styles.listContent}>
          {song.versions.map((version) => (
            <CheckRow
              key={version.id}
              label={`${version.label} — lyrics`}
              checked={lyricVersionIds.includes(version.id)}
              onPress={() => onToggleVersion(version.id)}
            />
          ))}
          {song.hasChordSheet ? (
            <CheckRow label="Chord chart" checked={includeChordSheet} onPress={onToggleChordSheet} />
          ) : null}
          {song.versions.length === 0 && !song.hasChordSheet ? (
            <Text style={styles.cardMeta}>No charts on this song yet.</Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={styles.inputRow}>
        <Button
          label={isEditing ? "Save" : total > 0 ? `Add (${total})` : "Add"}
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}
