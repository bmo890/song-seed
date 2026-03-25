import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";

type ClipNotesPreviewProps = {
  notes: string;
  disabled?: boolean;
  onPress?: () => void;
};

export function ClipNotesPreview({ notes, disabled, onPress }: ClipNotesPreviewProps) {
  const trimmedNotes = notes.trim();
  if (!trimmedNotes) {
    return null;
  }

  return (
    <Pressable
      style={styles.clipCardNotesPreview}
      onPress={disabled ? undefined : onPress}
      hitSlop={disabled ? undefined : { top: 4, bottom: 4 }}
      disabled={disabled}
    >
      <Ionicons name="document-text-outline" size={11} color="#94a3b8" />
      <Text style={styles.clipCardNotesPreviewText} numberOfLines={1}>
        {trimmedNotes}
      </Text>
    </Pressable>
  );
}
