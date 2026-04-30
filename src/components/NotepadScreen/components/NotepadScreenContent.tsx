import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { NoteEditor } from "./NoteEditor";
import { useNotepadScreenModel } from "../hooks/useNotepadScreenModel";
import { styles } from "../../../styles";
import type { Note } from "../../../types";
import {
  buildSearchPreviewSegments,
  deriveNotePreviewBody,
  deriveNotePreviewTitle,
} from "../../../notepad";

function formatRelativeDate(ts: number) {
  const now = Date.now();
  const diffMs = now - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type NoteItemProps = {
  note: Note;
  searchQuery: string;
  onPress: (note: Note) => void;
  onTogglePin: (noteId: string) => void;
};

function NoteListItem({ note, searchQuery, onPress, onTogglePin }: NoteItemProps) {
  const title = deriveNotePreviewTitle(note);
  const fallbackPreview = deriveNotePreviewBody(note);
  const trimmedQuery = searchQuery.trim();

  const titleSegments = trimmedQuery
    ? buildSearchPreviewSegments(title, trimmedQuery)
    : null;
  const bodySegments = trimmedQuery
    ? buildSearchPreviewSegments(note.body, trimmedQuery)
    : null;

  return (
    <Pressable
      style={({ pressed }) => [noteStyles.card, pressed ? styles.pressDown : null]}
      onPress={() => onPress(note)}
    >
      <View style={noteStyles.cardBody}>
        {titleSegments ? (
          <Text style={noteStyles.cardTitle} numberOfLines={1}>
            {titleSegments.map((seg, i) => (
              <Text
                key={i}
                style={seg.kind === "match" ? noteStyles.matchText : undefined}
              >
                {seg.value}
              </Text>
            ))}
          </Text>
        ) : (
          <Text style={noteStyles.cardTitle} numberOfLines={1}>{title}</Text>
        )}
        {bodySegments ? (
          <Text style={noteStyles.cardPreview} numberOfLines={2}>
            {bodySegments.map((seg, i) => (
              <Text
                key={i}
                style={seg.kind === "match" ? noteStyles.matchText : undefined}
              >
                {seg.value}
              </Text>
            ))}
          </Text>
        ) : fallbackPreview ? (
          <Text style={noteStyles.cardPreview} numberOfLines={2}>{fallbackPreview}</Text>
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
    sections,
    totalNoteCount,
    isSearching,
    searchQuery,
    setSearchQuery,
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

      {totalNoteCount === 0 ? (
        <View style={listStyles.emptyState}>
          <Pressable
            style={({ pressed }) => [listStyles.emptyAction, pressed ? styles.pressDown : null]}
            onPress={handleNewNote}
          >
            <Ionicons name="add" size={28} color="#824f3f" />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={listStyles.searchBar}>
            <Ionicons name="search" size={16} color="#84736f" />
            <TextInput
              style={listStyles.searchInput}
              placeholder="Search notes"
              placeholderTextColor="#a89994"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={({ pressed }) => [listStyles.searchClear, pressed ? styles.pressDown : null]}
              >
                <Ionicons name="close-circle" size={16} color="#84736f" />
              </Pressable>
            ) : null}
          </View>

          {isSearching && sections.length === 0 ? (
            <View style={listStyles.emptyState}>
              <Ionicons name="search" size={28} color="#c4b5b2" />
              <Text style={listStyles.emptyTitle}>No matches</Text>
            </View>
          ) : (
            <ScrollView
              style={listStyles.scroll}
              contentContainerStyle={listStyles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sections.map((section) => (
                <View key={section.key} style={listStyles.section}>
                  <Text style={listStyles.sectionLabel}>{section.label}</Text>
                  <View style={listStyles.sectionList}>
                    {section.notes.map((note) => (
                      <NoteListItem
                        key={note.id}
                        note={note}
                        searchQuery={searchQuery}
                        onPress={handleOpenNote}
                        onTogglePin={handleTogglePin}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </>
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
    gap: 20,
    paddingBottom: 32,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#84736f",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  sectionList: {
    gap: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyAction: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#efeeea",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#84736f",
    letterSpacing: 0.3,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#efeeea",
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1b1c1a",
    paddingVertical: 0,
  },
  searchClear: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
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
  matchText: {
    backgroundColor: "#f0d4cc",
    color: "#5c2d1e",
    fontWeight: "700",
  },
});
