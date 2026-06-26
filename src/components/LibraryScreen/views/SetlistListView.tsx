import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import type { Setlist } from "../../../types";

export function SetlistListView({
  setlists,
  onCreate,
  onOpen,
}: {
  setlists: Setlist[];
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inputRow}>
        <Button label="Create Setlist" onPress={onCreate} />
      </View>

      <View style={styles.listContent}>
        {setlists.map((setlist) => (
          <Pressable
            key={setlist.id}
            style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
            onPress={() => onOpen(setlist.id)}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="albums-outline" size={18} color="#0f172a" />
                <Text style={styles.cardTitle}>{setlist.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </View>
            <Text style={styles.cardMeta}>
              {setlist.entries.length} {setlist.entries.length === 1 ? "song" : "songs"}
            </Text>
          </Pressable>
        ))}

        {setlists.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No setlists yet</Text>
            <Text style={styles.cardMeta}>
              Build an ordered set of songs — pick the clips and charts each one needs — then share it as a
              ready-to-play file for your band.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
