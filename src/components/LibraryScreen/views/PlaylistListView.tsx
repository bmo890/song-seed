import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import type { Playlist } from "../../../types";

function formatPlaylistUpdatedAt(timestamp: number) {
  const now = Date.now();
  const ageHours = Math.max(0, Math.floor((now - timestamp) / 3600000));
  if (ageHours < 1) return "Updated just now";
  if (ageHours < 24) return `Updated ${ageHours}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 7) return `Updated ${ageDays}d ago`;
  return `Updated ${new Date(timestamp).toLocaleDateString("en-US")}`;
}

export function PlaylistListView({
  playlists,
  onCreatePlaylist,
  onOpenPlaylist,
}: {
  playlists: Playlist[];
  onCreatePlaylist: () => void;
  onOpenPlaylist: (playlistId: string) => void;
}) {
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inputRow}>
        <Button label="Create Playlist" onPress={onCreatePlaylist} />
      </View>

      <View style={styles.listContent}>
        {playlists.map((playlist) => (
          <Pressable
            key={playlist.id}
            style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
            onPress={() => onOpenPlaylist(playlist.id)}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="list-outline" size={18} color="#0f172a" />
                <Text style={styles.cardTitle}>{playlist.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </View>
            <View style={styles.workspaceBrowseCollectionMetaRow}>
              <Text style={styles.cardMeta}>
                {playlist.items.length} {playlist.items.length === 1 ? "item" : "items"}
              </Text>
              <Text style={styles.cardMeta}>•</Text>
              <Text style={styles.cardMeta}>{formatPlaylistUpdatedAt(playlist.updatedAt)}</Text>
            </View>
          </Pressable>
        ))}

        {playlists.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No playlists yet</Text>
            <Text style={styles.cardMeta}>
              Create a playlist to collect songs and clips without changing the queue.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
