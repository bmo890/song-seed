import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { SegmentedControl } from "./SegmentedControl";
import { styles as appStyles } from "../../styles";
import { colors, radii, spacing } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { durations } from "../../design/motion";
import {
  EXTENDED_WORD_MODE_GROUPS,
  fetchWordDefinitions,
  fetchWordSuggestions,
  groupBySyllableCount,
  partOfSpeechLabel,
  sanitizeThemeWords,
  WORD_LOOKUP_MODE_ORDER,
  WORD_LOOKUP_MODES,
  WordLookupOfflineError,
  type WordDefinition,
  type WordLookupMode,
  type WordSuggestion,
} from "../../wordTools";

const LOOKUP_DEBOUNCE_MS = 350;
/** Fixed body height so the sheet never jumps as content changes. */
const SHEET_BODY_HEIGHT = 440;
/** Chips shown per syllable group / flat list before "+ n more". */
const GROUP_CHIP_CAP = 10;
const FLAT_CHIP_CAP = 24;

const EXTENDED_MODES: WordLookupMode[] = EXTENDED_WORD_MODE_GROUPS.flatMap((group) => group.modes);

/** The segmented row: the four quick modes plus a More tab for extended tools. */
const MORE_TAB = "__more";
type SegmentKey = WordLookupMode | typeof MORE_TAB;

type WordFinderSheetProps = {
  visible: boolean;
  /** Word detected under the cursor/selection when the sheet was opened. */
  initialWord: string;
  onClose: () => void;
  /** Called when the writer taps a suggestion to place it into the lyric. */
  onPickWord: (word: string) => void;
};

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; suggestions: WordSuggestion[] }
  | { status: "offline" }
  | { status: "error" };

type PreviewState = {
  word: string;
  status: "loading" | "loaded" | "empty" | "offline" | "error";
  defs: WordDefinition[];
};

/**
 * Word Finder — one quiet surface for every word lookup while writing lyrics.
 *
 * The body is a fixed-height stage so the sheet never resizes while browsing.
 * Modes live in one segmented row: Rhymes / Near / Similar / Related / More —
 * More reveals a chip row of extended tools (sound / meaning / imagery).
 * A labeled Theme row biases every mode toward the song's subject. Holding a
 * suggestion takes over the sheet with its definition; from there, inserting
 * or exploring the word are explicit buttons — never a surprise navigation.
 */
export function WordFinderSheet({ visible, initialWord, onClose, onPickWord }: WordFinderSheetProps) {
  const [query, setQuery] = useState(initialWord);
  const [quickMode, setQuickMode] = useState<WordLookupMode>("rhymes");
  const [moreTab, setMoreTab] = useState(false);
  // Remembered across More visits so the tab reopens on the last-used tool.
  const [extendedMode, setExtendedMode] = useState<WordLookupMode | null>(null);
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  // Theme is deliberately sticky across opens — a writer sets it once per song.
  const [theme, setTheme] = useState("");
  const [themeExpanded, setThemeExpanded] = useState(false);
  const [drillStack, setDrillStack] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [expandedChipKeys, setExpandedChipKeys] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);

  /** The mode actually queried; null while More is open with no tool picked. */
  const activeMode: WordLookupMode | null = moreTab ? extendedMode : quickMode;

  // Re-seed from the editor each time the sheet opens on a new word.
  useEffect(() => {
    if (!visible) return;
    setQuery(initialWord);
    setQuickMode("rhymes");
    setMoreTab(false);
    setDrillStack([]);
    setPreview(null);
    setThemeExpanded(false);
    setExpandedChipKeys(new Set());
  }, [visible, initialWord]);

  const themeActive = sanitizeThemeWords(theme).length > 0;

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (!trimmed || !activeMode) {
      setLookup({ status: "idle" });
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setLookup({ status: "loading" });

    const timer = setTimeout(() => {
      fetchWordSuggestions(activeMode, trimmed, { signal: controller.signal, theme })
        .then((suggestions) => {
          if (requestId !== requestIdRef.current) return;
          setExpandedChipKeys(new Set());
          setLookup({ status: "results", suggestions });
        })
        .catch((error) => {
          if (requestId !== requestIdRef.current || controller.signal.aborted) return;
          setLookup(error instanceof WordLookupOfflineError ? { status: "offline" } : { status: "error" });
        });
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, query, activeMode, theme]);

  const handlePick = (word: string) => {
    haptic.tap();
    onPickWord(word);
  };

  /** Explore: look the suggestion itself up, keeping the current mode. */
  const drillInto = (word: string) => {
    haptic.grab();
    setPreview(null);
    setDrillStack((prev) => [...prev, query]);
    setQuery(word);
  };

  const drillBack = () => {
    haptic.tap();
    setDrillStack((prev) => {
      const next = [...prev];
      const previous = next.pop();
      if (previous !== undefined) setQuery(previous);
      return next;
    });
  };

  /** Long-press: the definition takes over the sheet; insert/explore are
   * explicit buttons inside it, so a hold is never a surprise action. */
  const openPreview = (word: string) => {
    haptic.tap();
    const requestId = ++previewRequestIdRef.current;
    setPreview({ word, status: "loading", defs: [] });
    fetchWordDefinitions(word)
      .then((defs) => {
        if (requestId !== previewRequestIdRef.current) return;
        setPreview({ word, status: defs.length > 0 ? "loaded" : "empty", defs });
      })
      .catch((error) => {
        if (requestId !== previewRequestIdRef.current) return;
        setPreview({
          word,
          status: error instanceof WordLookupOfflineError ? "offline" : "error",
          defs: [],
        });
      });
  };

  const closePreview = () => {
    haptic.tap();
    setPreview(null);
  };

  const handleSegmentChange = (key: SegmentKey) => {
    if (key === MORE_TAB) {
      setMoreTab(true);
      return;
    }
    setMoreTab(false);
    setQuickMode(key);
  };

  const selectExtendedMode = (next: WordLookupMode) => {
    if (next === extendedMode) return;
    haptic.tap();
    setExtendedMode(next);
  };

  const toggleThemeExpanded = () => {
    haptic.tap();
    setThemeExpanded((prev) => !prev);
  };

  const expandChipKey = (key: string) => {
    haptic.light();
    setExpandedChipKeys((prev) => new Set(prev).add(key));
  };

  const renderChip = (suggestion: WordSuggestion) => (
    <Pressable
      key={suggestion.word}
      style={({ pressed }) => [finderStyles.chip, pressed ? appStyles.pressDown : null]}
      onPress={() => handlePick(suggestion.word)}
      onLongPress={() => openPreview(suggestion.word)}
      accessibilityLabel={`Insert ${suggestion.word}`}
      accessibilityHint="Hold for a definition"
    >
      <Text style={finderStyles.chipText}>{suggestion.word}</Text>
    </Pressable>
  );

  /** A capped chip run: shows up to `cap` chips plus a "+ n more" expander. */
  const renderChipRun = (suggestions: WordSuggestion[], cap: number, expandKey: string) => {
    const expanded = expandedChipKeys.has(expandKey);
    const shown = expanded ? suggestions : suggestions.slice(0, cap);
    const hidden = suggestions.length - shown.length;
    return (
      <View style={finderStyles.chipWrap}>
        {shown.map(renderChip)}
        {hidden > 0 ? (
          <Pressable
            style={({ pressed }) => [finderStyles.moreChip, pressed ? appStyles.pressDown : null]}
            onPress={() => expandChipKey(expandKey)}
            accessibilityLabel={`Show ${hidden} more`}
          >
            <Text style={finderStyles.moreChipText}>+ {hidden} more</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderResults = (suggestions: WordSuggestion[]) => {
    if (!activeMode || !WORD_LOOKUP_MODES[activeMode].groupBySyllables) {
      return (
        <Animated.View entering={FadeIn.duration(durations.fast)}>
          {renderChipRun(suggestions, FLAT_CHIP_CAP, "flat")}
        </Animated.View>
      );
    }
    const groups = groupBySyllableCount(suggestions);
    return (
      <Animated.View entering={FadeIn.duration(durations.fast)}>
        {groups.map((group) => (
          <View key={group.syllables ?? "unknown"} style={finderStyles.syllableGroup}>
            {groups.length > 1 && group.syllables !== null ? (
              <Text style={finderStyles.syllableLabel}>
                {group.syllables} {group.syllables === 1 ? "SYLLABLE" : "SYLLABLES"}
              </Text>
            ) : null}
            {renderChipRun(group.suggestions, GROUP_CHIP_CAP, `syll:${group.syllables ?? "u"}`)}
          </View>
        ))}
      </Animated.View>
    );
  };

  // ── Definition preview: takes over the whole sheet body ──────────────────
  const renderPreview = (state: PreviewState) => (
    <Animated.View entering={FadeIn.duration(durations.fast)} style={finderStyles.previewFill}>
      <View style={finderStyles.previewHeader}>
        <Text style={finderStyles.previewWord}>{state.word}</Text>
        <Pressable
          style={({ pressed }) => [finderStyles.previewCloseBtn, pressed ? appStyles.pressDown : null]}
          onPress={closePreview}
          hitSlop={8}
          accessibilityLabel="Close definition"
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={finderStyles.previewBody}>
        {state.status === "loading" ? (
          <View style={finderStyles.stateCenter}>
            <ActivityIndicator size="small" color={colors.textMuted} />
          </View>
        ) : state.status === "offline" ? (
          <Text style={finderStyles.previewMeta}>You're offline — can't load a definition right now.</Text>
        ) : state.status === "error" ? (
          <Text style={finderStyles.previewMeta}>Couldn't load a definition right now.</Text>
        ) : state.status === "empty" ? (
          <Text style={finderStyles.previewMeta}>
            No definition found — might be slang, a name, or a coined word.
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={finderStyles.previewDefs}>
              {state.defs.slice(0, 5).map((def, index) => (
                <View key={index} style={finderStyles.previewDefRow}>
                  <Text style={finderStyles.previewPos}>{partOfSpeechLabel(def.partOfSpeech)}</Text>
                  <Text style={finderStyles.previewDefText}>{def.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={finderStyles.previewActions}>
        <Pressable
          style={({ pressed }) => [finderStyles.previewActionSecondary, pressed ? appStyles.pressDown : null]}
          onPress={() => drillInto(state.word)}
          accessibilityLabel={`Explore ${state.word}`}
        >
          <Ionicons name="compass-outline" size={15} color={colors.textStrong} />
          <Text style={finderStyles.previewActionSecondaryText}>Explore</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [finderStyles.previewActionPrimary, pressed ? appStyles.pressDown : null]}
          onPress={() => handlePick(state.word)}
          accessibilityLabel={`Insert ${state.word}`}
        >
          <Text style={finderStyles.previewActionPrimaryText}>Use word</Text>
          <Ionicons name="arrow-down" size={14} color={colors.onPrimary} />
        </Pressable>
      </View>
    </Animated.View>
  );

  const themeSummary = themeActive ? sanitizeThemeWords(theme).join(", ") : "Off";

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding>
      <View style={finderStyles.body}>
        {preview ? (
          renderPreview(preview)
        ) : (
          <>
            <View style={finderStyles.searchRow}>
              {drillStack.length > 0 ? (
                <Pressable onPress={drillBack} hitSlop={8} accessibilityLabel="Back to previous word">
                  <Ionicons name="chevron-back" size={17} color={colors.textStrong} />
                </Pressable>
              ) : (
                <Ionicons name="search" size={15} color={colors.textMuted} />
              )}
              <TextInput
                style={finderStyles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Find words for…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear word">
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Theme: a labeled disclosure row — visible, never hidden in an icon. */}
            {themeExpanded ? (
              <View style={[finderStyles.themeRow, finderStyles.themeRowExpanded]}>
                <Ionicons name="funnel-outline" size={13} color={themeActive ? colors.primary : colors.textMuted} />
                <TextInput
                  style={finderStyles.themeInput}
                  value={theme}
                  onChangeText={setTheme}
                  placeholder="Song's theme — e.g. love, leaving"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {theme.length > 0 ? (
                  <Pressable onPress={() => setTheme("")} hitSlop={8} accessibilityLabel="Clear theme">
                    <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                  </Pressable>
                ) : null}
                <Pressable onPress={toggleThemeExpanded} hitSlop={8} accessibilityLabel="Done with theme">
                  <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [finderStyles.themeRow, pressed ? appStyles.pressDown : null]}
                onPress={toggleThemeExpanded}
                accessibilityLabel={`Theme: ${themeSummary}. Biases results toward your song's subject.`}
              >
                <Ionicons name="funnel-outline" size={13} color={themeActive ? colors.primary : colors.textMuted} />
                <Text style={[finderStyles.themeLabel, themeActive ? finderStyles.themeLabelActive : null]}>
                  Theme
                </Text>
                <Text style={finderStyles.themeValue} numberOfLines={1}>
                  {themeSummary}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </Pressable>
            )}

            <SegmentedControl<SegmentKey>
              options={[
                ...WORD_LOOKUP_MODE_ORDER.map((key) => ({ key: key as SegmentKey, label: WORD_LOOKUP_MODES[key].label })),
                { key: MORE_TAB, label: "More" },
              ]}
              value={moreTab ? MORE_TAB : quickMode}
              onChange={handleSegmentChange}
            />

            {/* Extended tools appear as a second chip row under the More tab. */}
            {moreTab ? (
              <Animated.View entering={FadeIn.duration(durations.fast)}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={finderStyles.toolRow}
                >
                  {EXTENDED_MODES.map((key) => {
                    const active = extendedMode === key;
                    return (
                      <Pressable
                        key={key}
                        style={({ pressed }) => [
                          finderStyles.toolChip,
                          active ? finderStyles.toolChipActive : null,
                          pressed ? appStyles.pressDown : null,
                        ]}
                        onPress={() => selectExtendedMode(key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[finderStyles.toolChipText, active ? finderStyles.toolChipTextActive : null]}>
                          {WORD_LOOKUP_MODES[key].label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            ) : null}

            <View style={finderStyles.resultsArea}>
              {moreTab && !extendedMode ? (
                <Text style={finderStyles.stateText}>Pick a tool above.</Text>
              ) : lookup.status === "idle" ? (
                <Text style={finderStyles.stateText}>Type a word to look it up.</Text>
              ) : lookup.status === "loading" ? (
                <View style={finderStyles.stateCenter}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                </View>
              ) : lookup.status === "offline" ? (
                <Text style={finderStyles.stateText}>You're offline — word lookup needs a connection.</Text>
              ) : lookup.status === "error" ? (
                <Text style={finderStyles.stateText}>Couldn't look that up right now. Try again in a moment.</Text>
              ) : lookup.suggestions.length === 0 ? (
                <Text style={finderStyles.stateText}>
                  {`No ${activeMode ? WORD_LOOKUP_MODES[activeMode].label.toLowerCase() : "matches"} found for “${query.trim()}”${
                    themeActive ? " with this theme" : ""
                  }.`}
                </Text>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {renderResults(lookup.suggestions)}
                </ScrollView>
              )}
            </View>

            {/* Fixed-height hint row so showing/hiding it never moves the sheet. */}
            <View style={finderStyles.hintRow}>
              {lookup.status === "results" && lookup.suggestions.length > 0 ? (
                <Text style={finderStyles.hint}>Tap a word to insert · hold for meaning</Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const finderStyles = StyleSheet.create({
  body: {
    height: SHEET_BODY_HEIGHT,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  themeRowExpanded: {
    paddingVertical: 0,
  },
  themeLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  themeLabelActive: {
    color: colors.primary,
  },
  themeValue: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "right",
  },
  themeInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 7,
  },
  toolRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: 2,
  },
  toolChip: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  toolChipActive: {
    backgroundColor: colors.primary,
  },
  toolChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  toolChipTextActive: {
    color: colors.onPrimary,
  },
  resultsArea: {
    flex: 1,
    marginTop: spacing.md,
  },
  stateCenter: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  stateText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
    textAlign: "center",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  syllableGroup: {
    marginBottom: spacing.xs,
  },
  syllableLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
  },
  moreChip: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderStyle: "dashed",
  },
  moreChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  hintRow: {
    height: 18,
    justifyContent: "center",
  },
  hint: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textAlign: "center",
  },
  // ── Definition preview (takes over the body) ──────────────────────────────
  previewFill: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  previewWord: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 26,
    color: colors.textPrimary,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBody: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  previewMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  previewDefs: {
    gap: spacing.md,
  },
  previewDefRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  previewPos: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.primary,
    textTransform: "uppercase",
    paddingTop: 2,
    minWidth: 52,
  },
  previewDefText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  previewActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  previewActionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.round,
    paddingVertical: 11,
    backgroundColor: colors.surfaceHigh,
  },
  previewActionSecondaryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  previewActionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.round,
    paddingVertical: 11,
    backgroundColor: colors.primary,
  },
  previewActionPrimaryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.onPrimary,
  },
});
