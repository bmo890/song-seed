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
  fetchWordSuggestions,
  groupBySyllableCount,
  isQuickWordMode,
  sanitizeThemeWords,
  WORD_LOOKUP_MODE_ORDER,
  WORD_LOOKUP_MODES,
  WordLookupOfflineError,
  type WordLookupMode,
  type WordSuggestion,
} from "../../wordTools";

const LOOKUP_DEBOUNCE_MS = 350;

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

/**
 * Word Finder — one quiet surface for every word lookup while writing lyrics.
 *
 * Quick layer: four segments (Rhymes / Near / Similar / Related), tap a chip to
 * insert. Depth is disclosed progressively: the ••• opens goal-grouped extended
 * modes (sound / meaning / imagery), an optional theme biases every mode toward
 * the song's subject, holding a chip explores that word, and sound modes group
 * results by syllable count for meter matching.
 */
export function WordFinderSheet({ visible, initialWord, onClose, onPickWord }: WordFinderSheetProps) {
  const [query, setQuery] = useState(initialWord);
  const [mode, setMode] = useState<WordLookupMode>("rhymes");
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const [modePickerOpen, setModePickerOpen] = useState(false);
  // Theme is deliberately sticky across opens — a writer sets it once per song.
  const [theme, setTheme] = useState("");
  const [themeVisible, setThemeVisible] = useState(false);
  const [drillStack, setDrillStack] = useState<string[]>([]);
  const requestIdRef = useRef(0);

  // Re-seed from the editor each time the sheet opens on a new word.
  useEffect(() => {
    if (!visible) return;
    setQuery(initialWord);
    setMode("rhymes");
    setModePickerOpen(false);
    setDrillStack([]);
  }, [visible, initialWord]);

  const themeActive = sanitizeThemeWords(theme).length > 0;

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setLookup({ status: "idle" });
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setLookup({ status: "loading" });

    const timer = setTimeout(() => {
      fetchWordSuggestions(mode, trimmed, { signal: controller.signal, theme })
        .then((suggestions) => {
          if (requestId !== requestIdRef.current) return;
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
  }, [visible, query, mode, theme]);

  const handlePick = (word: string) => {
    haptic.tap();
    onPickWord(word);
  };

  /** Long-press: look the suggestion itself up, keeping the current mode. */
  const drillInto = (word: string) => {
    haptic.grab();
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

  const selectExtendedMode = (next: WordLookupMode) => {
    haptic.tap();
    setMode(next);
    setModePickerOpen(false);
  };

  const clearExtendedMode = () => {
    haptic.tap();
    setMode("rhymes");
  };

  const toggleModePicker = () => {
    haptic.tap();
    setModePickerOpen((prev) => !prev);
  };

  const toggleTheme = () => {
    haptic.tap();
    setThemeVisible((prev) => !prev);
  };

  const renderChip = (suggestion: WordSuggestion) => (
    <Pressable
      key={suggestion.word}
      style={({ pressed }) => [finderStyles.chip, pressed ? appStyles.pressDown : null]}
      onPress={() => handlePick(suggestion.word)}
      onLongPress={() => drillInto(suggestion.word)}
      accessibilityLabel={`Insert ${suggestion.word}`}
      accessibilityHint="Hold to explore this word"
    >
      <Text style={finderStyles.chipText}>{suggestion.word}</Text>
    </Pressable>
  );

  const renderResults = (suggestions: WordSuggestion[]) => {
    if (!WORD_LOOKUP_MODES[mode].groupBySyllables) {
      return (
        <Animated.View entering={FadeIn.duration(durations.fast)} style={finderStyles.chipWrap}>
          {suggestions.map(renderChip)}
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
            <View style={finderStyles.chipWrap}>{group.suggestions.map(renderChip)}</View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderModePicker = () => (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(durations.fast)}>
        {EXTENDED_WORD_MODE_GROUPS.map((group) => (
          <View key={group.title} style={finderStyles.pickerGroup}>
            <Text style={finderStyles.pickerGroupTitle}>{group.title.toUpperCase()}</Text>
            {group.modes.map((key) => {
              const config = WORD_LOOKUP_MODES[key];
              const active = mode === key;
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [finderStyles.pickerRow, pressed ? appStyles.pressDown : null]}
                  onPress={() => selectExtendedMode(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={finderStyles.pickerRowText}>
                    <Text style={finderStyles.pickerRowLabel}>{config.label}</Text>
                    <Text style={finderStyles.pickerRowDesc}>{config.description}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </Animated.View>
    </ScrollView>
  );

  const quickMode = isQuickWordMode(mode);

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding>
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
        <Pressable
          onPress={toggleTheme}
          hitSlop={8}
          accessibilityLabel="Theme"
          accessibilityState={{ selected: themeActive }}
        >
          <Ionicons
            name={themeActive ? "pricetags" : "pricetags-outline"}
            size={16}
            color={themeActive ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>

      {themeVisible || themeActive ? (
        <Animated.View entering={FadeIn.duration(durations.fast)} style={finderStyles.themeRow}>
          <TextInput
            style={finderStyles.themeInput}
            value={theme}
            onChangeText={setTheme}
            placeholder="Theme — e.g. love, leaving (biases every mode)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {theme.length > 0 ? (
            <Pressable onPress={() => setTheme("")} hitSlop={8} accessibilityLabel="Clear theme">
              <Ionicons name="close-circle" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={finderStyles.modeRow}>
        {quickMode ? (
          <View style={finderStyles.modeRowFill}>
            <SegmentedControl
              options={WORD_LOOKUP_MODE_ORDER.map((key) => ({ key, label: WORD_LOOKUP_MODES[key].label }))}
              value={mode}
              onChange={(next) => {
                setModePickerOpen(false);
                setMode(next);
              }}
            />
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [finderStyles.activeModeChip, pressed ? appStyles.pressDown : null]}
            onPress={clearExtendedMode}
            accessibilityLabel={`${WORD_LOOKUP_MODES[mode].label} — tap to return to quick modes`}
          >
            <Text style={finderStyles.activeModeChipText}>{WORD_LOOKUP_MODES[mode].label}</Text>
            <Ionicons name="close" size={14} color={colors.onPrimary} />
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            finderStyles.moreBtn,
            modePickerOpen ? finderStyles.moreBtnActive : null,
            pressed ? appStyles.pressDown : null,
          ]}
          onPress={toggleModePicker}
          hitSlop={6}
          accessibilityLabel="More word tools"
          accessibilityState={{ expanded: modePickerOpen }}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={16}
            color={modePickerOpen ? colors.onPrimary : colors.textSecondary}
          />
        </Pressable>
      </View>

      <View style={finderStyles.resultsArea}>
        {modePickerOpen ? (
          renderModePicker()
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
            {`No ${WORD_LOOKUP_MODES[mode].label.toLowerCase()} found for “${query.trim()}”${
              themeActive ? " with this theme" : ""
            }.`}
          </Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {renderResults(lookup.suggestions)}
          </ScrollView>
        )}
      </View>

      {!modePickerOpen && lookup.status === "results" && lookup.suggestions.length > 0 ? (
        <Text style={finderStyles.hint}>Tap to insert · hold to explore</Text>
      ) : null}
    </BottomSheet>
  );
}

const finderStyles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  themeInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 8,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  modeRowFill: {
    flex: 1,
  },
  activeModeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 8,
  },
  activeModeChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.onPrimary,
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtnActive: {
    backgroundColor: colors.primary,
  },
  resultsArea: {
    marginTop: spacing.md,
    minHeight: 120,
    maxHeight: 320,
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
  pickerGroup: {
    marginBottom: spacing.md,
  },
  pickerGroupTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
  },
  pickerRowText: {
    flex: 1,
    gap: 1,
  },
  pickerRowLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  pickerRowDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  hint: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
