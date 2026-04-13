import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import type { Note } from "../../../types";

type Props = {
  note: Note;
  onBack: () => void;
  onUpdate: (updates: { title?: string; body?: string }) => void;
  onTogglePin: (noteId: string) => void;
  onDelete: (noteId: string) => void;
};

function formatTimestamp(ts: number) {
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NoteEditor({ note, onBack, onUpdate, onTogglePin, onDelete }: Props) {
  const bodyRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!note.title && !note.body) {
      setTimeout(() => bodyRef.current?.focus(), 100);
    }
  }, [note.id]);

  return (
    <SafeAreaView style={editorStyles.shell} edges={["top", "bottom"]}>
      <View style={editorStyles.header}>
        <Pressable
          style={({ pressed }) => [editorStyles.backBtn, pressed ? styles.pressDown : null]}
          onPress={onBack}
        >
          <Ionicons name="chevron-back" size={20} color="#524440" />
          <Text style={editorStyles.backLabel}>Notes</Text>
        </Pressable>
        <View style={editorStyles.headerActions}>
          <Pressable
            style={({ pressed }) => [editorStyles.iconBtn, pressed ? styles.pressDown : null]}
            onPress={() => onTogglePin(note.id)}
          >
            <Ionicons
              name={note.isPinned ? "bookmark" : "bookmark-outline"}
              size={20}
              color={note.isPinned ? "#824f3f" : "#84736f"}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [editorStyles.iconBtn, pressed ? styles.pressDown : null]}
            onPress={() => onDelete(note.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#84736f" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={editorStyles.scroll}
        contentContainerStyle={editorStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={editorStyles.title}
          value={note.title}
          onChangeText={(text) => onUpdate({ title: text })}
          placeholder="Title"
          placeholderTextColor="#c4b5b2"
          multiline={false}
          returnKeyType="next"
          blurOnSubmit
          onSubmitEditing={() => bodyRef.current?.focus()}
        />
        <View style={editorStyles.divider} />
        <Text style={editorStyles.timestamp}>
          {formatTimestamp(note.updatedAt)}
        </Text>
        <TextInput
          ref={bodyRef}
          style={editorStyles.body}
          value={note.body}
          onChangeText={(text) => onUpdate({ body: text })}
          placeholder="Start writing…"
          placeholderTextColor="#c4b5b2"
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const editorStyles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#fbf9f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backLabel: {
    fontSize: 16,
    color: "#524440",
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1b1c1a",
    lineHeight: 34,
    paddingVertical: 0,
    marginBottom: 12,
  },
  divider: {
    height: 0.5,
    backgroundColor: "#d7c2bd",
    opacity: 0.5,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 11,
    color: "#84736f",
    fontWeight: "600",
    letterSpacing: 0.05,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: "#1b1c1a",
    lineHeight: 26,
    minHeight: 300,
    paddingVertical: 0,
  },
});
