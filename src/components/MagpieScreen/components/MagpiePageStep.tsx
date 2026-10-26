import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Spinner } from "../../common/Spinner";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, spacing } from "../../../design/tokens";
import { durations } from "../../../design/motion";
import { haptic } from "../../../design/haptics";
import { BottomSheet } from "../../common/BottomSheet";
import {
  type MagpieParagraph,
  type MagpieToken,
  runToPhrases,
  selectedRuns,
  selectionToPhrases,
  tokenizePageIntoParagraphs,
} from "../../../domain/magpie";
import { MAGPIE_HE_ENABLED, MAGPIE_HE_GENRES, type MagpieHeGenre } from "../../../config/magpieService";
import type { MagpieBook, MagpieLanguage, MagpieSpark } from "../../../types";
import type { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { useTranslation } from "react-i18next";
import { useSparkTextScale } from "../../common/sparkTextScale";
import { Press } from "../../common/Press";
import { Button } from "../../common/Button";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { InkLink } from "../../common/InkLink";
import { SegmentedControl } from "../../common/SegmentedControl";
import { SparkFooter } from "../../common/SparkFrame";
import { UserText } from "../../../i18n";

type Model = ReturnType<typeof useMagpieScreenModel>;

// The writing sheet is a card on the app paper (2026-10-17, paper A).
const PAGE_BG = colors.surface;
const BASE_FONT = 17;
const BASE_LINE = 29;

// ── Token rendering (memoised so a tap re-renders only the changed spans) ─────
function computeHighlight(tokens: MagpieToken[], selectedSet: Set<number>): Set<number> {
  const set = new Set<number>();
  let prevWordIndex: number | null = null;
  let prevSelected = false;
  let sinceWord: number[] = [];
  for (const token of tokens) {
    if (token.wordIndex < 0) {
      sinceWord.push(token.index);
      continue;
    }
    const isSel = selectedSet.has(token.wordIndex);
    if (isSel) set.add(token.index);
    if (prevWordIndex !== null && prevSelected && isSel && token.wordIndex === prevWordIndex + 1) {
      for (const idx of sinceWord) set.add(idx);
    }
    prevWordIndex = token.wordIndex;
    prevSelected = isSel;
    sinceWord = [];
  }
  return set;
}

const Tok = memo(function Tok({
  text,
  wordIndex,
  highlighted,
  onToggle,
  onLongPress,
}: {
  text: string;
  wordIndex: number;
  highlighted: boolean;
  onToggle: (wordIndex: number) => void;
  onLongPress: (wordIndex: number) => void;
}) {
  if (wordIndex < 0) {
    return <Text style={highlighted ? styles.hl : undefined}>{text}</Text>;
  }
  return (
    <Text
      suppressHighlighting
      onPress={() => onToggle(wordIndex)}
      onLongPress={() => onLongPress(wordIndex)}
      style={highlighted ? styles.hl : undefined}
    >
      {text}
    </Text>
  );
});

type ParagraphProps = {
  paragraph: MagpieParagraph;
  selectedSet: Set<number>;
  selKey: string;
  fontSize: number;
  lineHeight: number;
  onToggle: (wordIndex: number) => void;
  onLongPress: (wordIndex: number) => void;
};

const Paragraph = memo(
  function Paragraph({ paragraph, selectedSet, fontSize, lineHeight, onToggle, onLongPress }: ParagraphProps) {
    const highlighted = computeHighlight(paragraph.tokens, selectedSet);
    return (
      <UserText align="content" value={paragraph.text} style={[styles.pageText, { fontSize, lineHeight }]}>
        {paragraph.tokens.map((token) => (
          <Tok
            key={token.index}
            text={token.text}
            wordIndex={token.wordIndex}
            highlighted={highlighted.has(token.index)}
            onToggle={onToggle}
            onLongPress={onLongPress}
          />
        ))}
      </UserText>
    );
  },
  (prev, next) =>
    prev.selKey === next.selKey &&
    prev.fontSize === next.fontSize &&
    prev.lineHeight === next.lineHeight &&
    prev.paragraph === next.paragraph &&
    prev.onToggle === next.onToggle &&
    prev.onLongPress === next.onLongPress
);

// ── Screen ────────────────────────────────────────────────────────────────────
export function MagpiePageStep({
  model,
  spark,
}: {
  model: Model;
  spark: MagpieSpark;
}) {
  const { t } = useTranslation();
  const { zoom } = useSparkTextScale();
  const [selected, setSelected] = useState<number[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [splitRun, setSplitRun] = useState<number[] | null>(null);

  const { tokens, paragraphs } = useMemo(
    () => tokenizePageIntoParagraphs(spark.pageText),
    [spark.pageText]
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    setSelected([]);
  }, [spark.pageText]);

  const onToggle = useCallback((wordIndex: number) => {
    // Haptics vocabulary: light, a small state flip (a word marked or let go).
    haptic.light();
    setSelected((prev) =>
      prev.includes(wordIndex) ? prev.filter((w) => w !== wordIndex) : [...prev, wordIndex]
    );
  }, []);

  // Long-press a word: if it's part of a multi-word selected run, open the
  // "pull apart" editor for that run.
  const onLongPress = useCallback(
    (wordIndex: number) => {
      const runs = selectedRuns(selected);
      const run = runs.find((r) => r.includes(wordIndex));
      if (run && run.length > 1) {
        haptic.grab();
        setSplitRun(run);
      }
    },
    [selected]
  );

  const pocket = () => {
    const phrases = selectionToPhrases(tokens, selected);
    if (phrases.length === 0) return;
    model.pocketPhrases(phrases);
    setSelected([]);
  };

  const pocketPieces = (pieces: string[], run: number[]) => {
    if (pieces.length === 0) return;
    model.pocketPhrases(pieces);
    setSelected((prev) => prev.filter((w) => !run.includes(w)));
    setSplitRun(null);
  };

  const busy = model.status.loading;
  const fontSize = BASE_FONT * zoom;
  const lineHeight = BASE_LINE * zoom;
  const collected = spark.fragments;
  const pendingPhrases = useMemo(
    () => (selected.length > 0 ? selectionToPhrases(tokens, selected).length : 0),
    [tokens, selected]
  );

  return (
    <View style={styles.body}>
      <BookLine book={spark.book} fallbackTitle={t("magpie.findingBook")} onPress={() => setSourceOpen(true)} />

      <View style={styles.page}>
        {model.status.error ? (
          <ErrorState kind={model.status.error} onRetry={model.retry} onNewBook={model.newBook} />
        ) : busy && !spark.pageText ? (
          <View style={styles.center}>
            <Spinner color={colors.primary} />
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.pageScroll}
              contentContainerStyle={styles.pageContent}
              showsVerticalScrollIndicator={false}
            >
              {paragraphs.map((paragraph) => {
                const selKey = paragraph.wordIndices.filter((w) => selectedSet.has(w)).join(",");
                return (
                  <View key={paragraph.key} style={styles.para}>
                    <Paragraph
                      paragraph={paragraph}
                      selectedSet={selectedSet}
                      selKey={selKey}
                      fontSize={fontSize}
                      lineHeight={lineHeight}
                      onToggle={onToggle}
                      onLongPress={onLongPress}
                    />
                  </View>
                );
              })}
            </ScrollView>
            {busy ? (
              <View style={styles.turning} pointerEvents="none">
                <Spinner color={colors.primary} />
              </View>
            ) : null}
          </>
        )}
      </View>

      <CollectedStrip collected={collected} onRemove={model.removeFragment} />

      {/* One footer: Collect while words are marked, Build once there's a pile. */}
      <SparkFooter
        hint={
          pendingPhrases > 0
            ? t("magpie.picked", { count: pendingPhrases })
            : collected.length === 0 && !model.status.error
              ? t("magpie.tapToPocket")
              : null
        }
        next={
          pendingPhrases > 0
            ? { label: t("magpie.pocketThis"), onPress: pocket }
            : {
                label: t("wordSparks.build"),
                onPress: () => model.goToStep("build"),
                disabled: collected.length === 0,
              }
        }
      />

      <SourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        spark={spark}
        model={model}
        busy={busy}
      />
      <SplitSheet
        run={splitRun}
        tokens={tokens}
        onClose={() => setSplitRun(null)}
        onPocket={pocketPieces}
      />
    </View>
  );
}

// ── The book ──────────────────────────────────────────────────────────────────
/** The book this page comes from, a row on paper under the steps (2026-10-17;
 *  was a filled box squeezed into the header). Opens the source sheet. */
function BookLine({
  book,
  fallbackTitle,
  onPress,
}: {
  book: MagpieBook | null;
  fallbackTitle: string;
  onPress: () => void;
}) {
  const title = !book ? fallbackTitle : book.title || book.author || fallbackTitle;
  return (
    <Press
      // Haptics vocabulary: tap, an acknowledged press (opens a sheet).
      style={styles.credit}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <BookThumbnail book={book} small />
      <View style={styles.creditMeta}>
        <UserText style={styles.creditTitle} numberOfLines={1}>
          {title}
        </UserText>
        {book?.author ? (
          <UserText style={styles.creditAuthor} numberOfLines={1}>
            {book.author}
          </UserText>
        ) : null}
      </View>
      <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
    </Press>
  );
}

// ── Book thumbnail (graceful asymmetry) ───────────────────────────────────────
function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? [...words[words.length - 1]][0] ?? "" : "";
  return (first + last).toUpperCase();
}

function BookThumbnail({ book, small }: { book: MagpieBook | null; small?: boolean }) {
  const size = small ? styles.thumbSmall : styles.thumb;
  // A cover that won't load (no scan for that id, offline) falls back to the
  // initials tile rather than a blank grey square.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (book?.thumbnailUrl && failedUrl !== book.thumbnailUrl) {
    const uri = book.thumbnailUrl;
    return <Image source={{ uri }} style={size} resizeMode="cover" onError={() => setFailedUrl(uri)} />;
  }
  const initials = initialsFor(book?.author || book?.title || "");
  return (
    <View style={[size, styles.thumbPlaceholder]}>
      {initials ? (
        <UserText style={small ? styles.thumbInitialsSmall : styles.thumbInitials}>{initials}</UserText>
      ) : (
        <Ionicons name="book" size={small ? 14 : 18} color={colors.textMuted} />
      )}
    </View>
  );
}

// ── Collected words ───────────────────────────────────────────────────────────
/** The pile so far, as paper scraps under the page: a quiet count, then the
 *  words. Tap one to put it back (the toast offers Undo). */
function CollectedStrip({
  collected,
  onRemove,
}: {
  collected: MagpieSpark["fragments"];
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (collected.length === 0) return null;
  return (
    <View style={styles.gatheredRow}>
      <Text style={styles.countText}>{t("magpie.collected", { count: collected.length })}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        keyboardShouldPersistTaps="handled"
      >
        {collected.map((fragment) => (
          <Press
            // Haptics vocabulary: tap, an acknowledged press.
            key={fragment.id}
            style={styles.scrap}
            onPress={() => onRemove(fragment.id)}
            accessibilityRole="button"
            accessibilityLabel={t("magpie.remove")}
          >
            <UserText style={styles.scrapText} numberOfLines={1}>
              {fragment.text}
            </UserText>
            <Ionicons name="close" size={12} color={colors.textMuted} />
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Source sheet ──────────────────────────────────────────────────────────────
function SourceSheet({
  visible,
  onClose,
  spark,
  model,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  spark: MagpieSpark;
  model: Model;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const book = spark.book;
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.bookInfo}>
        <BookThumbnail book={book} />
        <View style={styles.bookMeta}>
          <Text style={styles.bookOver}>{t("magpie.pageFrom")}</Text>
          <UserText style={styles.bookTitle}>{book?.title || t("magpie.untitledWork")}</UserText>
          {book?.author ? <UserText style={styles.bookAuthor}>{book.author}</UserText> : null}
          <SourceCredit book={book} />
        </View>
      </View>

      <Button
        label={t("magpie.newPage")}
        onPress={() => {
          model.newPage();
          onClose();
        }}
        disabled={busy}
      />

      <View style={styles.sheetDivider} />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t("magpie.language")}</Text>
        <SegmentedControl<MagpieLanguage>
          options={[
            { key: "en", label: t("magpie.langEnglish") },
            { key: "es", label: t("magpie.langSpanish") },
            { key: "de", label: t("magpie.langGerman") },
            { key: "pt", label: t("magpie.langPortuguese") },
            ...(MAGPIE_HE_ENABLED ? [{ key: "he" as const, label: t("magpie.langHebrew") }] : []),
          ]}
          value={spark.language}
          onChange={(v) => {
            if (!busy) model.setLanguage(v);
          }}
        />
      </View>

      {spark.language === "en" ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("magpie.scope")}</Text>
          <SegmentedControl<"curated" | "library">
            options={[
              { key: "curated", label: t("magpie.curated") },
              { key: "library", label: t("magpie.library") },
            ]}
            value={spark.wholeLibrary ? "library" : "curated"}
            onChange={(v) => {
              if (!busy) model.setWholeLibrary(v === "library");
            }}
          />
        </View>
      ) : spark.language === "he" ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("magpie.genreHint")}</Text>
          <View style={styles.chips}>
            {MAGPIE_HE_GENRES.map((genre) => {
              const on = model.heGenres.includes(genre);
              return (
                <Press
                  // Haptics vocabulary: light, a small state flip (multi-select).
                  key={genre}
                  feel="glyph"
                  haptic="light"
                  style={styles.genre}
                  onPress={() => model.toggleHeGenre(genre)}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[styles.genreDot, on ? styles.genreDotOn : null]} />
                  <Text style={[styles.genreText, on ? styles.genreTextOn : null]}>{t(`magpie.genre.${genre}`)}</Text>
                </Press>
              );
            })}
          </View>
        </View>
      ) : null}

      <InkKey
        glyph={<Ionicons name="shuffle" size={16} color={inkKeyColor(busy ? "off" : "idle")} />}
        label={t("magpie.newBook")}
        tone={busy ? "off" : "idle"}
        onPress={() => {
          if (busy) return;
          model.newBook();
          onClose();
        }}
      />

      </ScrollView>
    </BottomSheet>
  );
}

function SourceCredit({ book }: { book: MagpieBook | null }) {
  const { t } = useTranslation();
  if (!book) return null;
  const label = book.source === "benyehuda" ? t("magpie.sourceBenYehuda") : t("magpie.sourceGutenberg");
  if (!book.sourceUrl) return <Text style={styles.bookSource}>{label}</Text>;
  return (
    <Press
      haptic="navigate"
      feel="glyph"
      // No handler for the URL rejects; nothing to show, nothing to crash on.
      onPress={() => void Linking.openURL(book.sourceUrl!).catch(() => {})}
      hitSlop={4}
      accessibilityRole="link"
    >
      <Text style={styles.bookSourceLink}>{label}</Text>
    </Press>
  );
}

// ── Split sheet (long-press "pull apart") ─────────────────────────────────────
function SplitSheet({
  run,
  tokens,
  onClose,
  onPocket,
}: {
  run: number[] | null;
  tokens: MagpieToken[];
  onClose: () => void;
  onPocket: (pieces: string[], run: number[]) => void;
}) {
  const { t } = useTranslation();
  const [cuts, setCuts] = useState<Set<number>>(new Set());

  // Reset cuts each time a new run opens.
  useEffect(() => {
    setCuts(new Set());
  }, [run]);

  const words = useMemo(() => {
    if (!run) return [];
    return run.map((wordIndex) => {
      const tok = tokens.find((tk) => tk.wordIndex === wordIndex);
      return { wordIndex, text: tok ? tok.text : "" };
    });
  }, [run, tokens]);

  const pieces = useMemo(() => (run ? runToPhrases(tokens, run, cuts) : []), [run, tokens, cuts]);

  const toggleSeam = (afterWordIndex: number) => {
    // Haptics vocabulary: light, a small state flip (a split made or mended).
    haptic.light();
    setCuts((prev) => {
      const next = new Set(prev);
      if (next.has(afterWordIndex)) next.delete(afterWordIndex);
      else next.add(afterWordIndex);
      return next;
    });
  };

  return (
    <BottomSheet visible={run !== null} onClose={onClose}>
      <Text style={styles.sheetLabel}>{t("magpie.pullApart")}</Text>
      <View style={styles.splitPhrase}>
        {words.map((word, i) => (
          <View key={word.wordIndex} style={styles.splitWordWrap}>
            <UserText style={styles.splitWord}>{word.text}</UserText>
            {i < words.length - 1 ? (
              <Press
                feel="still"
                haptic="none"
                onPress={() => toggleSeam(word.wordIndex)}
                hitSlop={8}
                style={styles.seam}
                accessibilityRole="button"
                accessibilityLabel={t("magpie.splitHere")}
              >
                <View style={[styles.seamMark, cuts.has(word.wordIndex) ? styles.seamMarkCut : null]} />
              </Press>
            ) : null}
          </View>
        ))}
      </View>
      <Text style={styles.splitHint}>{t("magpie.splitHint")}</Text>
      <Button label={t("magpie.pocketThis")} onPress={() => run && onPocket(pieces, run)} />
    </BottomSheet>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({
  kind,
  onRetry,
  onNewBook,
}: {
  kind: "offline" | "unavailable" | "empty";
  onRetry: () => void;
  onNewBook: () => void;
}) {
  const { t } = useTranslation();
  const offline = kind === "offline";
  return (
    <Animated.View entering={FadeIn.duration(durations.base)} style={styles.center}>
      <Ionicons name={offline ? "cloud-offline-outline" : "book-outline"} size={30} color={colors.textMuted} />
      <Text style={styles.errorTitle}>{t(offline ? "magpie.connectionTitle" : "magpie.pageErrorTitle")}</Text>
      <Text style={styles.errorBody}>{t(offline ? "magpie.connectionBody" : "magpie.pageErrorBody")}</Text>
      {/* One key and a quiet link (the empty-state law), not two pills. */}
      <View style={styles.errorActions}>
        <Button label={t("magpie.tryAgain")} onPress={onRetry} />
        {!offline ? <InkLink label={t("magpie.newBook")} icon="shuffle" onPress={onNewBook} /> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },

  // header
  credit: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    marginBottom: spacing.md,
  },
  creditMeta: { flex: 1, minWidth: 0 },
  creditTitle: { fontFamily: "Lora_500Medium", fontSize: 16, lineHeight: 21, color: colors.textPrimary },
  creditAuthor: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  thumb: { width: 42, height: 58, borderRadius: radii.sm, backgroundColor: colors.surfaceHigh },
  thumbSmall: { width: 28, height: 38, borderRadius: radii.xs, backgroundColor: colors.surfaceHigh },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  thumbInitials: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 15, color: colors.primaryDeep },
  thumbInitialsSmall: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 11, color: colors.primaryDeep },

  // the page (hero)
  page: { flex: 1, backgroundColor: PAGE_BG, borderRadius: radii.xl, ...shadows.card, overflow: "hidden" },
  pageScroll: { flex: 1 },
  pageContent: { paddingHorizontal: 22, paddingVertical: spacing.lg },
  para: { marginBottom: spacing.md },
  pageText: { fontFamily: "Lora_500Medium", color: colors.textStrong },
  // A marked word: the terracotta wash and deep ink, the app's one "chosen".
  hl: { backgroundColor: colors.primarySurface, color: colors.primaryDeep },
  turning: {
    position: "absolute",
    top: spacing.md,
    end: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.control,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  errorTitle: { fontFamily: "Lora_600SemiBold", fontSize: 17, color: colors.textPrimary, textAlign: "center" },
  errorBody: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  errorActions: { alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },

  // collected words
  gatheredRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
  countText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  strip: { flex: 1 },
  stripContent: { gap: spacing.xs, alignItems: "center", paddingEnd: spacing.md, paddingVertical: 4 },
  scrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 200,
    minHeight: 36,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingStart: spacing.md,
    paddingEnd: spacing.sm,
    ...shadows.card,
  },
  scrapText: { fontFamily: "Lora_500Medium", fontSize: 14, color: colors.textPrimary, flexShrink: 1 },

  // sheets — shared
  sheetScroll: { maxHeight: 540 },
  sheetLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, marginBottom: spacing.md },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderMuted, marginVertical: spacing.lg },

  // source sheet
  bookInfo: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginBottom: spacing.md },
  bookMeta: { flex: 1, minWidth: 0 },
  bookOver: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: colors.textMuted, marginBottom: 3 },
  bookTitle: { fontFamily: "Lora_600SemiBold", fontSize: 18, lineHeight: 22, color: colors.textPrimary },
  bookAuthor: { fontFamily: "Lora_500Medium", fontStyle: "italic", fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  bookSource: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11, color: colors.textMuted, marginTop: 6 },
  bookSourceLink: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11, color: colors.primaryDeep, marginTop: 6, textDecorationLine: "underline" },

  field: { marginBottom: spacing.md },
  fieldLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg },
  // Multi-select in editorial ink: word + leading dot, hollow → terracotta.
  genre: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 40 },
  genreDot: { width: 8, height: 8, borderRadius: radii.round, borderWidth: 1.25, borderColor: colors.textMuted },
  genreDotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  genreText: { fontFamily: "PlusJakartaSans_500Medium", fontSize: 14, color: colors.textSecondary },
  genreTextOn: { color: colors.textPrimary },

  // split sheet
  splitPhrase: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm },
  splitWordWrap: { flexDirection: "row", alignItems: "center" },
  splitWord: { fontFamily: "Lora_500Medium", fontSize: 22, color: colors.textPrimary, paddingVertical: 4 },
  seam: { width: 26, height: 34, alignItems: "center", justifyContent: "center" },
  seamMark: { width: 2, height: 20, borderRadius: 2, backgroundColor: colors.borderMuted },
  seamMarkCut: { width: 12, height: 34, borderRadius: 5, backgroundColor: PAGE_BG, borderWidth: 1, borderColor: colors.borderMuted },
  splitHint: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },
});
