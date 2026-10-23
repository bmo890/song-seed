import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Press } from "../../common/Press";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { SearchField } from "../../common/SearchField";
import { EmptyState } from "../../common/EmptyState";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { DockAddBadgeIcon } from "../../common/dockIcons";
import { AppAlert } from "../../common/AppAlert";
import { NoteEditor } from "./NoteEditor";
import { LyricsSparkSheet } from "./LyricsSparkSheet";
import { useNotepadScreenModel, type NotebookEntry } from "../hooks/useNotepadScreenModel";
import { styles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { Note, WordLadderExercise, CutUpSpark, MagpieSpark } from "../../../types";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import {
  cutUpText,
  magpieText,
  sendSparkToPad,
  sparkDoneLabel,
  wordLadderText,
} from "../../common/sparkSend";
import { UserText } from "../../../i18n";
import {
  buildSearchPreviewSegments,
  deriveNotePreviewBody,
  deriveNotePreviewTitle,
} from "../../../domain/notepad";
import { i18n } from "../../../i18n/instance";
import { currentFormatLocale } from "../../../i18n/formatLocale";

function formatRelativeDate(ts: number, t: ReturnType<typeof useTranslation>["t"]) {
  const now = Date.now();
  const diffMs = now - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t("notepad.today");
  if (diffDays === 1) return t("notepad.yesterday");
  if (diffDays < 7) return t("notepad.daysAgo", { count: diffDays });

  // The app's language, not the device's (a Hebrew UI on an English phone).
  return new Date(ts).toLocaleDateString(currentFormatLocale(), { month: "short", day: "numeric" });
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
  const { t } = useTranslation();
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
    <Press
      haptic="none"
      style={[noteStyles.card,
        note.isPinned ? noteStyles.cardPinned : null,
        isSelected ? noteStyles.cardSelected : null]}
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
          <UserText align="content" value={note.body} style={noteStyles.cardPreview} numberOfLines={1}>
            {bodySegments.map((seg, i) => (
              <Text key={i} style={seg.kind === "match" ? noteStyles.matchText : undefined}>
                {seg.value}
              </Text>
            ))}
          </UserText>
        ) : fallbackPreview ? (
          <UserText align="content" value={fallbackPreview} style={noteStyles.cardPreview} numberOfLines={1}>
            {fallbackPreview}
          </UserText>
        ) : (
          <Text style={noteStyles.cardPreviewEmpty}>{t("notepad.emptyNote")}</Text>
        )}
        {showTimestamp ? (
          <Text style={noteStyles.cardMeta}>{formatRelativeDate(note.updatedAt, t)}</Text>
        ) : null}
      </View>

      {selectionMode ? (
        <View style={[noteStyles.selectIndicator, isSelected ? noteStyles.selectIndicatorChecked : null]}>
          {isSelected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
      ) : (
        <Press
          haptic="none"
          style={noteStyles.pinBtn}
          onPress={() => onTogglePin(note.id)}
          hitSlop={8}
        >
          <Ionicons
            name={note.isPinned ? "bookmark" : "bookmark-outline"}
            size={16}
            color={note.isPinned ? colors.primary : colors.textMuted}
          />
        </Press>
      )}
    </Press>
  );
}

type SparkItemProps<T extends { id: string; title: string }> = {
  spark: T;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: (spark: T) => void;
  onBeginSelection: (sparkId: string) => void;
  onToggleSelect: (sparkId: string) => void;
};

/**
 * One card for every spark (2026-10-17): your work, so the idea card's shell,
 * with a bare glyph for its method (no tinted disc). The meta line says what
 * it holds; the step it rests on sits where a card's time would. A title the
 * app made ("Untitled …") is a machine name: quiet Jakarta, and it reads as the
 * method; a title from your words earns Lora.
 */
function SparkListItem<T extends { id: string; title: string }>({
  spark,
  selectionMode,
  isSelected,
  onPress,
  onBeginSelection,
  onToggleSelect,
  icon,
  methodName,
  untitled,
  meta,
  stepLabel,
}: SparkItemProps<T> & {
  icon: keyof typeof Ionicons.glyphMap;
  methodName: string;
  untitled: boolean;
  meta: string;
  stepLabel: string;
}) {
  return (
    <Press
      haptic="none"
      style={[noteStyles.card, noteStyles.ladderCard, isSelected ? noteStyles.cardSelected : null]}
      onPress={() => onPress(spark)}
      onLongPress={() => {
        if (selectionMode) {
          onToggleSelect(spark.id);
          return;
        }
        // Haptics vocabulary: grab, a long-press into selection mode.
        haptic.grab();
        onBeginSelection(spark.id);
      }}
      delayLongPress={250}
    >
      <View style={noteStyles.sparkGlyph}>
        <Ionicons name={icon} size={18} color={colors.textStrong} />
      </View>
      <View style={noteStyles.cardBody}>
        {untitled ? (
          <Text style={noteStyles.cardTitleMachine} numberOfLines={1}>
            {methodName}
          </Text>
        ) : (
          <UserText value={spark.title} style={noteStyles.cardTitle} numberOfLines={1}>
            {spark.title}
          </UserText>
        )}
        <Text style={noteStyles.cardMeta} numberOfLines={1}>
          {untitled ? meta : `${methodName} · ${meta}`}
        </Text>
      </View>
      {selectionMode ? (
        <View style={[noteStyles.selectIndicator, isSelected ? noteStyles.selectIndicatorChecked : null]}>
          {isSelected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
      ) : (
        <Text style={noteStyles.sparkStep}>{stepLabel}</Text>
      )}
    </Press>
  );
}

// The app's own placeholder titles, in every language (a spark made in Hebrew keeps
// its Hebrew placeholder after a switch to English).
const UNTITLED_TITLES = new Set(
  ["en", "he"].flatMap((lng) => [i18n.t("wordLadder.untitled", { lng }), i18n.t("cutUp.untitled", { lng })])
);

function WordLadderListItem(props: SparkItemProps<WordLadderExercise>) {
  const notes = useStore((state) => state.notes);
  const hasPadPage = (noteId: string) => notes.some((note) => note.id === noteId);
  const { t } = useTranslation();
  const { spark } = props;
  const words = spark.columnA.length + spark.columnB.length;
  const listing = spark.step === "setup" || spark.step === "nouns";
  const meta = listing
    ? t("notepad.sparkWords", { count: words })
    : t("notepad.sparkPairs", { count: spark.pairings.length });
  const stepLabel =
    spark.step === "setup"
      ? t("wordLadder.verbs")
      : spark.step === "nouns"
        ? t("wordLadder.nouns")
        : t(`wordSparks.${spark.step === "pairs" ? "pair" : spark.step}`);
  return (
    <SparkListItem
      {...props}
      icon="shuffle-outline"
      methodName={t("wordSparks.wordLadder")}
      untitled={UNTITLED_TITLES.has(spark.title)}
      meta={meta}
      stepLabel={sparkDoneLabel(spark, hasPadPage) ?? stepLabel}
    />
  );
}

function CutUpListItem(props: SparkItemProps<CutUpSpark>) {
  const notes = useStore((state) => state.notes);
  const hasPadPage = (noteId: string) => notes.some((note) => note.id === noteId);
  const { t } = useTranslation();
  const { spark } = props;
  const onTable = spark.boardItems.filter((item) => !item.removed).length;
  const lines = spark.sourceText.split("\n").filter((line) => line.trim().length > 0).length;
  // Count what this step holds: the lines brought in, then the scraps on the table.
  const meta =
    spark.step === "source" || spark.step === "chunk" || onTable === 0
      ? t("notepad.sparkLines", { count: lines })
      : t("notepad.sparkScraps", { count: onTable });
  const step = spark.step === "chunk" ? "cut" : spark.step === "board" ? "arrange" : spark.step;
  return (
    <SparkListItem
      {...props}
      icon="cut-outline"
      methodName={t("wordSparks.cutUp")}
      untitled={UNTITLED_TITLES.has(spark.title)}
      meta={meta}
      stepLabel={sparkDoneLabel(spark, hasPadPage) ?? t(`wordSparks.${step}`)}
    />
  );
}

function MagpieListItem(props: SparkItemProps<MagpieSpark>) {
  const notes = useStore((state) => state.notes);
  const hasPadPage = (noteId: string) => notes.some((note) => note.id === noteId);
  const { t } = useTranslation();
  const { spark } = props;
  return (
    <SparkListItem
      {...props}
      icon="book-outline"
      methodName={t("wordSparks.magpie")}
      untitled={spark.title === t("magpie.untitledSpark")}
      meta={t("notepad.sparkWords", { count: spark.fragments.length })}
      stepLabel={sparkDoneLabel(spark, hasPadPage) ?? t(`wordSparks.${spark.step}`)}
    />
  );
}

export function NotepadScreenContent() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const {
    sections,
    totalNoteCount,
    sparkCount,
    activeTab,
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
  const [sparkSheetVisible, setSparkSheetVisible] = useState(false);
  // The route fixes the room: SparkHome renders this screen in sparks mode.
  const isSparkPage = activeTab === "sparks";

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

  const countLabel = isSparkPage
    ? t("notepad.sparkCountLabel", { count: sparkCount })
    : t("notepad.pageCount", { count: totalNoteCount });
  const pageEmpty = isSparkPage ? sparkCount === 0 : totalNoteCount === 0;
  const selectedCount =
    selectedNoteIds.length + selectedLadderIds.length + selectedCutUpIds.length + selectedMagpieIds.length;
  // Sparks support only Delete — the note-specific actions (Add to Song,
  // Pin, Duplicate, Share) don't apply, so a selection containing any spark
  // collapses the dock to just Delete.
  const hasSparkSelection =
    selectedLadderIds.length > 0 || selectedCutUpIds.length > 0 || selectedMagpieIds.length > 0;

  function confirmDeleteSelected() {
    AppAlert.destructive(
      t("notepad.deleteItem", { count: selectedCount }),
      t("notepad.cannotUndo"),
      handleDeleteSelected,
      { confirmLabel: t("notepad.delete") }
    );
  }

  function handleDuplicatePress() {
    const count = handleDuplicateSelected();
    AppAlert.info(t("notepad.duplicated"), t("notepad.duplicatedBody", { count }));
  }

  const deleteAction: SelectionAction = {
    key: "delete",
    label: t("notepad.delete"),
    icon: "trash-outline",
    tone: "danger",
    onPress: confirmDeleteSelected,
  };

  // One spark selected: it can go to the Lyric Pad from here too (a copy; the
  // spark stays).
  const singleSparkSelected =
    selectedNoteIds.length === 0 &&
    selectedLadderIds.length + selectedCutUpIds.length + selectedMagpieIds.length === 1;
  function sendSelectedSpark() {
    const state = useStore.getState();
    if (selectedLadderIds.length === 1) {
      const spark = state.wordLadders.find((item) => item.id === selectedLadderIds[0]);
      if (!spark) return;
      sendSparkToPad({
        text: wordLadderText(spark),
        title: spark.title,
        methodName: t("wordSparks.wordLadder"),
        savedLyricId: spark.savedLyricId,
        link: (noteId) => state.updateWordLadder(spark.id, { savedLyricId: noteId }),
        navigation,
      });
    } else if (selectedCutUpIds.length === 1) {
      const spark = state.cutUpSparks.find((item) => item.id === selectedCutUpIds[0]);
      if (!spark) return;
      sendSparkToPad({
        text: cutUpText(spark),
        title: spark.title,
        methodName: t("wordSparks.cutUp"),
        savedLyricId: spark.savedLyricId,
        link: (noteId) => state.updateCutUpSpark(spark.id, { savedLyricId: noteId }),
        navigation,
      });
    } else if (selectedMagpieIds.length === 1) {
      const spark = state.magpieSparks.find((item) => item.id === selectedMagpieIds[0]);
      if (!spark) return;
      sendSparkToPad({
        text: magpieText(spark),
        title: spark.title,
        methodName: t("wordSparks.magpie"),
        savedLyricId: spark.savedLyricId,
        link: (noteId) => state.updateMagpieSpark(spark.id, { savedLyricId: noteId }),
        navigation,
      });
    }
    cancelSelection();
  }
  const sendAction: SelectionAction = {
    key: "send",
    label: t("wordSparks.toPad"),
    icon: "document-text-outline",
    renderIcon: ({ color, size, disabled }) => (
      <DockAddBadgeIcon base="document-text-outline" color={color} size={size} disabled={disabled} />
    ),
    onPress: sendSelectedSpark,
  };

  const dockActions: SelectionAction[] = hasSparkSelection
    ? singleSparkSelected
      ? [sendAction, deleteAction]
      : [deleteAction]
    : [
        {
          key: "add-to-song",
          label: t("notepad.song"),
          icon: "albums-outline",
          renderIcon: ({ color, size, disabled }) => (
            <DockAddBadgeIcon base="albums-outline" color={color} size={size} disabled={disabled} />
          ),
          onPress: handleStartAddToSong,
        },
        {
          key: "pin",
          label: t(allSelectedPinned ? "notepad.unpin" : "notepad.pin"),
          icon: allSelectedPinned ? "bookmark" : "bookmark-outline",
          onPress: handleToggleSelectedPin,
        },
        deleteAction,
        {
          key: "more",
          label: t("notepad.more"),
          icon: "ellipsis-horizontal",
          onPress: () => setMoreVisible(true),
        },
      ];

  const sheetActions: SelectionAction[] = [
    {
      key: "duplicate",
      label: t("notepad.duplicate"),
      icon: "copy-outline",
      onPress: handleDuplicatePress,
    },
    {
      key: "share",
      label: t("notepad.share"),
      icon: "share-social-outline",
      onPress: handleShareSelected,
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {!selectionMode ? (
        <ScreenHeader
          title={t(isSparkPage ? "screens.lyricSpark" : "screens.lyricsPad")}
          variant={isSparkPage ? "tool" : "place"}
          rightElement={
            // One + per room: on the pad it writes a page; on the spark page it
            // opens the chooser for the three word tools.
            <Press
              haptic="none"
              testID={isSparkPage ? "lyrics-spark-open" : undefined}
              accessibilityRole="button"
              accessibilityLabel={t(isSparkPage ? "notepad.lyricsSpark" : "notepad.newPage")}
              style={listStyles.newBtn}
              onPress={isSparkPage ? () => setSparkSheetVisible(true) : handleNewNote}
              hitSlop={4}
            >
              <Ionicons name="add" size={22} color={colors.textStrong} />
            </Press>
          }
        />
      ) : null}

      {pageEmpty ? (
        <View style={listStyles.emptyFill}>
          <EmptyState
            // Sparks: no disc, the words and one key (2026-10-17).
            icon={isSparkPage ? undefined : "document-text-outline"}
            title={t(isSparkPage ? "notepad.noSparks" : "notepad.blankPage")}
            body={t(isSparkPage ? "notepad.noSparksHint" : "notepad.looseLines")}
            actionLabel={t(isSparkPage ? "notepad.startSpark" : "notepad.writeSomething")}
            onAction={isSparkPage ? () => setSparkSheetVisible(true) : handleNewNote}
          />
        </View>
      ) : (
        <>
          {!selectionMode ? <Text style={listStyles.countLabel}>{countLabel}</Text> : null}

          {/* Selection overlays the search row in place — the list below never
              gets pushed down on entering selection. */}
          <View>
            <SearchField
              value={searchQuery}
              placeholder={t(isSparkPage ? "notepad.searchSparks" : "notepad.searchLyrics")}
              onChangeText={setSearchQuery}
              containerStyle={listStyles.searchField}
            />
            {selectionMode ? (
              <SelectionTopBar
                overlay
                count={selectedCount}
                allSelected={allSelected}
                onSelectAll={selectAllVisible}
                onCancel={cancelSelection}
              />
            ) : null}
          </View>

          {sections.length === 0 && isSearching ? (
            <EmptyState
              compact
              icon="search-outline"
              title={t("notepad.noMatches")}
              body={t("notepad.searchHint")}
            />
          ) : sections.length === 0 ? (
            <EmptyState
              compact
              icon={activeTab === "sparks" ? "sparkles-outline" : "document-text-outline"}
              title={t(activeTab === "sparks" ? "notepad.noSparks" : "notepad.noLyrics")}
              body={t(activeTab === "sparks" ? "notepad.noSparksHint" : "notepad.noLyricsHint")}
            />
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
                          spark={entry.exercise}
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
        title={t("notepad.pageActions")}
        actions={sheetActions}
        onClose={() => setMoreVisible(false)}
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
  // A quiet number, not a grey pill (2026-10-17).
  sectionCount: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  sectionStack: {
    gap: spacing.sm,
  },
  // Whole-page empty: the canon EmptyState sits in the vertical middle of the
  // room, lifted a touch above true center so it reads as settled, not sunk.
  emptyFill: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 60,
  },
});

const noteStyles = StyleSheet.create({
  // A lyric page is content (2026-10-15): the idea card's shell, white, r12,
  // borderless with the whisper shadow; the 2px border stays reserved.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.card,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardPinned: {},
  cardSelected: {
    borderColor: colors.primary,
  },
  cardBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: "Lora_500Medium",
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  // The page's opening line, in the lyric's own voice.
  cardPreview: {
    fontFamily: "Lora_500Medium_Italic",
    fontSize: 14,
    lineHeight: 19,
    color: colors.textStrong,
  },
  cardPreviewEmpty: {
    ...textTokens.supporting,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  cardMeta: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
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
    backgroundColor: colors.primarySurface,
    color: colors.primaryDeep,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  ladderCard: {
    alignItems: "center",
  },
  sparkGlyph: {
    width: 22,
    alignItems: "center",
  },
  // A title the app made is a machine name: quiet Jakarta (earned-serif rule).
  cardTitleMachine: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  sparkStep: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textStrong,
  },
});
