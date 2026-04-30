import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import * as Clipboard from "expo-clipboard";
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
  const [liveSelection, setLiveSelection] = useState({ start: 0, end: 0 });
  const [selectionOverride, setSelectionOverride] = useState<
    { start: number; end: number } | null
  >(null);
  const [barVisible, setBarVisible] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  // Snapshot of the last non-empty selection — used by action handlers because
  // the live selection often collapses the moment a button is tapped (Android
  // blurs the input on outside-tap and clears the highlight before onPress fires).
  const lastNonEmptyRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    if (!note.title && !note.body) {
      setTimeout(() => bodyRef.current?.focus(), 100);
    }
  }, [note.id]);

  // Override Android hardware back to return to the notes list, not the drawer/parent.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // Clear programmatic selection override after one render so the input is
  // free again for normal user-driven selection changes.
  useEffect(() => {
    if (!selectionOverride) return;
    const t = setTimeout(() => setSelectionOverride(null), 50);
    return () => clearTimeout(t);
  }, [selectionOverride]);

  // Bar visibility — explicit only: bar shows the moment we see a non-empty
  // selection. It does NOT auto-hide based on selection changes (those are
  // racy: Android blurs the input the instant you tap outside, which collapses
  // the highlight before onPress fires). Bar hides only on explicit user
  // intent: tapping an action, typing in the body, or the close (×) button.
  useEffect(() => {
    const live = liveSelection.end > liveSelection.start;
    if (live) {
      lastNonEmptyRef.current = liveSelection;
      setBarVisible(true);
    }
  }, [liveSelection]);

  const activeSelection =
    liveSelection.end > liveSelection.start ? liveSelection : lastNonEmptyRef.current;
  const hasUsableSelection = activeSelection.end > activeSelection.start;
  const selectedText = hasUsableSelection
    ? note.body.slice(activeSelection.start, activeSelection.end)
    : "";
  const selectedLineCount = hasUsableSelection ? selectedText.split("\n").length : 0;
  const selectedCharCount = hasUsableSelection ? selectedText.length : 0;

  const collapseAfterAction = useCallback((collapsedAt: number) => {
    const collapsed = { start: collapsedAt, end: collapsedAt };
    setLiveSelection(collapsed);
    lastNonEmptyRef.current = { start: 0, end: 0 };
    setSelectionOverride(collapsed);
    setBarVisible(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!hasUsableSelection) return;
    await Clipboard.setStringAsync(selectedText);
    setCopiedFlash(true);
    setTimeout(() => setCopiedFlash(false), 1200);
  }, [hasUsableSelection, selectedText]);

  const handleDeleteSelection = useCallback(() => {
    if (!hasUsableSelection) return;
    const newBody =
      note.body.slice(0, activeSelection.start) + note.body.slice(activeSelection.end);
    onUpdate({ body: newBody });
    collapseAfterAction(activeSelection.start);
  }, [hasUsableSelection, activeSelection, note.body, onUpdate, collapseAfterAction]);

  const handleCut = useCallback(async () => {
    if (!hasUsableSelection) return;
    await Clipboard.setStringAsync(selectedText);
    const newBody =
      note.body.slice(0, activeSelection.start) + note.body.slice(activeSelection.end);
    onUpdate({ body: newBody });
    collapseAfterAction(activeSelection.start);
  }, [hasUsableSelection, selectedText, activeSelection, note.body, onUpdate, collapseAfterAction]);

  return (
    <SafeAreaView style={editorStyles.shell} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
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
            onChangeText={(text) => {
              onUpdate({ body: text });
              // User started typing — selection (if any) was replaced.
              if (barVisible) setBarVisible(false);
            }}
            selection={selectionOverride ?? undefined}
            onSelectionChange={(e) => setLiveSelection(e.nativeEvent.selection)}
            placeholder="Start writing…"
            placeholderTextColor="#c4b5b2"
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            contextMenuHidden
          />
        </ScrollView>

        {barVisible ? (
          <View style={editorStyles.selectionBar}>
            <Pressable
              style={({ pressed }) => [editorStyles.selectionDismiss, pressed ? styles.pressDown : null]}
              onPress={() => setBarVisible(false)}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color="#84736f" />
            </Pressable>
            <Text style={editorStyles.selectionLabel}>
              {selectedLineCount === 1 ? "1 line" : `${selectedLineCount} lines`}
              {"  ·  "}
              {selectedCharCount === 1 ? "1 char" : `${selectedCharCount} chars`}
            </Text>
            <View style={editorStyles.selectionActions}>
              <Pressable
                style={({ pressed }) => [editorStyles.selectionBtn, pressed ? styles.pressDown : null]}
                onPress={handleCut}
              >
                <Ionicons name="cut-outline" size={18} color="#1b1c1a" />
                <Text style={editorStyles.selectionBtnLabel}>Cut</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [editorStyles.selectionBtn, pressed ? styles.pressDown : null]}
                onPress={handleCopy}
              >
                <Ionicons
                  name={copiedFlash ? "checkmark" : "copy-outline"}
                  size={18}
                  color={copiedFlash ? "#4a7c5e" : "#1b1c1a"}
                />
                <Text
                  style={[
                    editorStyles.selectionBtnLabel,
                    copiedFlash ? { color: "#4a7c5e" } : null,
                  ]}
                >
                  {copiedFlash ? "Copied" : "Copy"}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  editorStyles.selectionBtn,
                  editorStyles.selectionBtnDanger,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={handleDeleteSelection}
              >
                <Ionicons name="trash-outline" size={18} color="#ffffff" />
                <Text style={[editorStyles.selectionBtnLabel, { color: "#ffffff" }]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#efeeea",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  selectionDismiss: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  selectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#84736f",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#e4deda",
    borderRadius: 4,
  },
  selectionBtnDanger: {
    backgroundColor: "#824f3f",
  },
  selectionBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1b1c1a",
  },
});
