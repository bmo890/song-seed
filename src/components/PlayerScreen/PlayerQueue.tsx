import { Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "../../styles";

type QueueEntry = {
  ideaId: string;
  clipId: string;
  title: string;
  subtitle: string;
};

type PlayerQueueProps = {
  entries: QueueEntry[];
  currentClipId: string | null;
  onSelect: (index: number) => void;
  compact?: boolean;
};

export function PlayerQueue({ entries, currentClipId, onSelect, compact = false }: PlayerQueueProps) {
  if (entries.length <= 1) return null;

  return (
    <View style={styles.card}>
      <View style={styles.statusRowSpaced}>
        <Text style={styles.cardTitle}>Queue</Text>
        <Text style={styles.cardMeta}>{entries.length} tracks</Text>
      </View>
      <ScrollView style={{ maxHeight: compact ? 132 : 220 }}>
        {entries.map((entry, index) => {
          const isActive = entry.clipId === currentClipId;
          return (
            <Pressable
              key={`${entry.ideaId}-${entry.clipId}`}
              style={({ pressed }) => [
                {
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isActive ? "#111827" : "#e5e7eb",
                  backgroundColor: isActive ? "#e2e8f0" : "#ffffff",
                  paddingHorizontal: 12,
                  paddingVertical: compact ? 8 : 10,
                  marginBottom: 8,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => onSelect(index)}
            >
              <Text style={[styles.cardTitle, { fontSize: compact ? 15 : 16 }]}>
                {index + 1}. {entry.title}
              </Text>
              <Text style={styles.cardMeta}>{entry.subtitle}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
