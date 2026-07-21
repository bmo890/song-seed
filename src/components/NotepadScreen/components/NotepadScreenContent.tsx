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
import { DockAddBadgeIcon } from "../../common/dockIcons";
import { AppAlert } from "../../common/AppAlert";
import { NoteEditor } from "./NoteEditor";
import { NewLyricsPadItemSheet } from "./NewLyricsPadItemSheet";
import { LyricsSparkSheet } from "./LyricsSparkSheet";
import { useNotepadScreenModel, type NotebookEntry } from "../hooks/useNotepadScreenModel";
import { styles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { exerciseSummary } from "../../../domain/wordLadder";
import { cutUpSummary } from "../../../domain/cutUp";
import { magpieSummary } from "../../../domain/magpie";
import type { Note, WordLadderExercise, CutUpSpark, MagpieSpark } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";
import {
  buildSearchPreviewSegments,
  deriveNotePreviewBody,
  deriveNotePreviewTitle,
} from "../../../domain/notepad";

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
          <UserText value={title} style={noteStyles.cardTitle} numberOfLines={1}>
            {titleSegments.map((seg, i) => (
              <Text key={i} style={seg.kind === "match" ? noteStyles.matchText : undefined}>
                {seg.value}
              </Text>
            ))}
          </UserText>
        ) : (
          <UserText value={title} style={noteStyles.cardTitle} numberOfLines={1}>
            {title}
          </UserText>
        )}
        {bodySegments ? (
          <UserText value={note.body} style={noteStyles.cardPreview} numberOfLines={2}>
            {bodySegments.map((seg, i) => (
              <Text key={i} style={seg.kind === "match" ? noteStyles.matchText : undefined}>
                {seg.value}
              </Text>
            ))}
          </UserText>
        ) : fallbackPreview ? (
          <UserText value={fallbackPreview} style={noteStyles.cardPreview} numberOfLines={2}>
            {fallbackPreview}
          </UserText>
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

type WordLadderItemProps = {
  exercise: WordLadderExercise;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: (exercise: WordLadderExercise) => void;
  onBeginSelection: (ladderId: string) => void;
  onToggleSelect: (ladderId: string) => void;
};

function WordLadderListItem({
  exercise,
  selectionMode,
  isSelected,
  onPress,
  onBeginSelection,
  onToggleSelect,
}: WordLadderItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        noteStyles.card,
        noteStyles.ladderCard,
        isSelected ? noteStyles.cardSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={() => onPress(exercise)}
      onLongPress={() => (selectionMode ? onToggleSelect(exercise.id) : onBeginSelection(exercise.id))}
      delayLongPress={250}
    >
      <View style={noteStyles.ladderIconWrap}>
        <Ionicons name="shuffle-outline" size={16} color={colors.primary} />
      </View>
      <View style={noteStyles.cardBody}>
        <UserText value={exercise.title} style={noteStyles.cardTitle} numberOfLines={1}>
          {exercise.title}
        </UserText>
        <Text style={noteStyles.cardMeta}>WORD LADDER  ·  {exerciseSummary(exercise)}</Text>
      </View>
      {selectionMode ? (
        <View style={[noteStyles.selectIndicator, isSelected ? noteStyles.selectIndicatorChecked : null]}>
          {isSelected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

type CutUpItemProps = {
  spark: CutUpSpark;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: (spark: CutUpSpark) => void;
  onBeginSelection: (sparkId: string) => void;
  onToggleSelect: (sparkId: string) => void;
};

function CutUpListItem({
  spark,
  selectionMode,
  isSelected,
  onPress,
  onBeginSelection,
  onToggleSelect,
}: CutUpItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        noteStyles.card,
        noteStyles.ladderCard,
        isSelected ? noteStyles.cardSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={() => onPress(spark)}
      onLongPress={() => (selectionMode ? onToggleSelect(spark.id) : onBeginSelection(spark.id))}
      delayLongPress={250}
    >
      <View style={noteStyles.ladderIconWrap}>
        <Ionicons name="cut-outline" size={16} color={colors.primary} />
      </View>
      <View style={noteStyles.cardBody}>
        <UserText value={spark.title} style={noteStyles.cardTitle} numberOfLines={1}>
          {spark.title}
        </UserText>
        <Text style={noteStyles.cardMeta}>CUT-UP  ·  {cutUpSummary(spark)}</Text>
      </View>
      {selectionMode ? (
        <View style={[noteStyles.selectIndicator, isSelected ? noteStyles.selectIndicatorChecked : null]}>
          {isSelected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

type MagpieItemProps = {
  spark: MagpieSpark;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: (spark: MagpieSpark) => void;
  onBeginSelection: (sparkId: string) => void;
  onToggleSelect: (sparkId: string) => void;
};

function MagpieListItem({
  spark,
  selectionMode,
  isSelected,
  onPress,
  onBeginSelection,
  onToggleSelect,
}: MagpieItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        noteStyles.card,
        noteStyles.ladderCard,
        isSelected ? noteStyles.cardSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={() => onPress(spark)}
      onLongPress={() => (selectionMode ? onToggleSelect(spark.id) : onBeginSelection(spark.id))}
      delayLongPress={250}
    >
      <View style={noteStyles.ladderIconWrap}>
        <Ionicons name="book-outline" size={16} color={colors.primary} />
      </View>
      <View style={noteStyles.cardBody}>
        <UserText value={spark.title} style={noteStyles.cardTitle} numberOfLines={1}>
          {spark.title}
        </UserText>
        <Text style={noteStyles.cardMeta}>MAGPIE  ·  {magpieSummary(spark)}</Text>
      </View>
      {selectionMode ? (
        <View style={[noteStyles.selectIndicator, isSelected ? noteStyles.selectIndicatorChecked : null]}>
          {isSelected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

export function NotepadScreenContent() {
  const { t } = useTranslation();
  const {
    sections,
    totalEntryCount,
    sparkCount,
    activeTab,
    setActiveTab,
    isSearching,
    searchQuery,
    setSearchQuery,
    activeNote,
    handleNewNote,
    handleNewWordLadder,
    handleNewCutUp,
    handleNewMagpie,
    handleOpenNote,
    handleOpenLadder,
    handleOpenCutUp,
    handleOpenMagpie,
    handleCloseNote,
    handleUpdateNote,
    handleTogglePin,
    handleDeleteNote,

    selectionMode,
    selectedNoteIds,
    selectedLadderIds,
    selectedCutUpIds,
    selectedMagpieIds,
    allSelected,
    allSelectedPinned,
    beginSelection,
    beginLadderSelection,
    beginCutUpSelection,
    beginMagpieSelection,
    toggleSelectNote,
    toggleSelectLadder,
    toggleSelectCutUp,
    toggleSelectMagpie,
    cancelSelection,
    selectAllVisible,
    handleDeleteSelected,
    handleToggleSelectedPin,
    handleDuplicateSelected,
    handleShareSelected,
    handleStartAddToSong,
  } = useNotepadScreenModel();
  const [moreVisible, setMoreVisible] = useState(false);
  const [newItemSheetVisible, setNewItemSheetVisible] = useState(false);
  const [sparkSheetVisible, setSparkSheetVisible] = useState(false);

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
  const countLabel = `${totalEntryCount} page${totalEntryCount === 1 ? "" : "s"} of lyrics and loose lines.`;
  const selectedCount =
    selectedNoteIds.length + selectedLadderIds.length + selectedCutUpIds.length + selectedMagpieIds.length;
  // Sparks support only Delete — the note-specific actions (Add to Song,
  // Pin, Duplicate, Share) don't apply, so a selection containing any spark
  // collapses the dock to just Delete.
  const hasSparkSelection =
    selectedLadderIds.length > 0 || selectedCutUpIds.length > 0 || selectedMagpieIds.length > 0;

  function confirmDeleteSelected() {
    AppAlert.destructive(
      selectedCount === 1 ? "Delete item?" : `Delete ${selectedCount} items?`,
      "This can't be undone.",
      handleDeleteSelected,
      { confirmLabel: "Delete" }
    );
  }

  function handleDuplicatePress() {
    const count = handleDuplicateSelected();
    AppAlert.info("Duplicated", `${count} page${count === 1 ? "" : "s"} added as a copy.`);
  }

  const deleteAction: SelectionAction = {
    key: "delete",
    label: "Delete",
    icon: "trash-outline",
    tone: "danger",
    onPress: confirmDeleteSelected,
  };

  const dockActions: SelectionAction[] = hasSparkSelection
    ? [deleteAction]
    : [
        {
          key: "add-to-song",
          label: "Song",
          icon: "albums-outline",
          renderIcon: ({ color, size, disabled }) => (
            <DockAddBadgeIcon base="albums-outline" color={color} size={size} disabled={disabled} />
          ),
          onPress: handleStartAddToSong,
        },
        {
          key: "pin",
          label: allSelectedPinned ? "Unpin" : "Pin",
          icon: allSelectedPinned ? "bookmark" : "bookmark-outline",
          onPress: handleToggleSelectedPin,
        },
        deleteAction,
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
          title={t("screens.lyricsPad")}
          rightElement={
            <View style={listStyles.headerActions}>
              <Pressable
                testID="lyrics-spark-open"
                accessibilityRole="button"
                accessibilityLabel="Lyrics Spark"
                style={({ pressed }) => [listStyles.newBtn, pressed ? styles.pressDown : null]}
                onPress={() => setSparkSheetVisible(true)}
                hitSlop={4}
              >
                <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [listStyles.newBtn, pressed ? styles.pressDown : null]}
                onPress={() => setNewItemSheetVisible(true)}
                hitSlop={4}
              >
                <Ionicons name="add" size={22} color={colors.primary} />
              </Pressable>
            </View>
          }
        />
      ) : null}

      {totalEntryCount === 0 ? (
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

          {!selectionMode && sparkCount > 0 ? (
            <View style={listStyles.segmented}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === "lyrics" }}
                style={[listStyles.segment, activeTab === "lyrics" ? listStyles.segmentActive : null]}
                onPress={() => setActiveTab("lyrics")}
              >
                <Text
                  style={[listStyles.segmentLabel, activeTab === "lyrics" ? listStyles.segmentLabelActive : null]}
                >
                  Lyrics
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === "sparks" }}
                style={[listStyles.segment, activeTab === "sparks" ? listStyles.segmentActive : null]}
                onPress={() => setActiveTab("sparks")}
              >
                <Text
                  style={[listStyles.segmentLabel, activeTab === "sparks" ? listStyles.segmentLabelActive : null]}
                >
                  Sparks
                </Text>
                <View style={listStyles.segmentBadge}>
                  <Text style={listStyles.segmentBadgeText}>{sparkCount}</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          <SearchField
            value={searchQuery}
            placeholder={
              sparkCount > 0 ? (activeTab === "sparks" ? "Search sparks" : "Search lyrics") : "Search notes"
            }
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

          {sections.length === 0 && isSearching ? (
            <View style={listStyles.emptyState}>
              <Ionicons name="search-outline" size={26} color={colors.textMuted} />
              <Text style={listStyles.emptyTitle}>No matches</Text>
              <Text style={listStyles.emptyBody}>
                Try a different word — search looks through every page's title and body.
              </Text>
            </View>
          ) : sections.length === 0 ? (
            <View style={listStyles.emptyState}>
              <Ionicons
                name={activeTab === "sparks" ? "sparkles-outline" : "document-text-outline"}
                size={26}
                color={colors.textMuted}
              />
              <Text style={listStyles.emptyTitle}>
                {activeTab === "sparks" ? "No sparks yet" : "No lyrics yet"}
              </Text>
              <Text style={listStyles.emptyBody}>
                {activeTab === "sparks"
                  ? "Tap the sparkles to start a Word Ladder, Cut-Up, or Magpie."
                  : "Tap + to write a page, or the sparkles to pull a spark."}
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
                    <Text style={listStyles.sectionCount}>{section.entries.length}</Text>
                  </View>
                  <View style={listStyles.sectionStack}>
                    {section.entries.map((entry: NotebookEntry) =>
                      entry.kind === "note" ? (
                        <NoteListItem
                          key={entry.note.id}
                          note={entry.note}
                          searchQuery={searchQuery}
                          sectionKey={section.key}
                          selectionMode={selectionMode}
                          isSelected={selectedNoteIds.includes(entry.note.id)}
                          onPress={handleOpenNote}
                          onTogglePin={handleTogglePin}
                          onBeginSelection={beginSelection}
                          onToggleSelect={toggleSelectNote}
                        />
                      ) : entry.kind === "ladder" ? (
                        <WordLadderListItem
                          key={entry.exercise.id}
                          exercise={entry.exercise}
                          selectionMode={selectionMode}
                          isSelected={selectedLadderIds.includes(entry.exercise.id)}
                          onPress={handleOpenLadder}
                          onBeginSelection={beginLadderSelection}
                          onToggleSelect={toggleSelectLadder}
                        />
                      ) : entry.kind === "cutup" ? (
                        <CutUpListItem
                          key={entry.spark.id}
                          spark={entry.spark}
                          selectionMode={selectionMode}
                          isSelected={selectedCutUpIds.includes(entry.spark.id)}
                          onPress={handleOpenCutUp}
                          onBeginSelection={beginCutUpSelection}
                          onToggleSelect={toggleSelectCutUp}
                        />
                      ) : (
                        <MagpieListItem
                          key={entry.spark.id}
                          spark={entry.spark}
                          selectionMode={selectionMode}
                          isSelected={selectedMagpieIds.includes(entry.spark.id)}
                          onPress={handleOpenMagpie}
                          onBeginSelection={beginMagpieSelection}
                          onToggleSelect={toggleSelectMagpie}
                        />
                      )
                    )}
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

      <NewLyricsPadItemSheet
        visible={newItemSheetVisible}
        onClose={() => setNewItemSheetVisible(false)}
        onNewPage={() => {
          setNewItemSheetVisible(false);
          handleNewNote();
        }}
      />

      <LyricsSparkSheet
        visible={sparkSheetVisible}
        onClose={() => setSparkSheetVisible(false)}
        onNewWordLadder={() => {
          setSparkSheetVisible(false);
          handleNewWordLadder();
        }}
        onNewCutUp={() => {
          setSparkSheetVisible(false);
          handleNewCutUp();
        }}
        onNewMagpie={() => {
          setSparkSheetVisible(false);
          handleNewMagpie();
        }}
      />
    </SafeAreaView>
  );
}

const listStyles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
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
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    padding: 3,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: colors.surface,
  },
  segmentLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
  },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.textStrong,
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
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ladderCard: {
    alignItems: "center",
  },
  ladderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
});
