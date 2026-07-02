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
import { BottomSheet } from "../../common/BottomSheet";
import { SegmentedControl } from "../../common/SegmentedControl";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { durations } from "../../../design/motion";
import {
  fetchWordSuggestions,
  WORD_LOOKUP_MODE_ORDER,
  WORD_LOOKUP_MODES,
  WordLookupOfflineError,
  type WordLookupMode,
  type WordSuggestion,
} from "../../../wordTools";

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
 * Word Finder — rhymes, near rhymes, synonyms, and related words for the word
 * under the cursor. One quiet surface for every lookup; tapping a word drops it
 * into the lyric at the cursor.
 */
export function WordFinderSheet({ visible, initialWord, onClose, onPickWord }: WordFinderSheetProps) {
  const [query, setQuery] = useState(initialWord);
  const [mode, setMode] = useState<WordLookupMode>("rhymes");
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const requestIdRef = useRef(0);

  // Re-seed from the editor each time the sheet opens on a new word.
  useEffect(() => {
    if (!visible) return;
    setQuery(initialWord);
    setMode("rhymes");
  }, [visible, initialWord]);

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
      fetchWordSuggestions(mode, trimmed, { signal: controller.signal })
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
  }, [visible, query, mode]);

  const handlePick = (word: string) => {
    haptic.tap();
    onPickWord(word);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding>
      <View style={finderStyles.searchRow}>
        <Ionicons name="search" size={15} color={colors.textMuted} />
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

      <SegmentedControl
        options={WORD_LOOKUP_MODE_ORDER.map((key) => ({ key, label: WORD_LOOKUP_MODES[key].label }))}
        value={mode}
        onChange={setMode}
      />

      <View style={finderStyles.resultsArea}>
        {lookup.status === "idle" ? (
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
            {`No ${WORD_LOOKUP_MODES[mode].label.toLowerCase()} found for “${query.trim()}”.`}
          </Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeIn.duration(durations.fast)} style={finderStyles.chipWrap}>
              {lookup.suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.word}
                  style={({ pressed }) => [finderStyles.chip, pressed ? appStyles.pressDown : null]}
                  onPress={() => handlePick(suggestion.word)}
                  accessibilityLabel={`Insert ${suggestion.word}`}
                >
                  <Text style={finderStyles.chipText}>{suggestion.word}</Text>
                </Pressable>
              ))}
            </Animated.View>
          </ScrollView>
        )}
      </View>
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
  resultsArea: {
    marginTop: spacing.md,
    minHeight: 120,
    maxHeight: 300,
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
});
