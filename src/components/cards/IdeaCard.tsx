import { Pressable, Text, View } from "react-native";
import { styles } from "../../styles";
import { SongIdea } from "../../types";
import { fmt } from "../../utils";
import { StatusBadge } from "../common/StatusBadge";

type Props = {
    idea: SongIdea;
    onPress: () => void;
};

export function IdeaCard({ idea, onPress }: Props) {
    const primary = idea.clips.find((c) => c.isPrimary) ?? null;

    return (
        <Pressable style={styles.card} onPress={onPress}>
            <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{idea.title}</Text>
                <StatusBadge status={idea.status} />
            </View>
            <Text style={styles.cardMeta}>{idea.notes || "No idea notes yet"}</Text>
            <Text style={styles.cardMeta}>
                {primary
                    ? `Primary: ${primary.title}${primary.durationMs ? ` • ${fmt(primary.durationMs)}` : ""}`
                    : "No primary clip yet"}
            </Text>
        </Pressable>
    );
}
