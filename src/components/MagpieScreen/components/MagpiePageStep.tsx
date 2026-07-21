import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing } from "../../../design/tokens";
import { durations } from "../../../design/motion";
import { haptic } from "../../../design/haptics";
import { BottomSheet } from "../../common/BottomSheet";
import { ChordZoomBar } from "../../LyricsVersionScreen/components/chords/ChordZoomBar";
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
import { UserText } from "../../../i18n";

type Model = ReturnType<typeof useMagpieScreenModel>;

const PAGE_BG = "#FBF6EC";
const HL_BG = "#EEC79B";
const HL_TEXT = "#5C3A22";
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
      <UserText value={paragraph.text} style={[styles.pageText, { fontSize, lineHeight }]}>
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
  onHelp,
}: {
  model: Model;
  spark: MagpieSpark;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
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
    haptic.tap();
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
    haptic.success();
    model.pocketPhrases(phrases);
    setSelected([]);
  };

  const pocketPieces = (pieces: string[], run: number[]) => {
    if (pieces.length === 0) return;
    haptic.success();
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
      <Header
        book={spark.book}
        fallbackTitle={t("magpie.findingBook")}
        onBack={model.goBack}
        onSource={() => setSourceOpen(true)}
        onSize={() => setSizeOpen(true)}
        onHelp={onHelp}
      />

      <View style={styles.page}>
        {model.status.error ? (
          <ErrorState kind={model.status.error} onRetry={model.retry} onNewBook={model.newBook} />
        ) : busy && !spark.pageText ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <UserText style={styles.loadCaption}>{t("magpie.pageCaption")}</UserText>
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
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
          </>
        )}
      </View>

      <BottomBar
        pendingPhrases={pendingPhrases}
        collected={collected}
        onPocket={pocket}
        onRemove={model.removeFragment}
        onBuild={() => model.goToStep("build")}
      />

      <SourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        spark={spark}
        model={model}
        busy={busy}
      />
      <BottomSheet visible={sizeOpen} onClose={() => setSizeOpen(false)}>
        <Text style={styles.sheetLabel}>{t("magpie.textSize")}</Text>
        <ChordZoomBar zoom={zoom} onChange={setZoom} />
      </BottomSheet>
      <SplitSheet
        run={splitRun}
        tokens={tokens}
        onClose={() => setSplitRun(null)}
        onPocket={pocketPieces}
      />
    </View>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({
  book,
  fallbackTitle,
  onBack,
  onSource,
  onSize,
  onHelp,
}: {
  book: MagpieBook | null;
  fallbackTitle: string;
  onBack: () => void;
  onSource: () => void;
  onSize: () => void;
  onHelp: () => void;
}) {
  const title = !book ? fallbackTitle : book.title || book.author || fallbackTitle;
  return (
    <View style={styles.header}>
      <IconBtn icon="chevron-back" label="Back" onPress={onBack} />
      <Pressable
        style={({ pressed }) => [styles.credit, pressed ? appStyles.pressDown : null]}
        onPress={onSource}
        hitSlop={4}
      >
        <BookThumbnail book={book} small />
        <View style={styles.creditMeta}>
          <UserText style={styles.creditTitle} numberOfLines={2}>
            {title}
          </UserText>
          {book?.author ? (
            <UserText style={styles.creditAuthor} numberOfLines={1}>
              {book.author}
            </UserText>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
      </Pressable>
      <IconBtn text="Aa" label="Text size" onPress={onSize} />
      <IconBtn icon="help-circle-outline" label="How this works" onPress={onHelp} />
    </View>
  );
}

function IconBtn({
  icon,
  text,
  label,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  text?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.iconBtn, pressed ? appStyles.pressDown : null]}
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={colors.textStrong} />
      ) : (
        <Text style={styles.iconBtnText}>{text}</Text>
      )}
    </Pressable>
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
  if (book?.thumbnailUrl) {
    return <Image source={{ uri: book.thumbnailUrl }} style={size} resizeMode="cover" />;
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

// ── Bottom bar ────────────────────────────────────────────────────────────────
function BottomBar({
  pendingPhrases,
  collected,
  onPocket,
  onRemove,
  onBuild,
}: {
  pendingPhrases: number;
  collected: MagpieSpark["fragments"];
  onPocket: () => void;
  onRemove: (id: string) => void;
  onBuild: () => void;
}) {
  const { t } = useTranslation();

  if (pendingPhrases > 0) {
    return (
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed ? appStyles.pressDown : null]}
          onPress={onPocket}
        >
          <Ionicons name="bookmark" size={16} color={colors.onPrimary} />
          <Text style={styles.primaryBtnText}>
            {pendingPhrases > 1 ? t("magpie.pocketCount", { count: pendingPhrases }) : t("magpie.pocketThis")}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (collected.length === 0) {
    return (
      <View style={styles.bottomBar}>
        <Text style={styles.emptyHint}>{t("magpie.tapToPocket")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.bottomBar}>
      <View style={styles.gatheredRow}>
        <View style={styles.count}>
          <Text style={styles.countText}>{collected.length}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          keyboardShouldPersistTaps="handled"
        >
          {collected.map((fragment) => (
            <Pressable
              key={fragment.id}
              style={({ pressed }) => [styles.scrap, pressed ? appStyles.pressDown : null]}
              onPress={() => {
                haptic.light();
                onRemove(fragment.id);
              }}
            >
              <UserText style={styles.scrapText} numberOfLines={1}>
                {fragment.text}
              </UserText>
              <Ionicons name="close" size={11} color={colors.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Pressable
        style={({ pressed }) => [styles.buildBtn, pressed ? appStyles.pressDown : null]}
        onPress={onBuild}
      >
        <Text style={styles.buildBtnText}>{t("magpie.buildDraft")}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.onPrimary} />
      </Pressable>
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
      <View style={styles.bookInfo}>
        <BookThumbnail book={book} />
        <View style={styles.bookMeta}>
          <Text style={styles.bookOver}>{t("magpie.pageFrom")}</Text>
          <UserText style={styles.bookTitle}>{book?.title || t("magpie.untitledWork")}</UserText>
          {book?.author ? <UserText style={styles.bookAuthor}>{book.author}</UserText> : null}
          <SourceCredit book={book} />
        </View>
      </View>

      <DrawButton
        icon="refresh"
        label={t("magpie.newPage")}
        primary
        onPress={() => {
          model.newPage();
          onClose();
        }}
        disabled={busy}
      />

      <View style={styles.sheetDivider} />

      {MAGPIE_HE_ENABLED ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("magpie.language")}</Text>
          <Segmented
            options={[
              { label: t("magpie.langEnglish"), value: "en" as MagpieLanguage },
              { label: t("magpie.langHebrew"), value: "he" as MagpieLanguage },
            ]}
            value={spark.language}
            onChange={(v) => model.setLanguage(v)}
            disabled={busy}
          />
        </View>
      ) : null}

      {spark.language === "en" ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("magpie.scope")}</Text>
          <Segmented
            options={[
              { label: t("magpie.curated"), value: false },
              { label: t("magpie.library"), value: true },
            ]}
            value={spark.wholeLibrary}
            onChange={(v) => model.setWholeLibrary(v)}
            disabled={busy}
          />
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("magpie.genreHint")}</Text>
          <View style={styles.chips}>
            {MAGPIE_HE_GENRES.map((genre) => {
              const on = model.heGenres.includes(genre);
              return (
                <Pressable
                  key={genre}
                  style={[styles.chip, on ? styles.chipOn : null]}
                  onPress={() => model.toggleHeGenre(genre)}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons
                    name={on ? "checkmark-circle" : "ellipse-outline"}
                    size={14}
                    color={on ? colors.onPrimary : colors.textMuted}
                  />
                  <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{t(`magpie.genre.${genre}`)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <DrawButton
        icon="shuffle"
        label={t("magpie.newBook")}
        onPress={() => {
          model.newBook();
          onClose();
        }}
        disabled={busy}
      />

      <Pressable
        style={({ pressed }) => [styles.deleteRow, pressed ? appStyles.pressDown : null]}
        onPress={() => {
          onClose();
          model.deleteSpark();
        }}
      >
        <Ionicons name="trash-outline" size={15} color={colors.danger} />
        <Text style={styles.deleteText}>{t("magpie.deleteTitle")}</Text>
      </Pressable>
    </BottomSheet>
  );
}

function SourceCredit({ book }: { book: MagpieBook | null }) {
  const { t } = useTranslation();
  if (!book) return null;
  const label = book.source === "benyehuda" ? t("magpie.sourceBenYehuda") : t("magpie.sourceGutenberg");
  if (!book.sourceUrl) return <Text style={styles.bookSource}>{label}</Text>;
  return (
    <Pressable onPress={() => Linking.openURL(book.sourceUrl!)} hitSlop={4}>
      <Text style={styles.bookSourceLink}>{label}</Text>
    </Pressable>
  );
}

function DrawButton({
  icon,
  label,
  primary,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.drawBtn,
        primary ? styles.drawBtnPrimary : styles.drawBtnGhost,
        pressed && !disabled ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.onPrimary : colors.primaryDeep} />
      <Text style={[styles.drawBtnText, primary ? styles.drawBtnTextPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

function Segmented<T>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            style={[styles.segmentBtn, active ? styles.segmentBtnActive : null]}
            onPress={() => onChange(option.value)}
            disabled={disabled}
          >
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
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
              <Pressable
                onPress={() => toggleSeam(word.wordIndex)}
                hitSlop={8}
                style={styles.seam}
                accessibilityLabel={t("magpie.splitHere")}
              >
                <View style={[styles.seamMark, cuts.has(word.wordIndex) ? styles.seamMarkCut : null]} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      <Text style={styles.splitHint}>{t("magpie.splitHint")}</Text>
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, styles.splitCommit, pressed ? appStyles.pressDown : null]}
        onPress={() => run && onPocket(pieces, run)}
      >
        <Ionicons name="bookmark" size={16} color={colors.onPrimary} />
        <Text style={styles.primaryBtnText}>
          {pieces.length > 1 ? t("magpie.pocketCount", { count: pieces.length }) : t("magpie.pocketThis")}
        </Text>
      </Pressable>
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
      <View style={styles.errorActions}>
        <Pressable style={({ pressed }) => [styles.errorBtn, pressed ? appStyles.pressDown : null]} onPress={onRetry}>
          <Ionicons name="refresh" size={14} color={colors.onPrimary} />
          <Text style={styles.errorBtnText}>{t("magpie.tryAgain")}</Text>
        </Pressable>
        {!offline ? (
          <Pressable style={({ pressed }) => [styles.errorBtnGhost, pressed ? appStyles.pressDown : null]} onPress={onNewBook}>
            <Ionicons name="shuffle" size={14} color={colors.primaryDeep} />
            <Text style={styles.errorBtnGhostText}>{t("magpie.newBook")}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },

  // header
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingBottom: spacing.sm },
  iconBtn: { minWidth: 34, height: 34, borderRadius: radii.round, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  iconBtnText: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 16, color: colors.textStrong },
  credit: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
  },
  creditMeta: { flex: 1, minWidth: 0 },
  creditTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 13.5, lineHeight: 17, color: colors.textPrimary },
  creditAuthor: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 11, color: colors.textMuted, marginTop: 1 },

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
  pageText: { fontFamily: "PlayfairDisplay_400Regular", color: colors.textStrong },
  hl: { backgroundColor: HL_BG, color: HL_TEXT },
  turning: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.control,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  loadCaption: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontStyle: "italic",
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  errorTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 17, color: colors.textPrimary, textAlign: "center" },
  errorBody: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  errorActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  errorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  errorBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.onPrimary },
  errorBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  errorBtnGhostText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.primaryDeep },

  // bottom bar
  bottomBar: { paddingTop: spacing.md, gap: spacing.sm },
  emptyHint: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontStyle: "italic",
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  gatheredRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  count: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: radii.round,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 11, color: colors.onPrimary },
  strip: { flex: 1 },
  stripContent: { gap: spacing.xs, alignItems: "center", paddingRight: spacing.md },
  scrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: radii.round,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    ...shadows.control,
  },
  scrapText: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 13, color: colors.textStrong, flexShrink: 1 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.round,
    paddingVertical: 15,
  },
  primaryBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.round,
    paddingVertical: 14,
  },
  buildBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },

  // sheets — shared
  sheetLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, marginBottom: spacing.md },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderMuted, marginVertical: spacing.lg },

  // source sheet
  bookInfo: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginBottom: spacing.md },
  bookMeta: { flex: 1, minWidth: 0 },
  bookOver: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: colors.textMuted, marginBottom: 3 },
  bookTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, lineHeight: 22, color: colors.textPrimary },
  bookAuthor: { fontFamily: "PlayfairDisplay_400Regular", fontStyle: "italic", fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  bookSource: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11, color: colors.textMuted, marginTop: 6 },
  bookSourceLink: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11, color: colors.primaryDeep, marginTop: 6, textDecorationLine: "underline" },

  drawBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.lg, paddingVertical: 13 },
  drawBtnPrimary: { backgroundColor: colors.primaryDeep },
  drawBtnGhost: { borderWidth: 1, borderColor: colors.borderMuted },
  drawBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13.5, color: colors.primaryDeep },
  drawBtnTextPrimary: { color: colors.onPrimary },

  field: { marginBottom: spacing.md },
  fieldLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, marginBottom: spacing.sm },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceHigh, borderRadius: radii.round, padding: 3, alignSelf: "flex-start" },
  segmentBtn: { paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: radii.round },
  segmentBtnActive: { backgroundColor: colors.primaryDeep },
  segmentText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12.5, color: colors.textSecondary },
  segmentTextActive: { color: colors.onPrimary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceHigh, borderRadius: radii.round, paddingLeft: spacing.sm, paddingRight: spacing.md, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.primaryDeep },
  chipText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12.5, color: colors.textSecondary },
  chipTextOn: { color: colors.onPrimary },

  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.lg, paddingVertical: spacing.sm },
  deleteText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 13, color: colors.danger },

  // split sheet
  splitPhrase: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm },
  splitWordWrap: { flexDirection: "row", alignItems: "center" },
  splitWord: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 22, color: colors.textPrimary, paddingVertical: 4 },
  seam: { width: 26, height: 34, alignItems: "center", justifyContent: "center" },
  seamMark: { width: 2, height: 20, borderRadius: 2, backgroundColor: colors.borderMuted },
  seamMarkCut: { width: 12, height: 34, borderRadius: 5, backgroundColor: PAGE_BG, borderWidth: 1, borderColor: colors.borderMuted },
  splitHint: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },
  splitCommit: { marginTop: spacing.xs },
});
