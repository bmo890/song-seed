import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
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

type Snapshot = { title: string; body: string };

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

  // ── Undo / redo ───────────────────────────────────────────────────────────
  // History is stored in a ref (no re-render on push) but canUndo/canRedo are
  // state so the buttons update correctly.
  const historyRef = useRef<Snapshot[]>([{ title: note.title, body: note.body }]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Debounce timer — we batch rapid keystrokes into a single history entry.
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current note values so the debounce callback isn't stale.
  const noteRef = useRef<Snapshot>({ title: note.title, body: note.body });
  useEffect(() => {
    noteRef.current = { title: note.title, body: note.body };
  }, [note.title, note.body]);

  // Reset history whenever the user opens a different note.
  useEffect(() => {
    historyRef.current = [{ title: note.title, body: note.body }];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncUndoRedoState = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // Called after every user edit (debounced).
  const scheduleHistoryPush = useCallback(() => {
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      const snapshot = { ...noteRef.current };
      const history = historyRef.current;
      const idx = historyIndexRef.current;
      // Discard any redo entries.
      history.splice(idx + 1);
      history.push(snapshot);
      // Cap at 200 entries to avoid unbounded memory use.
      if (history.length > 200) history.shift();
      historyIndexRef.current = history.length - 1;
      syncUndoRedoState();
    }, 400);
  }, [syncUndoRedoState]);

  const handleUndo = useCallback(() => {
    if (historyDebounceRef.current) {
      // Flush any pending debounced snapshot first so we don't lose it.
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
      const snapshot = { ...noteRef.current };
      const history = historyRef.current;
      history.splice(historyIndexRef.current + 1);
      history.push(snapshot);
      if (history.length > 200) history.shift();
      historyIndexRef.current = history.length - 1;
    }
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const snap = historyRef.current[historyIndexRef.current];
    onUpdate({ title: snap.title, body: snap.body });
    syncUndoRedoState();
  }, [onUpdate, syncUndoRedoState]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const snap = historyRef.current[historyIndexRef.current];
    onUpdate({ title: snap.title, body: snap.body });
    syncUndoRedoState();
  }, [onUpdate, syncUndoRedoState]);

  // ── Delete confirmation ───────────────────────────────────────────────────
  const handleDeletePress = useCallback(() => {
    Alert.alert(
      "Delete note?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(note.id) },
      ],
      { cancelable: true }
    );
  }, [note.id, onDelete]);

  // ── Auto-focus new blank notes ────────────────────────────────────────────
  useEffect(() => {
    if (!note.title && !note.body) {
      setTimeout(() => bodyRef.current?.focus(), 100);
    }
  }, [note.id]);

  // ── Android hardware back ─────────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // ── Keyboard-on-selection ─────────────────────────────────────────────────
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
  }, []);

  const handleSelectionChange = useCallback(
    (e: { nativeEvent: { selection: { start: number; end: number } } }) => {
      const { start, end } = e.nativeEvent.selection;
      if (end > start) {
        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => bodyRef.current?.focus(), 50);
      }
    },
    []
  );

  return (
    <SafeAreaView style={editorStyles.shell} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={editorStyles.header}>
          {/* Back */}
          <Pressable
            style={({ pressed }) => [editorStyles.backBtn, pressed ? styles.pressDown : null]}
            onPress={onBack}
          >
            <Ionicons name="chevron-back" size={20} color="#524440" />
            <Text style={editorStyles.backLabel}>Notes</Text>
          </Pressable>

          {/* Right-side actions */}
          <View style={editorStyles.headerActions}>
            {/* Undo — always visible; dimmed when nothing to step back to */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed && canUndo ? styles.pressDown : null]}
              onPress={handleUndo}
              disabled={!canUndo}
            >
              <Ionicons name="arrow-undo-outline" size={20} color={canUndo ? "#524440" : "#c4b5b2"} />
            </Pressable>

            {/* Redo — always visible; dimmed when nothing to step forward to */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed && canRedo ? styles.pressDown : null]}
              onPress={handleRedo}
              disabled={!canRedo}
            >
              <Ionicons name="arrow-redo-outline" size={20} color={canRedo ? "#524440" : "#c4b5b2"} />
            </Pressable>

            {/* Pin */}
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

            {/* Delete (with confirmation) */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed ? styles.pressDown : null]}
              onPress={handleDeletePress}
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
            onChangeText={(text) => {
              onUpdate({ title: text });
              scheduleHistoryPush();
            }}
            placeholder="Title"
            placeholderTextColor="#c4b5b2"
            multiline={false}
            returnKeyType="next"
            blurOnSubmit
            onSubmitEditing={() => bodyRef.current?.focus()}
          />
          <View style={editorStyles.divider} />
          <Text style={editorStyles.timestamp}>{formatTimestamp(note.updatedAt)}</Text>
          <TextInput
            ref={bodyRef}
            style={editorStyles.body}
            value={note.body}
            onChangeText={(text) => {
              onUpdate({ body: text });
              scheduleHistoryPush();
            }}
            onSelectionChange={handleSelectionChange}
            placeholder="Start writing…"
            placeholderTextColor="#c4b5b2"
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
