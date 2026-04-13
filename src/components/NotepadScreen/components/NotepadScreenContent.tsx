import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { NoteEditor } from "./NoteEditor";
import { useNotepadScreenModel } from "../hooks/useNotepadScreenModel";
import { styles } from "../../../styles";
import type { Note } from "../../../types";

function formatRelativeDate(ts: number) {
  const now = Date.now();
  const diffMs = now - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function derivePreviewTitle(note: Note) {
  if (note.title.trim()) return note.title.trim();
  const firstLine = note.body.trim().split("\n")[0] ?? "";
  return firstLine.trim() || "New Note";
}

function derivePreviewBody(note: Note) {
  if (!note.title.trim()) {
    const lines = note.body.trim().split("\n");
    return lines.slice(1).join(" ").trim() || null;
  }
  return note.body.trim() || null;
}

type NoteItemProps = {
  note: Note;
  onPress: (note: Note) => void;
  onTogglePin: (noteId: string) => void;
};

function NoteListItem({ note, onPress, onTogglePin }: NoteItemProps) {
  const title = derivePreviewTitle(note);
  const preview = derivePreviewBody(note);

  return (
    <Pressable
      style={({ pressed }) => [noteStyles.card, pressed ? styles.pressDown : null]}
      onPress={() => onPress(note)}
    >
      <View style={noteStyles.cardBody}>
        <Text style={noteStyles.cardTitle} numberOfLines={1}>{title}</Text>
        {preview ? (
          <Text style={noteStyles.cardPreview} numberOfLines={2}>{preview}</Text>
        ) : null}
        <Text style={noteStyles.cardMeta}>
          {note.isPinned ? "PINNED  ·  " : ""}{formatRelativeDate(note.updatedAt).toUpperCase()}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [noteStyles.pinBtn, pressed ? styles.pressDown : null]}
        onPress={() => onTogglePin(note.id)}
        hitSlop={8}
      >
        <Ionicons
          name={note.isPinned ? "bookmark" : "bookmark-outline"}
          size={16}
          color={note.isPinned ? "#824f3f" : "#c4b5b2"}
        />
      </Pressable>
    </Pressable>
  );
}

export function NotepadScreenContent() {
  const {
    sortedNotes,
    activeNote,
    handleNewNote,
    handleOpenNote,
    handleCloseNote,
    handleUpdateNote,
    handleTogglePin,
    handleDeleteNote,
  } = useNotepadScreenModel();

  if (activeNote) {
    return (
      <NoteEditor
        note={activeNote}
        onBack={handleCloseNote}
        onUpdate={handleUpdateNote}
        onTogglePin={handleTogglePin}
        onDelete={handleDeleteNote}
      />
    );
  }

  return (
    <SafeAreaView style={listStyles.shell} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Notepad"
        rightElement={
          <Pressable
            style={({ pressed }) => [listStyles.newBtn, pressed ? styles.pressDown : null]}
            onPress={handleNewNote}
          >
            <Ionicons name="add" size={22} color="#824f3f" />
          </Pressable>
        }
      />

      {sortedNotes.length === 0 ? (
        <View style={listStyles.emptyState}>
          <Ionicons name="pencil-outline" size={36} color="#c4b5b2" />
          <Text style={listStyles.emptyTitle}>No notes yet</Text>
          <Text style={listStyles.emptyBody}>
            Tap the pencil to capture a fleeting idea, lyric, or anything worth keeping.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={listStyles.scroll}
          contentContainerStyle={listStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              onPress={handleOpenNote}
              onTogglePin={handleTogglePin}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const listStyles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#fbf9f5",
    paddingHorizontal: 16,
  },
  newBtn: {
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
    gap: 8,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1b1c1a",
  },
  emptyBody: {
    fontSize: 14,
    color: "#84736f",
    textAlign: "center",
    lineHeight: 22,
  },
});

const noteStyles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 4,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1b1c1a",
    lineHeight: 22,
  },
  cardPreview: {
    fontSize: 13,
    color: "#524440",
    lineHeight: 19,
  },
  cardMeta: {
    fontSize: 10,
    color: "#84736f",
    fontWeight: "600",
    letterSpacing: 0.05,
    textTransform: "uppercase",
    marginTop: 2,
  },
  pinBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
});
