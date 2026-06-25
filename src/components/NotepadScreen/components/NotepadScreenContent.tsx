import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { SearchField } from "../../common/SearchField";
import { Button } from "../../common/Button";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { AppAlert } from "../../common/AppAlert";
import { NoteEditor } from "./NoteEditor";
import { useNotepadScreenModel } from "../hooks/useNotepadScreenModel";
import { styles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
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
  sectionKey: string;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: (note: Note) => void;
  onTogglePin: (noteId: string) => void;
  onBeginSelection: (noteId: string) => void;
  onToggleSelect: (noteId: string) => void;
};

function NoteListItem({
  note,
  searchQuery,
  sectionKey,
  selectionMode,
  isSelected,
  onPress,
  onTogglePin,
  onBeginSelection,
  onToggleSelect,
}: NoteItemProps) {
  const title = deriveNotePreviewTitle(note);
  const fallbackPreview = deriveNotePreviewBody(note);
  const trimmedQuery = searchQuery.trim();

  const titleSegments = trimmedQuery
    ? buildSearchPreviewSegments(title, trimmedQuery)
    : null;
  const bodySegments = trimmedQuery
    ? buildSearchPreviewSegments(note.body, trimmedQuery)
    : null;

  const showTimestamp = sectionKey === "thisWeek" || sectionKey === "earlier";

  return (
    <Pressable
      style={({ pressed }) => [
        noteStyles.card,
        note.isPinned ? noteStyles.cardPinned : null,
        isSelected ? noteStyles.cardSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={() => onPress(note)}
      onLongPress={() => (selectionMode ? onToggleSelect(note.id) : onBeginSelection(note.id))}
      delayLongPress={250}
    >
      <View style={noteStyles.cardBody}>
        {titleSegments ? (
          <Text style={noteStyles.cardTitle} numberOfLines={1}>
            {titleSegments.map((seg, i) => (
              <Text key={i} style={seg.kind === "match" ? noteStyles.matchText : undefined}>
                {seg.value}
              </Text>
            ))}
          </Text>
        ) : (
          <Text style={noteStyles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
        )}
        {bodySegments ? (
          <Text style={noteStyles.cardPreview} numberOfLines={2}>
            {bodySegments.map((seg, i) => (
              <Text key={i} style={seg.kind === "match" ? noteStyles.matchText : undefined}>
                {seg.value}
              </Text>
            ))}
          </Text>
        ) : fallbackPreview ? (
          <Text style={noteStyles.cardPreview} numberOfLines={2}>
            {fallbackPreview}
          </Text>
        ) : (
          <Text style={noteStyles.cardPreviewEmpty}>Empty note</Text>
        )}
        {showTimestamp ? (
          <Text style={noteStyles.cardMeta}>{formatRelativeDate(note.updatedAt).toUpperCase()}</Text>
        ) : null}
      </View>

      {selectionMode ? (
        <View style={[noteStyles.selectIndicator, isSelected ? noteStyles.selectIndicatorChecked : null]}>
          {isSelected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [noteStyles.pinBtn, pressed ? styles.pressDown : null]}
          onPress={() => onTogglePin(note.id)}
          hitSlop={8}
        >
          <Ionicons
            name={note.isPinned ? "bookmark" : "bookmark-outline"}
            size={16}
            color={note.isPinned ? colors.primary : colors.textMuted}
          />
        </Pressable>
      )}
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

    selectionMode,
    selectedNoteIds,
    allSelected,
    allSelectedPinned,
    beginSelection,
    toggleSelectNote,
    cancelSelection,
    selectAllVisible,
    handleDeleteSelected,
    handleToggleSelectedPin,
    handleDuplicateSelected,
    handleShareSelected,
    handleStartAddToSong,
  } = useNotepadScreenModel();
  const [moreVisible, setMoreVisible] = useState(false);

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

  const emptyBody = "Verses, hooks, and lines that don't have a song yet.";
  const countLabel = `${totalNoteCount} page${totalNoteCount === 1 ? "" : "s"} of lyrics and loose lines.`;
  const selectedCount = selectedNoteIds.length;

  function confirmDeleteSelected() {
    AppAlert.destructive(
      selectedCount === 1 ? "Delete page?" : `Delete ${selectedCount} pages?`,
      "This can't be undone.",
      handleDeleteSelected,
      { confirmLabel: "Delete" }
    );
  }

  function handleDuplicatePress() {
    const count = handleDuplicateSelected();
    AppAlert.info("Duplicated", `${count} page${count === 1 ? "" : "s"} added as a copy.`);
  }

  const dockActions: SelectionAction[] = [
    {
      key: "add-to-song",
      label: "Add to Song",
      icon: "albums-outline",
      onPress: handleStartAddToSong,
    },
    {
      key: "pin",
      label: allSelectedPinned ? "Unpin" : "Pin",
      icon: allSelectedPinned ? "bookmark" : "bookmark-outline",
      onPress: handleToggleSelectedPin,
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash-outline",
      tone: "danger",
      onPress: confirmDeleteSelected,
    },
    {
      key: "more",
      label: "More",
      icon: "ellipsis-horizontal",
      onPress: () => setMoreVisible(true),
    },
  ];

  const sheetActions: SelectionAction[] = [
    {
      key: "duplicate",
      label: "Duplicate",
      icon: "copy-outline",
      onPress: handleDuplicatePress,
    },
    {
      key: "share",
      label: "Share",
      icon: "share-social-outline",
      onPress: handleShareSelected,
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {!selectionMode ? (
        <ScreenHeader
          title="Lyrics Pad"
          rightElement={
            <Pressable
              style={({ pressed }) => [listStyles.newBtn, pressed ? styles.pressDown : null]}
              onPress={handleNewNote}
              hitSlop={4}
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </Pressable>
          }
        />
      ) : null}

      {totalNoteCount === 0 ? (
        <View style={listStyles.emptyState}>
          <View style={listStyles.emptyIconWrap}>
            <Ionicons name="document-text-outline" size={26} color={colors.primary} />
          </View>
          <Text style={listStyles.emptyTitle}>A blank page</Text>
          <Text style={listStyles.emptyBody}>{emptyBody}</Text>
          <Button label="Write something" onPress={handleNewNote} style={listStyles.emptyAction} />
        </View>
      ) : (
        <>
          {!selectionMode ? <Text style={listStyles.countLabel}>{countLabel}</Text> : null}
          <SearchField
            value={searchQuery}
            placeholder="Search notes"
            onChangeText={setSearchQuery}
            containerStyle={listStyles.searchField}
          />

          {selectionMode ? (
            <View style={listStyles.selectionBarWrap}>
              <SelectionTopBar
                count={selectedCount}
                allSelected={allSelected}
                onSelectAll={selectAllVisible}
                onCancel={cancelSelection}
              />
            </View>
          ) : null}

          {isSearching && sections.length === 0 ? (
            <View style={listStyles.emptyState}>
              <Ionicons name="search-outline" size={26} color={colors.textMuted} />
              <Text style={listStyles.emptyTitle}>No matches</Text>
              <Text style={listStyles.emptyBody}>
                Try a different word — search looks through every page's title and body.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={listStyles.scroll}
              contentContainerStyle={[
                listStyles.scrollContent,
                selectionMode ? listStyles.scrollContentSelecting : null,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sections.map((section) => (
                <View key={section.key} style={listStyles.section}>
                  <View style={listStyles.sectionHeaderRow}>
                    <Text style={listStyles.sectionLabel}>{section.label}</Text>
                    <Text style={listStyles.sectionCount}>{section.notes.length}</Text>
                  </View>
                  <View style={listStyles.sectionStack}>
                    {section.notes.map((note) => (
                      <NoteListItem
                        key={note.id}
                        note={note}
                        searchQuery={searchQuery}
                        sectionKey={section.key}
                        selectionMode={selectionMode}
                        isSelected={selectedNoteIds.includes(note.id)}
                        onPress={handleOpenNote}
                        onTogglePin={handleTogglePin}
                        onBeginSelection={beginSelection}
                        onToggleSelect={toggleSelectNote}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {selectionMode ? <SelectionDock actions={dockActions} /> : null}

      <SelectionActionSheet
        visible={moreVisible}
        title="Page actions"
        actions={sheetActions}
        onClose={() => setMoreVisible(false)}
      />
    </SafeAreaView>
  );
}

const listStyles = StyleSheet.create({
  newBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.round,
  },
  countLabel: {
    ...textTokens.supporting,
    marginBottom: spacing.md,
  },
  searchField: {
    marginBottom: spacing.lg,
  },
  selectionBarWrap: {
    marginBottom: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 22,
    paddingBottom: 32,
  },
  scrollContentSelecting: {
    paddingBottom: 100,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    ...textTokens.sectionTitle,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  sectionCount: {
    ...textTokens.caption,
    color: colors.textStrong,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.round,
    overflow: "hidden",
  },
  sectionStack: {
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: 36,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 20,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...textTokens.supporting,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyAction: {
    marginTop: spacing.md,
  },
});

const noteStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardPinned: {
    borderLeftColor: colors.primary,
    borderLeftWidth: 2,
  },
  cardSelected: {
    borderColor: colors.primary,
  },
  cardBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  cardPreview: {
    ...textTokens.supporting,
    lineHeight: 17,
  },
  cardPreviewEmpty: {
    ...textTokens.supporting,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  cardMeta: {
    ...textTokens.annotation,
    marginTop: 2,
  },
  pinBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  selectIndicator: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  selectIndicatorChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  matchText: {
    backgroundColor: "#f0d4cc",
    color: "#5c2d1e",
    fontWeight: "700",
  },
});
