import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../common/BottomSheet";
import { styles } from "../../styles";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { deriveNotePreviewBody, deriveNotePreviewTitle } from "../../notepad";
import type { Note } from "../../types";

type Props = {
  visible: boolean;
  notes: Note[];
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSelect: (note: Note) => void;
};

export function NotePickerSheet({
  visible,
  notes,
  title = "Import from Lyrics Pad",
  subtitle = "Choose a page to add as a new lyrics version.",
  onClose,
  onSelect,
}: Props) {
  const groups = useMemo(() => {
    const sortDesc = (a: Note, b: Note) => b.updatedAt - a.updatedAt;
    const pinned = notes.filter((note) => note.isPinned).sort(sortDesc);
    const rest = notes.filter((note) => !note.isPinned).sort(sortDesc);
    return [
      { key: "pinned", label: "Pinned", items: pinned },
      { key: "all", label: "All pages", items: rest },
    ].filter((group) => group.items.length > 0);
  }, [notes]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={pickerStyles.title}>{title}</Text>
      <Text style={pickerStyles.subtitle}>{subtitle}</Text>

      {groups.length === 0 ? (
        <View style={pickerStyles.emptyState}>
          <Ionicons name="document-text-outline" size={24} color={colors.textMuted} />
          <Text style={pickerStyles.emptyText}>Your Lyrics Pad is empty — write a page first.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={pickerStyles.scroll}>
          {groups.map((group) => (
            <View key={group.key} style={pickerStyles.section}>
              <Text style={pickerStyles.sectionLabel}>{group.label}</Text>
              <View style={pickerStyles.optionList}>
                {group.items.map((note) => {
                  const noteTitle = deriveNotePreviewTitle(note);
                  const preview = deriveNotePreviewBody(note);
                  return (
                    <Pressable
                      key={note.id}
                      style={({ pressed }) => [
                        pickerStyles.option,
                        pressed ? styles.pressDown : null,
                      ]}
                      onPress={() => onSelect(note)}
                    >
                      <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                      <View style={pickerStyles.optionCopy}>
                        <Text style={pickerStyles.optionTitle} numberOfLines={1}>
                          {noteTitle}
                        </Text>
                        {preview ? (
                          <Text style={pickerStyles.optionPreview} numberOfLines={1}>
                            {preview}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const pickerStyles = StyleSheet.create({
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...textTokens.supporting,
    marginBottom: spacing.md,
  },
  scroll: {
    maxHeight: 420,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...textTokens.sectionTitle,
    marginBottom: spacing.sm,
  },
  optionList: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: colors.surfaceContainer,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  optionTitle: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  optionPreview: {
    ...textTokens.annotation,
    textTransform: "none",
    letterSpacing: 0,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...textTokens.supporting,
    textAlign: "center",
  },
});
