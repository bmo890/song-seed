import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { SegmentedControl } from "./SegmentedControl";
import { finderStyles } from "./WordFinderSheet.styles";
import { styles as appStyles } from "../../styles";
import { colors, radii, spacing } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { durations } from "../../design/motion";
import {
  EXTENDED_WORD_MODE_GROUPS,
  fetchWordDefinitions,
  fetchWordSuggestions,
  getCachedWordSuggestions,
  groupBySyllableCount,
  partOfSpeechLabel,
  sanitizeThemeWords,
  WORD_LOOKUP_MODE_ORDER,
  WORD_LOOKUP_MODES,
  WordLookupOfflineError,
  type WordDefinition,
  type WordLookupMode,
  type WordSuggestion,
} from "../../domain/wordTools";

const LOOKUP_DEBOUNCE_MS = 400;
/** Chips shown per syllable group / flat list before "+ n more". */
const GROUP_CHIP_CAP = 10;
const FLAT_CHIP_CAP = 24;
const MAX_THEMES = 5;

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
 * Modes live in one segmented row: Rhymes / Near / Similar / Related / More.
 * More shows a described list of extended tools (sound / meaning / imagery);
 * a chosen tool collapses to a compact bar that reopens the list. Theme words
 * are committed pills — added explicitly, so typing a theme never fires
 * per-keystroke requests. Holding a suggestion takes over the sheet with its
 * definition; inserting or exploring are explicit buttons inside it.
 */
export function WordFinderSheet({ visible, initialWord, onClose, onPickWord }: WordFinderSheetProps) {
  const [query, setQuery] = useState(initialWord);
  const [quickMode, setQuickMode] = useState<WordLookupMode>("rhymes");
  const [moreTab, setMoreTab] = useState(false);
  // Remembered across More visits so the tab reopens on the last-used tool.
  const [extendedMode, setExtendedMode] = useState<WordLookupMode | null>(null);
  const [toolListOpen, setToolListOpen] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  // Committed theme words — deliberately sticky across opens (set once per song).
  const [themes, setThemes] = useState<string[]>([]);
  const [themeEditing, setThemeEditing] = useState(false);
  const [themeDraft, setThemeDraft] = useState("");
  const [drillStack, setDrillStack] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [expandedChipKeys, setExpandedChipKeys] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);

  /** The mode actually queried; null while More is open with no tool picked. */
  const activeMode: WordLookupMode | null = moreTab ? extendedMode : quickMode;
  const themeParam = themes.join(", ");

  // Re-seed from the editor each time the sheet opens on a new word.
  useEffect(() => {
    if (!visible) return;
    setQuery(initialWord);
    setQuickMode("rhymes");
    setMoreTab(false);
    setToolListOpen(false);
    setDrillStack([]);
    setPreview(null);
    setThemeEditing(false);
    setThemeDraft("");
    setExpandedChipKeys(new Set());
  }, [visible, initialWord]);

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (!trimmed || !activeMode) {
      setLookup({ status: "idle" });
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    let settled = false;
    setLookup({ status: "loading" });

    const showResults = (suggestions: WordSuggestion[]) => {
      if (requestId !== requestIdRef.current || settled) return;
      settled = true;
      setExpandedChipKeys(new Set());
      setLookup({ status: "results", suggestions });
    };

    // Cached lookups (memory or SQLite) render immediately — the typing
    // debounce below only gates true network fetches.
    void getCachedWordSuggestions(activeMode, trimmed, { theme: themeParam }).then((cached) => {
      if (cached !== null) showResults(cached);
    });

    const timer = setTimeout(() => {
      if (settled) return;
      fetchWordSuggestions(activeMode, trimmed, { signal: controller.signal, theme: themeParam })
        .then(showResults)
        .catch((error) => {
          if (requestId !== requestIdRef.current || controller.signal.aborted || settled) return;
          setLookup(error instanceof WordLookupOfflineError ? { status: "offline" } : { status: "error" });
        });
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, query, activeMode, themeParam]);

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
    Keyboard.dismiss();
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
    Keyboard.dismiss();
    if (key === MORE_TAB) {
      setMoreTab(true);
      setToolListOpen(extendedMode === null);
      return;
    }
    setMoreTab(false);
    setQuickMode(key);
  };

  const selectExtendedMode = (next: WordLookupMode) => {
    haptic.tap();
    Keyboard.dismiss();
    setExtendedMode(next);
    setToolListOpen(false);
  };

  const reopenToolList = () => {
    haptic.tap();
    Keyboard.dismiss();
    setToolListOpen(true);
  };

  // ── Theme pills ────────────────────────────────────────────────────────────
  const beginThemeEdit = () => {
    haptic.tap();
    setThemeEditing(true);
  };

  /** Commit the draft: sanitized words become pills; requests only fire now. */
  const commitThemeDraft = () => {
    haptic.tap();
    const words = sanitizeThemeWords(themeDraft);
    if (words.length > 0) {
      setThemes((prev) => [...new Set([...prev, ...words])].slice(0, MAX_THEMES));
    }
    setThemeDraft("");
    setThemeEditing(false);
    Keyboard.dismiss();
  };

  const removeTheme = (word: string) => {
    haptic.light();
    setThemes((prev) => prev.filter((entry) => entry !== word));
  };

  const renderThemeLine = () => (
    <View style={finderStyles.themeLine}>
      {themes.length > 0 || themeEditing ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={finderStyles.themeScroll}
        >
          <Ionicons name="funnel-outline" size={12} color={themes.length > 0 ? colors.primary : colors.textMuted} />
          {themes.map((word) => (
            <View key={word} style={finderStyles.themePill}>
              <Text style={finderStyles.themePillText}>{word}</Text>
              <Pressable onPress={() => removeTheme(word)} hitSlop={8} accessibilityLabel={`Remove theme ${word}`}>
                <Ionicons name="close" size={12} color={colors.onPrimary} />
              </Pressable>
            </View>
          ))}
          {themeEditing ? (
            <>
              <TextInput
                style={finderStyles.themeInput}
                value={themeDraft}
                onChangeText={setThemeDraft}
                placeholder="e.g. love"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={commitThemeDraft}
              />
              <Pressable
                style={({ pressed }) => [finderStyles.themeAddBtn, pressed ? appStyles.pressDown : null]}
                onPress={commitThemeDraft}
                accessibilityLabel="Add theme word"
              >
                <Text style={finderStyles.themeAddBtnText}>Add</Text>
              </Pressable>
            </>
          ) : themes.length < MAX_THEMES ? (
            <Pressable
              style={({ pressed }) => [finderStyles.themePlusBtn, pressed ? appStyles.pressDown : null]}
              onPress={beginThemeEdit}
              hitSlop={6}
              accessibilityLabel="Add another theme word"
            >
              <Ionicons name="add" size={14} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <Pressable
          style={({ pressed }) => [finderStyles.themeAdd, pressed ? appStyles.pressDown : null]}
          onPress={beginThemeEdit}
          accessibilityLabel="Add a theme to bias results toward your song's subject"
        >
          <Ionicons name="funnel-outline" size={11} color={colors.textMuted} />
          <Text style={finderStyles.themeAddText}>Add theme</Text>
        </Pressable>
      )}
    </View>
  );

  // ── Results ────────────────────────────────────────────────────────────────
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

  /** The described tool list shown under the More tab. */
  const renderToolList = () => (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(durations.fast)}>
        {EXTENDED_WORD_MODE_GROUPS.map((group) => (
          <View key={group.title} style={finderStyles.toolGroup}>
            <Text style={finderStyles.toolGroupTitle}>{group.title.toUpperCase()}</Text>
            {group.modes.map((key) => {
              const config = WORD_LOOKUP_MODES[key];
              const active = extendedMode === key;
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [finderStyles.toolRow, pressed ? appStyles.pressDown : null]}
                  onPress={() => selectExtendedMode(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={finderStyles.toolRowText}>
                    <Text style={finderStyles.toolRowLabel}>{config.label}</Text>
                    <Text style={finderStyles.toolRowDesc} numberOfLines={1}>
                      {config.description}
                    </Text>
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

  const showToolList = moreTab && (toolListOpen || !extendedMode);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
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
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear word">
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {renderThemeLine()}

            <SegmentedControl<SegmentKey>
              options={[
                ...WORD_LOOKUP_MODE_ORDER.map((key) => ({ key: key as SegmentKey, label: WORD_LOOKUP_MODES[key].label })),
                { key: MORE_TAB, label: "More" },
              ]}
              value={moreTab ? MORE_TAB : quickMode}
              onChange={handleSegmentChange}
            />

            {/* Active extended tool: a compact bar that reopens the described list. */}
            {moreTab && extendedMode && !showToolList ? (
              <Animated.View entering={FadeIn.duration(durations.fast)}>
                <Pressable
                  style={({ pressed }) => [finderStyles.toolBar, pressed ? appStyles.pressDown : null]}
                  onPress={reopenToolList}
                  accessibilityLabel={`${WORD_LOOKUP_MODES[extendedMode].label} — tap to change tool`}
                >
                  <Text style={finderStyles.toolBarText}>{WORD_LOOKUP_MODES[extendedMode].label}</Text>
                  <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
                </Pressable>
              </Animated.View>
            ) : null}

            <View style={finderStyles.resultsArea}>
              {showToolList ? (
                renderToolList()
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
                    themes.length > 0 ? " with this theme" : ""
                  }.`}
                </Text>
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  {renderResults(lookup.suggestions)}
                </ScrollView>
              )}
            </View>

            {/* Fixed-height hint row so showing/hiding it never moves the sheet. */}
            <View style={finderStyles.hintRow}>
              {!showToolList && lookup.status === "results" && lookup.suggestions.length > 0 ? (
                <Text style={finderStyles.hint}>Tap a word to insert · hold for meaning</Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

