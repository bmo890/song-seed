import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
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
  fetchHebrewRhymes,
  fetchHebrewVocalizations,
  fetchHebrewWordSuggestions,
  fetchWordDefinitions,
  fetchWordSuggestions,
  getCachedWordSuggestions,
  groupBySyllableCount,
  hebrewWorkerMode,
  isEnglishLookupWord,
  isHebrewLookupWord,
  sanitizeThemeWords,
  WORD_LOOKUP_MODE_ORDER,
  WORD_LOOKUP_MODES,
  WordLookupBusyError,
  WordLookupOfflineError,
  type WordDefinition,
  type WordLookupMode,
  type WordSuggestion,
} from "../../domain/wordTools";
import { UserTextInput } from "../../i18n";
import { useTranslation } from "react-i18next";

const LOOKUP_DEBOUNCE_MS = 400;
/** Chips shown per syllable group / flat list before "+ n more". */
const GROUP_CHIP_CAP = 10;
const FLAT_CHIP_CAP = 24;
const MAX_THEMES = 5;
/** Nikud readings offered in the picker. Charuzit can return up to 8; the most
 * common come first, and a wall of near-identical pointed pills is overwhelming
 * — 5 covers the realistic cases without the picker dominating the sheet. */
const MAX_READINGS = 5;

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
  | { status: "unsupported" }
  // Hebrew meaning mode, nothing cached: awaiting an explicit tap so the paid
  // LLM call never fires on a debounce.
  | { status: "needsTrigger" }
  // Hebrew sound mode (rhymes/near/…): Charuzit isn't wired yet.
  | { status: "comingSoon" }
  | { status: "results"; suggestions: WordSuggestion[] }
  | { status: "offline" }
  | { status: "busy" }
  | { status: "error" };

/** How a (word, mode) pair is served. */
type LookupRoute = "english" | "hebrewRhymes" | "hebrewLlm" | "hebrewSound" | "unsupported";

function classifyLookup(word: string, mode: WordLookupMode): LookupRoute {
  if (isEnglishLookupWord(word)) return "english";
  if (isHebrewLookupWord(word)) {
    // Rhymes + near rhymes both come from Charuzit — free, auto-fire.
    if (mode === "rhymes" || mode === "near") return "hebrewRhymes";
    return hebrewWorkerMode(mode) ? "hebrewLlm" : "hebrewSound";
  }
  return "unsupported";
}

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
  const { t } = useTranslation();
  const modeLabel = (mode: WordLookupMode) => t(`wordFinderUi.${mode}`);
  const modeDescription = (mode: WordLookupMode) => t(`wordFinderUi.${mode}Desc`);
  // Datamuse uses single-letter tags; the Hebrew worker returns a pos phrase
  // (e.g. "שם עצם") — render a known tag translated, anything else verbatim.
  const partOfSpeech = (tag: string) => {
    const key = ({ n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "other" } as Record<string, string>)[tag];
    return key ? t(`wordFinderUi.${key}`) : tag;
  };
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
  // Hebrew rhymes: the word's possible nikud readings and the writer's pick.
  // Options render as pills; each pick re-queries Charuzit (cached per reading).
  const [vocalOptions, setVocalOptions] = useState<string[]>([]);
  const [vocalChoice, setVocalChoice] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);

  // A different word means a different set of readings.
  useEffect(() => {
    setVocalChoice(null);
    setVocalOptions([]);
  }, [query]);

  /** The mode actually queried; null while More is open with no tool picked. */
  const activeMode: WordLookupMode | null = moreTab ? extendedMode : quickMode;
  const themeParam = themes.join(", ");

  // Re-seed from the editor each time the sheet opens on a new word.
  useEffect(() => {
    if (!visible) return;
    // Both scripts open on Rhymes — the free backend for each (Datamuse /
    // Charuzit). Paid LLM modes are only ever reached by deliberate choice.
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

    const route = classifyLookup(trimmed, activeMode);
    const requestId = ++requestIdRef.current;

    if (route === "unsupported") {
      setLookup({ status: "unsupported" });
      return;
    }
    if (route === "hebrewSound") {
      setLookup({ status: "comingSoon" });
      return;
    }

    if (route === "hebrewRhymes") {
      // Free (Charuzit) — auto-fires like the English path. Pipeline: readings
      // for the plain word, then rhymes for the chosen (or most common)
      // reading. Both stages are cached, so repeats resolve in milliseconds;
      // the debounce keeps mid-typing queries away from Dicta.
      let cancelled = false;
      setLookup({ status: "loading" });
      const timer = setTimeout(() => {
        void (async () => {
          try {
            const options = await fetchHebrewVocalizations(trimmed);
            if (cancelled || requestId !== requestIdRef.current) return;
            setVocalOptions(options);
            if (options.length === 0) {
              setExpandedChipKeys(new Set());
              setLookup({ status: "results", suggestions: [] });
              return;
            }
            const chosen = vocalChoice && options.includes(vocalChoice) ? vocalChoice : options[0];
            const rhymes = await fetchHebrewRhymes(chosen, { near: activeMode === "near" });
            if (cancelled || requestId !== requestIdRef.current) return;
            setExpandedChipKeys(new Set());
            setLookup({ status: "results", suggestions: rhymes });
          } catch (error) {
            if (cancelled || requestId !== requestIdRef.current) return;
            if (error instanceof WordLookupOfflineError) setLookup({ status: "offline" });
            else if (error instanceof WordLookupBusyError) setLookup({ status: "busy" });
            else setLookup({ status: "error" });
          }
        })();
      }, LOOKUP_DEBOUNCE_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    if (route === "hebrewLlm") {
      // Cache-only read: cached Hebrew results are free, so show them instantly;
      // a miss parks on an explicit trigger so the paid LLM call waits for a tap.
      let cancelled = false;
      setLookup({ status: "loading" });
      void getCachedWordSuggestions(activeMode, trimmed, { theme: themeParam }).then((cached) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        if (cached !== null) {
          setExpandedChipKeys(new Set());
          setLookup({ status: "results", suggestions: cached });
        } else {
          setLookup({ status: "needsTrigger" });
        }
      });
      return () => {
        cancelled = true;
      };
    }

    // route === "english": cache-first, then debounced network.
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
    // vocalChoice: a new reading re-runs the (cached) Hebrew rhyme pipeline.
  }, [visible, query, activeMode, themeParam, vocalChoice]);

  /**
   * The one place a paid Hebrew LLM lookup fires — an explicit tap, never a
   * debounce. Guarded by requestIdRef so a stale result never lands after the
   * writer has moved on to another word or mode.
   */
  const runHebrewLookup = () => {
    const trimmed = query.trim();
    if (!trimmed || !activeMode) return;
    haptic.tap();
    const requestId = ++requestIdRef.current;
    setLookup({ status: "loading" });
    fetchHebrewWordSuggestions(activeMode, trimmed, { theme: themeParam })
      .then((suggestions) => {
        if (requestId !== requestIdRef.current) return;
        setExpandedChipKeys(new Set());
        setLookup({ status: "results", suggestions });
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        if (error instanceof WordLookupOfflineError) setLookup({ status: "offline" });
        else if (error instanceof WordLookupBusyError) setLookup({ status: "busy" });
        else setLookup({ status: "error" });
      });
  };

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

  /** Empty rhymes → jump to the Near tab (works for Datamuse and Charuzit). */
  const goToNear = () => {
    haptic.tap();
    Keyboard.dismiss();
    setMoreTab(false);
    setQuickMode("near");
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
              <Pressable onPress={() => removeTheme(word)} hitSlop={8} accessibilityLabel={t("wordFinderUi.removeTheme", { word })}>
                <Ionicons name="close" size={12} color={colors.onPrimary} />
              </Pressable>
            </View>
          ))}
          {themeEditing ? (
            <>
              <UserTextInput
                style={finderStyles.themeInput}
                value={themeDraft}
                onChangeText={setThemeDraft}
                placeholder={t("wordFinderUi.themePlaceholder")}
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
                accessibilityLabel={t("wordFinderUi.addThemeWord")}
              >
                <Text style={finderStyles.themeAddBtnText}>{t("wordFinderUi.add")}</Text>
              </Pressable>
            </>
          ) : themes.length < MAX_THEMES ? (
            <Pressable
              style={({ pressed }) => [finderStyles.themePlusBtn, pressed ? appStyles.pressDown : null]}
              onPress={beginThemeEdit}
              hitSlop={6}
              accessibilityLabel={t("wordFinderUi.addAnotherTheme")}
            >
              <Ionicons name="add" size={14} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <Pressable
          style={({ pressed }) => [finderStyles.themeAdd, pressed ? appStyles.pressDown : null]}
          onPress={beginThemeEdit}
          accessibilityLabel={t("wordFinderUi.addThemeA11y")}
        >
          <Ionicons name="funnel-outline" size={11} color={colors.textMuted} />
          <Text style={finderStyles.themeAddText}>{t("wordFinderUi.addTheme")}</Text>
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
      accessibilityLabel={t("wordFinderUi.insertWord", { word: suggestion.word })}
      accessibilityHint={t("wordFinderUi.definitionHint")}
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
      <View style={[finderStyles.chipWrap, resultsAreHebrew ? finderStyles.rowRtl : null]}>
        {shown.map(renderChip)}
        {hidden > 0 ? (
          <Pressable
            style={({ pressed }) => [finderStyles.moreChip, pressed ? appStyles.pressDown : null]}
            onPress={() => expandChipKey(expandKey)}
            accessibilityLabel={t("wordFinderUi.showMore", { count: hidden })}
          >
            <Text style={finderStyles.moreChipText}>{t("wordFinderUi.moreCount", { count: hidden })}</Text>
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
              <Text style={[finderStyles.syllableLabel, resultsAreHebrew ? finderStyles.labelRtl : null]}>
                {t("wordFinderUi.syllable", { count: group.syllables })}
              </Text>
            ) : null}
            {renderChipRun(group.suggestions, GROUP_CHIP_CAP, `syll:${group.syllables ?? "u"}`)}
          </View>
        ))}
      </Animated.View>
    );
  };

  /** Hebrew meaning mode, nothing cached — a composed invitation to run the
   * on-demand lookup. The word takes the serif display voice used elsewhere in
   * the sheet, so the one paid action reads as deliberate, not a bare button. */
  const renderTrigger = () => (
    <Animated.View entering={FadeIn.duration(durations.fast)} style={finderStyles.triggerCenter}>
      <View style={finderStyles.triggerBadge}>
        <Ionicons name="sparkles-outline" size={19} color={colors.primary} />
      </View>
      {activeMode ? <Text style={finderStyles.triggerEyebrow}>{modeLabel(activeMode).toUpperCase()}</Text> : null}
      <Text style={finderStyles.triggerWord} numberOfLines={1}>
        {query.trim()}
      </Text>
      <Pressable
        style={({ pressed }) => [finderStyles.triggerBtn, pressed ? appStyles.pressDown : null]}
        onPress={runHebrewLookup}
        accessibilityRole="button"
        accessibilityLabel={t("wordFinderUi.llmFind")}
      >
        <Ionicons name="search" size={15} color={colors.onPrimary} />
        <Text style={finderStyles.triggerBtnText}>{t("wordFinderUi.llmFind")}</Text>
      </Pressable>
      <Text style={finderStyles.triggerSub}>{t("wordFinderUi.llmSub")}</Text>
    </Animated.View>
  );

  /** Hebrew sound mode (rhymes/near/…) — Charuzit isn't wired yet. Same quiet
   * composition, muted, no action. */
  const renderComingSoon = () => (
    <Animated.View entering={FadeIn.duration(durations.fast)} style={finderStyles.triggerCenter}>
      <View style={finderStyles.triggerBadgeMuted}>
        <Ionicons name="time-outline" size={19} color={colors.textMuted} />
      </View>
      {activeMode ? <Text style={finderStyles.triggerEyebrow}>{modeLabel(activeMode).toUpperCase()}</Text> : null}
      <Text style={finderStyles.triggerWordMuted} numberOfLines={1}>
        {query.trim()}
      </Text>
      <Text style={finderStyles.triggerSub}>{t("wordFinderUi.soundSoon")}</Text>
      <Text style={finderStyles.triggerSubFaint}>{t("wordFinderUi.soundSoonSub")}</Text>
    </Animated.View>
  );

  /** The described tool list shown under the More tab. For Hebrew, hide the
   * modes with no backend yet (the Charuzit-only sound tools) so the list shows
   * only working tools instead of dead "coming soon" entries. */
  const renderToolList = () => {
    const groups = EXTENDED_WORD_MODE_GROUPS.map((group) => ({
      title: group.title,
      modes: resultsAreHebrew ? group.modes.filter((m) => hebrewWorkerMode(m) !== null) : group.modes,
    })).filter((group) => group.modes.length > 0);
    return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(durations.fast)}>
        {groups.map((group) => (
          <View key={group.title} style={finderStyles.toolGroup}>
            <Text style={finderStyles.toolGroupTitle}>{t(`wordFinderUi.${group.title.toLowerCase()}`).toUpperCase()}</Text>
            {group.modes.map((key) => {
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
                    <Text style={finderStyles.toolRowLabel}>{modeLabel(key)}</Text>
                    <Text style={finderStyles.toolRowDesc} numberOfLines={1}>
                      {modeDescription(key)}
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
          accessibilityLabel={t("wordFinderUi.closeDefinition")}
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
          <Text style={finderStyles.previewMeta}>{t("wordFinderUi.definitionOffline")}</Text>
        ) : state.status === "error" ? (
          <Text style={finderStyles.previewMeta}>{t("wordFinderUi.definitionError")}</Text>
        ) : state.status === "empty" ? (
          <Text style={finderStyles.previewMeta}>{t("wordFinderUi.definitionEmpty")}</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={finderStyles.previewDefs}>
              {state.defs.slice(0, 5).map((def, index) => (
                <View key={index} style={finderStyles.previewDefRow}>
                  <Text style={finderStyles.previewPos}>{partOfSpeech(def.partOfSpeech)}</Text>
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
          accessibilityLabel={t("wordFinderUi.exploreWord", { word: state.word })}
        >
          <Ionicons name="compass-outline" size={15} color={colors.textStrong} />
          <Text style={finderStyles.previewActionSecondaryText}>{t("wordFinderUi.explore")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [finderStyles.previewActionPrimary, pressed ? appStyles.pressDown : null]}
          onPress={() => handlePick(state.word)}
          accessibilityLabel={t("wordFinderUi.insertWord", { word: state.word })}
        >
          <Text style={finderStyles.previewActionPrimaryText}>{t("wordFinderUi.useWord")}</Text>
          <Ionicons name="arrow-down" size={14} color={colors.onPrimary} />
        </Pressable>
      </View>
    </Animated.View>
  );

  const showToolList = moreTab && (toolListOpen || !extendedMode);
  const activeRoute = activeMode ? classifyLookup(query.trim(), activeMode) : null;
  const effectiveVocal =
    vocalChoice && vocalOptions.includes(vocalChoice) ? vocalChoice : vocalOptions[0] ?? null;
  // Hebrew results read right-to-left; mirror the pill/chip rows so the first
  // (most relevant) item sits top-right, regardless of the app UI language.
  const resultsAreHebrew = isHebrewLookupWord(query.trim());
  const readings = vocalOptions.slice(0, MAX_READINGS);

  /** Reading picker — only when the plain word is genuinely ambiguous. A
   * wrapping row (not a scroller) keeps every reading visible and sidesteps
   * RTL horizontal-scroll quirks; capped so it never dominates the sheet. */
  const renderVocalRow = () =>
    activeRoute === "hebrewRhymes" && readings.length > 1 && !showToolList ? (
      <Animated.View entering={FadeIn.duration(durations.fast)} style={finderStyles.vocalBlock}>
        <View style={[finderStyles.vocalHeader, resultsAreHebrew ? finderStyles.rowRtl : null]}>
          <Ionicons name="options-outline" size={12} color={colors.textMuted} />
          <Text style={finderStyles.vocalLabel}>{t("wordFinderUi.readingLabel")}</Text>
        </View>
        <View style={[finderStyles.vocalRow, resultsAreHebrew ? finderStyles.rowRtl : null]}>
          {readings.map((option) => {
            const selected = option === effectiveVocal;
            return (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  finderStyles.vocalPill,
                  selected ? finderStyles.vocalPillActive : null,
                  pressed ? appStyles.pressDown : null,
                ]}
                onPress={() => {
                  haptic.tap();
                  setVocalChoice(option);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t("wordFinderUi.readingOption", { word: option })}
              >
                <Text style={[finderStyles.vocalPillText, selected ? finderStyles.vocalPillTextActive : null]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    ) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} expandable collapsedHeight={560}>
      <View style={finderStyles.body}>
        {preview ? (
          renderPreview(preview)
        ) : (
          <>
            <View style={finderStyles.searchRow}>
              {drillStack.length > 0 ? (
                <Pressable onPress={drillBack} hitSlop={8} accessibilityLabel={t("wordFinderUi.previousWord")}>
                  <Ionicons name="chevron-back" size={17} color={colors.textStrong} />
                </Pressable>
              ) : (
                <Ionicons name="search" size={15} color={colors.textMuted} />
              )}
              <UserTextInput
                style={finderStyles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t("wordFinderUi.searchPlaceholder")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel={t("wordFinderUi.clearWord")}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Themes bias Datamuse and the LLM, but Charuzit ignores them —
                hide the affordance in Hebrew rhyme/near modes where it's a no-op. */}
            {activeRoute === "hebrewRhymes" ? null : renderThemeLine()}

            <SegmentedControl<SegmentKey>
              options={[
                ...WORD_LOOKUP_MODE_ORDER.map((key) => ({ key: key as SegmentKey, label: modeLabel(key) })),
                { key: MORE_TAB, label: t("wordFinderUi.more") },
              ]}
              value={moreTab ? MORE_TAB : quickMode}
              onChange={handleSegmentChange}
            />

            {renderVocalRow()}

            {/* Active extended tool: a compact bar that reopens the described list. */}
            {moreTab && extendedMode && !showToolList ? (
              <Animated.View entering={FadeIn.duration(durations.fast)}>
                <Pressable
                  style={({ pressed }) => [finderStyles.toolBar, pressed ? appStyles.pressDown : null]}
                  onPress={reopenToolList}
                  accessibilityLabel={t("wordFinderUi.changeTool", { tool: modeLabel(extendedMode) })}
                >
                  <Text style={finderStyles.toolBarText}>{modeLabel(extendedMode)}</Text>
                  <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
                </Pressable>
              </Animated.View>
            ) : null}

            <View style={finderStyles.resultsArea}>
              {showToolList ? (
                renderToolList()
              ) : lookup.status === "idle" ? (
                <Text style={finderStyles.stateText}>{t("wordFinderUi.idle")}</Text>
              ) : lookup.status === "loading" ? (
                <View style={finderStyles.stateCenter}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                </View>
              ) : lookup.status === "needsTrigger" ? (
                renderTrigger()
              ) : lookup.status === "comingSoon" ? (
                renderComingSoon()
              ) : lookup.status === "unsupported" ? (
                <View style={finderStyles.stateCenter}>
                  <Text style={finderStyles.stateText}>{t("wordFinderUi.scriptUnsupported")}</Text>
                </View>
              ) : lookup.status === "offline" ? (
                <Text style={finderStyles.stateText}>{t("wordFinderUi.offline")}</Text>
              ) : lookup.status === "busy" ? (
                <Text style={finderStyles.stateText}>{t("wordFinderUi.busy")}</Text>
              ) : lookup.status === "error" ? (
                <Text style={finderStyles.stateText}>{t("wordFinderUi.error")}</Text>
              ) : lookup.suggestions.length === 0 ? (
                <View style={finderStyles.emptyState}>
                  <Text style={finderStyles.stateText}>
                    {t("wordFinderUi.noMatches", { mode: activeMode ? modeLabel(activeMode).toLowerCase() : t("wordFinderUi.matches"), query: query.trim(), theme: themes.length > 0 ? t("wordFinderUi.withTheme") : "" })}
                  </Text>
                  {/* Perfect rhymes often come up empty (orange, silver, גֶּשֶׁם) —
                      point the writer at near rhymes rather than a dead end. */}
                  {activeMode === "rhymes" ? (
                    <Pressable
                      style={({ pressed }) => [finderStyles.tryNearBtn, pressed ? appStyles.pressDown : null]}
                      onPress={goToNear}
                      accessibilityRole="button"
                      accessibilityLabel={t("wordFinderUi.tryNear")}
                    >
                      <Text style={finderStyles.tryNearBtnText}>{t("wordFinderUi.tryNear")}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.onPrimary} />
                    </Pressable>
                  ) : null}
                </View>
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
                <Text style={finderStyles.hint}>
                  {activeRoute === "hebrewRhymes"
                    ? t("wordFinderUi.dictaCredit")
                    : t("wordFinderUi.resultHint")}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
