import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { useWordLadderScreenModel, type WordLadderTab } from "../hooks/useWordLadderScreenModel";
import { WordLadderColumnEditor } from "./WordLadderColumnEditor";
import { WordLadderPairingBoard } from "./WordLadderPairingBoard";
import { WordLadderLineCard } from "./WordLadderLineCard";
import { WordLadderSongExportSheet } from "./WordLadderSongExportSheet";
import { getColumnAPlaceholder, getSeedPlaceholder } from "../../../wordLadder";
import type { WordLadderMode } from "../../../types";

const KRAFT_BG = "#F2E9DC";

const TABS: Array<{ key: WordLadderTab; label: string }> = [
  { key: "words", label: "Words" },
  { key: "pairings", label: "Pair" },
  { key: "lines", label: "Lines" },
];

export function WordLadderScreenContent() {
  const model = useWordLadderScreenModel();
  const { exercise } = model;

  if (!exercise) {
    return (
      <SafeAreaView style={[contentStyles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <ScreenHeader title="Word Ladder" leftIcon="back" onLeftPress={model.goBack} />
        <View style={contentStyles.missingState}>
          <Ionicons name="trail-sign-outline" size={28} color={colors.textMuted} />
          <Text style={contentStyles.missingTitle}>This exercise is gone</Text>
          <Text style={contentStyles.missingBody}>
            It may have been deleted. Head back to the Lyrics Notebook to start a new one.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[contentStyles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Word Ladder"
        leftIcon="back"
        onLeftPress={model.goBack}
        rightElement={
          <Pressable
            style={({ pressed }) => [contentStyles.deleteBtn, pressed ? appStyles.pressDown : null]}
            onPress={model.deleteExercise}
            hitSlop={6}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <SeedHeader
        mode={exercise.mode}
        seedLabel={exercise.seedLabel}
        onChangeMode={model.setMode}
        onChangeSeed={model.setSeedLabel}
      />

      <View style={contentStyles.tabStrip}>
        {TABS.map((tab) => {
          const active = tab.key === model.activeTab;
          const badge =
            tab.key === "pairings"
              ? exercise.pairings.length
              : tab.key === "lines"
                ? exercise.lines.length
                : 0;
          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                contentStyles.tab,
                active ? contentStyles.tabActive : null,
                pressed ? appStyles.pressDown : null,
              ]}
              onPress={() => model.setActiveTab(tab.key)}
            >
              <Text style={[contentStyles.tabLabel, active ? contentStyles.tabLabelActive : null]}>
                {tab.label}
              </Text>
              {badge > 0 ? (
                <View style={[contentStyles.tabBadge, active ? contentStyles.tabBadgeActive : null]}>
                  <Text style={[contentStyles.tabBadgeText, active ? contentStyles.tabBadgeTextActive : null]}>
                    {badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {model.activeTab === "words" ? (
        <ScrollView
          style={contentStyles.scroll}
          contentContainerStyle={contentStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={contentStyles.columnsRow}>
            <WordLadderColumnEditor
              label={exercise.columnALabel}
              placeholder={getColumnAPlaceholder(exercise.mode)}
              words={exercise.columnA}
              tint="a"
              onAdd={(text) => model.addColumnWord("a", text)}
              onEdit={(id, text) => model.editColumnWord("a", id, text)}
              onReorder={(words) => model.reorderColumnWords("a", words)}
              onRemove={(id) => model.removeColumnWord("a", id)}
            />
            <WordLadderColumnEditor
              label="Nouns"
              placeholder="From the room, memory, anywhere…"
              words={exercise.columnB}
              tint="b"
              onAdd={(text) => model.addColumnWord("b", text)}
              onEdit={(id, text) => model.editColumnWord("b", id, text)}
              onReorder={(words) => model.reorderColumnWords("b", words)}
              onRemove={(id) => model.removeColumnWord("b", id)}
            />
          </View>
        </ScrollView>
      ) : null}

      {model.activeTab === "pairings" ? (
        <WordLadderPairingBoard
          exercise={exercise}
          armedWord={model.armedWord}
          onTapWord={model.handleWordTapForPairing}
          onUnpair={model.unpairWord}
          onToggleLock={model.toggleLockPairing}
          onShuffle={model.shuffle}
          onMakeLine={model.makeLineFromPairing}
        />
      ) : null}

      {model.activeTab === "lines" ? (
        <DraggableFlatList
          data={exercise.lines}
          keyExtractor={(line) => line.id}
          onDragEnd={({ data }) => model.reorderLines(data)}
          style={contentStyles.scroll}
          contentContainerStyle={contentStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={contentStyles.emptyHint}>
              No lines yet. Pair some words, then tap the pencil on a pair to turn it into a lyric scrap.
            </Text>
          }
          ListFooterComponent={
            exercise.lines.length > 0 ? (
              <Pressable
                style={({ pressed }) => [contentStyles.exportBtn, pressed ? appStyles.pressDown : null]}
                onPress={() => model.setSongExportVisible(true)}
              >
                <Ionicons name="send-outline" size={15} color={colors.onPrimary} />
                <Text style={contentStyles.exportBtnText}>Send to a song</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item: line, drag, isActive }) => (
            <WordLadderLineCard
              line={line}
              isActive={isActive}
              drag={drag}
              onChangeText={(text) => model.updateLineText(line.id, text)}
              onToggleStar={() => model.toggleStarLine(line.id)}
              onDelete={() => model.deleteLine(line.id)}
            />
          )}
        />
      ) : null}

      <WordLadderSongExportSheet
        visible={model.songExportVisible}
        songOptions={model.songOptions}
        onClose={() => model.setSongExportVisible(false)}
        onSelect={model.sendLinesToSong}
      />
    </SafeAreaView>
  );
}

function SeedHeader({
  mode,
  seedLabel,
  onChangeMode,
  onChangeSeed,
}: {
  mode: WordLadderMode;
  seedLabel: string;
  onChangeMode: (mode: WordLadderMode) => void;
  onChangeSeed: (text: string) => void;
}) {
  return (
    <View style={contentStyles.seedCard}>
      <View style={contentStyles.modeRow}>
        <ModePill label="Role / Person / Job" active={mode === "role"} onPress={() => onChangeMode("role")} />
        <ModePill label="Place / Location" active={mode === "place"} onPress={() => onChangeMode("place")} />
      </View>
      <TextInput
        style={contentStyles.seedInput}
        value={seedLabel}
        onChangeText={onChangeSeed}
        placeholder={getSeedPlaceholder(mode)}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function ModePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        contentStyles.modePill,
        active ? contentStyles.modePillActive : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <Text style={[contentStyles.modePillText, active ? contentStyles.modePillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const contentStyles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  missingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  missingTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  missingBody: {
    ...textTokens.supporting,
    textAlign: "center",
  },
  seedCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  modeRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  modePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: colors.primary,
  },
  modePillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  modePillTextActive: {
    color: colors.onPrimary,
  },
  seedInput: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 20,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  tabStrip: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: radii.round,
    padding: 3,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: radii.round,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.control,
  },
  tabLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.textPrimary,
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  tabBadgeActive: {
    backgroundColor: colors.primary,
  },
  tabBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    color: colors.textStrong,
  },
  tabBadgeTextActive: {
    color: colors.onPrimary,
  },
  columnsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  emptyHint: {
    ...textTokens.supporting,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  exportBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.onPrimary,
  },
});
