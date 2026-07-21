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
  fetchWordDefinitions,
  fetchWordSuggestions,
  getCachedWordSuggestions,
  groupBySyllableCount,
  isEnglishLookupWord,
  sanitizeThemeWords,
  WORD_LOOKUP_MODE_ORDER,
  WORD_LOOKUP_MODES,
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
  const { t } = useTranslation();
  const modeLabel = (mode: WordLookupMode) => t(`wordFinderUi.${mode}`);
  const modeDescription = (mode: WordLookupMode) => t(`wordFinderUi.${mode}Desc`);
  const partOfSpeech = (tag: string) => t(`wordFinderUi.${({ n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "other" } as Record<string, string>)[tag] ?? "other"}`);
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
    if (!isEnglishLookupWord(trimmed)) {
      setLookup({ status: "unsupported" });
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
      <View style={finderStyles.chipWrap}>
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
              <Text style={finderStyles.syllableLabel}>
                {t("wordFinderUi.syllable", { count: group.syllables })}
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

  return (
    <BottomSheet visible={visible} onClose={onClose}>
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

            {renderThemeLine()}

            <SegmentedControl<SegmentKey>
              options={[
                ...WORD_LOOKUP_MODE_ORDER.map((key) => ({ key: key as SegmentKey, label: modeLabel(key) })),
                { key: MORE_TAB, label: t("wordFinderUi.more") },
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
              ) : lookup.status === "unsupported" ? (
                <View style={finderStyles.stateCenter}>
                  <Text style={finderStyles.stateText}>{t("lyrics.wordFinderEnglishOnly")}</Text>
                  <Text style={finderStyles.hint}>{t("common.englishOnly")}</Text>
                </View>
              ) : lookup.status === "offline" ? (
                <Text style={finderStyles.stateText}>{t("wordFinderUi.offline")}</Text>
              ) : lookup.status === "error" ? (
                <Text style={finderStyles.stateText}>{t("wordFinderUi.error")}</Text>
              ) : lookup.suggestions.length === 0 ? (
                <Text style={finderStyles.stateText}>
                  {t("wordFinderUi.noMatches", { mode: activeMode ? modeLabel(activeMode).toLowerCase() : t("wordFinderUi.matches"), query: query.trim(), theme: themes.length > 0 ? t("wordFinderUi.withTheme") : "" })}
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
                <Text style={finderStyles.hint}>{t("wordFinderUi.resultHint")}</Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
