import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { ChordZoomBar } from "../../LyricsVersionScreen/components/chords/ChordZoomBar";
import {
  type MagpieParagraph,
  type MagpieToken,
  selectionToPhrases,
  tokenizePageIntoParagraphs,
} from "../../../domain/magpie";
import { MAGPIE_HE_ENABLED, MAGPIE_HE_GENRES, type MagpieHeGenre } from "../../../config/magpieService";
import type { MagpieBook, MagpieLanguage, MagpieSpark } from "../../../types";
import type { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

type Model = ReturnType<typeof useMagpieScreenModel>;

// Warm cream page laid on the kraft desk; a soft highlighter for pocketed words.
const PAGE_BG = "#FBF6EC";
const HL_BG = "#EEC79B";
const HL_TEXT = "#5C3A22";
const BASE_FONT = 18;
const BASE_LINE = 30;

/** Token indices to paint within a paragraph: selected words + the separators
 * strictly between two consecutive selected words (so a phrase reads as one
 * joined stroke). Scoped to one paragraph's tokens — cheap. */
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

type ParagraphProps = {
  paragraph: MagpieParagraph;
  selectedSet: Set<number>;
  /** Compact signature of this paragraph's selection — the memo key. */
  selKey: string;
  fontSize: number;
  lineHeight: number;
  onToggle: (wordIndex: number) => void;
};

const Paragraph = memo(
  function Paragraph({ paragraph, selectedSet, fontSize, lineHeight, onToggle }: ParagraphProps) {
    const highlighted = computeHighlight(paragraph.tokens, selectedSet);
    return (
      <UserText value={paragraph.tokens.map((token) => token.text).join("")} style={[styles.pageText, { fontSize, lineHeight }]}>
        {paragraph.tokens.map((token) =>
          token.wordIndex < 0 ? (
            <Text key={token.index} style={highlighted.has(token.index) ? styles.hl : undefined}>
              {token.text}
            </Text>
          ) : (
            <Text
              key={token.index}
              onPress={() => onToggle(token.wordIndex)}
              suppressHighlighting
              style={highlighted.has(token.index) ? styles.hl : undefined}
            >
              {token.text}
            </Text>
          )
        )}
      </UserText>
    );
  },
  (prev, next) =>
    prev.selKey === next.selKey &&
    prev.fontSize === next.fontSize &&
    prev.lineHeight === next.lineHeight &&
    prev.paragraph === next.paragraph &&
    prev.onToggle === next.onToggle
);

export function MagpiePageStep({ model, spark }: { model: Model; spark: MagpieSpark }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [genrePanelOpen, setGenrePanelOpen] = useState(false);

  const { tokens, paragraphs } = useMemo(
    () => tokenizePageIntoParagraphs(spark.pageText),
    [spark.pageText]
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Clear any in-progress selection when the page (or book) changes.
  useEffect(() => {
    setSelected([]);
  }, [spark.pageText]);

  const onToggle = useCallback((wordIndex: number) => {
    haptic.tap();
    setSelected((prev) =>
      prev.includes(wordIndex) ? prev.filter((w) => w !== wordIndex) : [...prev, wordIndex]
    );
  }, []);

  const pocket = () => {
    const phrases = selectionToPhrases(tokens, selected);
    if (phrases.length === 0) return;
    haptic.success();
    model.pocketPhrases(phrases);
    setSelected([]);
  };

  const busy = model.status.loading;
  const fontSize = BASE_FONT * zoom;
  const lineHeight = BASE_LINE * zoom;
  const collected = spark.fragments;
  const pendingPhrases = selected.length > 0 ? selectionToPhrases(tokens, selected).length : 0;

  return (
    <View style={styles.body}>
      <BookPlate
        book={spark.book}
        fallbackTitle={t("magpie.findingBook")}
        busy={busy}
        onNewPage={model.newPage}
        onNewBook={model.newBook}
      />

      <View style={styles.scopeRow}>
        {MAGPIE_HE_ENABLED ? (
          <LanguageToggle language={spark.language} onChange={model.setLanguage} disabled={busy} />
        ) : null}
        {spark.language === "en" ? (
          <ScopeToggle wholeLibrary={spark.wholeLibrary} onChange={model.setWholeLibrary} disabled={busy} />
        ) : null}
        {spark.language === "he" ? (
          <Pressable
            onPress={() => setGenrePanelOpen((open) => !open)}
            style={({ pressed }) => [styles.gearBtn, genrePanelOpen ? styles.gearBtnActive : null, pressed ? appStyles.pressDown : null]}
            hitSlop={6}
            accessibilityLabel={t("magpie.genreSettings")}
          >
            <Ionicons name="options-outline" size={17} color={genrePanelOpen ? colors.onPrimary : colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {spark.language === "he" && genrePanelOpen ? (
        <GenrePicker selected={model.heGenres} onToggle={model.toggleHeGenre} disabled={busy} />
      ) : null}
      <ChordZoomBar zoom={zoom} onChange={setZoom} compact />

      <View style={styles.page}>
        {model.status.error ? (
          <ErrorState kind={model.status.error} onRetry={model.retry} onNewBook={model.newBook} />
        ) : busy && !spark.pageText ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>{t("magpie.openingPage")}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.pageCaption}>{t("magpie.pageCaption")}</Text>
            <View style={styles.pageDivider} />
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

      {collected.length > 0 ? (
        <View style={styles.tray}>
          <Text style={styles.trayLabel}>{t("magpie.collected", { count: collected.length })}</Text>
          <ScrollView style={styles.trayScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.trayWrap}>
              {collected.map((fragment) => (
                <Pressable
                  key={fragment.id}
                  style={({ pressed }) => [styles.chip, pressed ? appStyles.pressDown : null]}
                  onPress={() => model.removeFragment(fragment.id)}
                >
                  <UserText style={styles.chipText} numberOfLines={1}>
                    {fragment.text}
                  </UserText>
                  <Ionicons name="close" size={12} color={colors.onPrimary} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.footer}>
        {selected.length > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed ? appStyles.pressDown : null]}
            onPress={pocket}
          >
            <Ionicons name="bookmark" size={16} color={colors.onPrimary} />
            <Text style={styles.primaryBtnText}>
              {pendingPhrases > 1
                ? t("magpie.pocketCount", { count: pendingPhrases })
                : t("magpie.pocketThis")}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              collected.length === 0 ? styles.primaryBtnGhost : null,
              pressed && collected.length > 0 ? appStyles.pressDown : null,
            ]}
            onPress={() => model.goToStep("build")}
            disabled={collected.length === 0}
          >
            {collected.length === 0 ? (
              <Text style={styles.primaryBtnGhostText}>{t("magpie.tapToPocket")}</Text>
            ) : (
              <>
                <Text style={styles.primaryBtnText}>{t("magpie.buildDraft")}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function BookPlate({
  book,
  fallbackTitle,
  busy,
  onNewPage,
  onNewBook,
}: {
  book: MagpieBook | null;
  fallbackTitle: string;
  busy: boolean;
  onNewPage: () => void;
  onNewBook: () => void;
}) {
  const { t } = useTranslation();
  // No book yet → "Finding a book…"; book loaded but title was junk/absent → "Untitled".
  const title = !book ? fallbackTitle : book.title || t("magpie.untitledWork");
  const author = book?.author ?? "";
  return (
    <View style={styles.plate}>
      <BookThumbnail book={book} />
      <View style={styles.plateMeta}>
        <Text style={styles.plateOverline}>{t("magpie.pageFrom")}</Text>
        <UserText style={styles.plateTitle}>{title}</UserText>
        {author ? <UserText style={styles.plateAuthor}>{author}</UserText> : null}
        <SourceCredit book={book} />
      </View>
      <View style={styles.plateActions}>
        <RoundAction icon="refresh" label={t("magpie.page")} accessibilityLabel={t("magpie.newPage")} onPress={onNewPage} disabled={busy} />
        <RoundAction icon="shuffle" label={t("magpie.book")} accessibilityLabel={t("magpie.newBook")} onPress={onNewBook} disabled={busy} />
      </View>
    </View>
  );
}

/** Two initials for the tonal placeholder used when there's no cover art. */
function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Graceful asymmetry: Gutenberg has cover thumbnails; Ben-Yehuda has none, so it
 * falls back to a tonal card with the author's initials (fits the no-photos
 * design language rather than leaving a lopsided gap). */
function BookThumbnail({ book }: { book: MagpieBook | null }) {
  if (book?.thumbnailUrl) {
    return <Image source={{ uri: book.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />;
  }
  const initials = initialsFor(book?.author || book?.title || "");
  return (
    <View style={[styles.thumb, styles.thumbPlaceholder]}>
      {initials ? (
        <UserText style={styles.thumbInitials}>{initials}</UserText>
      ) : (
        <Ionicons name="book" size={18} color={colors.textMuted} />
      )}
    </View>
  );
}

/** Credits the work's library (Project Gutenberg / Project Ben-Yehuda) with a
 * tap-through to the canonical source page. */
function SourceCredit({ book }: { book: MagpieBook | null }) {
  const { t } = useTranslation();
  if (!book) return null;
  const label = book.source === "benyehuda" ? t("magpie.sourceBenYehuda") : t("magpie.sourceGutenberg");
  if (!book.sourceUrl) {
    return <Text style={styles.plateSource}>{label}</Text>;
  }
  return (
    <Pressable onPress={() => Linking.openURL(book.sourceUrl!)} hitSlop={4}>
      <Text style={styles.plateSourceLink}>{label}</Text>
    </Pressable>
  );
}

function LanguageToggle({
  language,
  onChange,
  disabled,
}: {
  language: MagpieLanguage;
  onChange: (value: MagpieLanguage) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.scope}>
      {[
        { label: t("magpie.langEnglish"), value: "en" as const },
        { label: t("magpie.langHebrew"), value: "he" as const },
      ].map((option) => {
        const active = option.value === language;
        return (
          <Pressable
            key={option.value}
            style={[styles.scopeBtn, active ? styles.scopeBtnActive : null]}
            onPress={() => onChange(option.value)}
            disabled={disabled}
          >
            <Text style={[styles.scopeText, active ? styles.scopeTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RoundAction({
  icon,
  label,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.roundWrap}>
      <Pressable
        style={({ pressed }) => [styles.round, pressed && !disabled ? appStyles.pressDown : null]}
        onPress={onPress}
        disabled={disabled}
        hitSlop={6}
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name={icon} size={16} color={disabled ? colors.textMuted : colors.primary} />
      </Pressable>
      <Text style={[styles.roundLabel, disabled ? styles.roundLabelMuted : null]}>{label}</Text>
    </View>
  );
}

function ScopeToggle({
  wholeLibrary,
  onChange,
  disabled,
}: {
  wholeLibrary: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.scope}>
      {[
        { label: t("magpie.curated"), value: false },
        { label: t("magpie.library"), value: true },
      ].map((option) => {
        const active = option.value === wholeLibrary;
        return (
          <Pressable
            key={option.label}
            style={[styles.scopeBtn, active ? styles.scopeBtnActive : null]}
            onPress={() => onChange(option.value)}
            disabled={disabled}
          >
            <Text style={[styles.scopeText, active ? styles.scopeTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Checklist of Hebrew source genres; the writer keeps any non-empty subset
 * (uncheck all but one to narrow to just letters, memoir, etc.). */
function GenrePicker({
  selected,
  onToggle,
  disabled,
}: {
  selected: MagpieHeGenre[];
  onToggle: (genre: MagpieHeGenre) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.genrePanel}>
      <Text style={styles.genreHint}>{t("magpie.genreHint")}</Text>
      <View style={styles.genreWrap}>
        {MAGPIE_HE_GENRES.map((genre) => {
          const on = selected.includes(genre);
          return (
            <Pressable
              key={genre}
              style={[styles.genreChip, on ? styles.genreChipOn : null]}
              onPress={() => onToggle(genre)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Ionicons
                name={on ? "checkmark-circle" : "ellipse-outline"}
                size={14}
                color={on ? colors.onPrimary : colors.textMuted}
              />
              <Text style={[styles.genreText, on ? styles.genreTextOn : null]}>{t(`magpie.genre.${genre}`)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
    <View style={styles.center}>
      <Ionicons name={offline ? "cloud-offline-outline" : "book-outline"} size={30} color={colors.textMuted} />
      <Text style={styles.errorTitle}>{t(offline ? "magpie.connectionTitle" : "magpie.pageErrorTitle")}</Text>
      <Text style={styles.errorBody}>
        {offline
          ? t("magpie.connectionBody")
          : t("magpie.pageErrorBody")}
      </Text>
      <View style={styles.errorActions}>
        <Pressable
          style={({ pressed }) => [styles.errorBtn, pressed ? appStyles.pressDown : null]}
          onPress={onRetry}
        >
          <Ionicons name="refresh" size={14} color={colors.onPrimary} />
          <Text style={styles.errorBtnText}>{t("magpie.tryAgain")}</Text>
        </Pressable>
        {!offline ? (
          <Pressable
            style={({ pressed }) => [styles.errorBtnGhost, pressed ? appStyles.pressDown : null]}
            onPress={onNewBook}
          >
            <Ionicons name="shuffle" size={14} color={colors.primary} />
            <Text style={styles.errorBtnGhostText}>{t("magpie.newBook")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  plate: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  thumb: {
    width: 42,
    height: 58,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbInitials: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    letterSpacing: 0.5,
    color: colors.primary,
  },
  plateMeta: { flex: 1, minWidth: 0 },
  plateOverline: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 3,
  },
  plateTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  plateAuthor: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontStyle: "italic",
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  plateSource: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  plateSourceLink: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
    textDecorationLine: "underline",
  },
  plateActions: { flexDirection: "row", gap: spacing.sm, flexShrink: 0 },
  roundWrap: { alignItems: "center", gap: 3 },
  round: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.control,
  },
  roundLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.textSecondary,
  },
  roundLabelMuted: { color: colors.textMuted },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  scope: {
    flexDirection: "row",
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    padding: 3,
  },
  scopeBtn: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radii.round },
  scopeBtnActive: { backgroundColor: colors.primary },
  scopeText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, color: colors.textSecondary },
  scopeTextActive: { color: colors.onPrimary },
  gearBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  gearBtnActive: { backgroundColor: colors.primary },
  genrePanel: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  genreHint: { ...textTokens.annotation, marginBottom: spacing.xs, paddingHorizontal: 2 },
  genreWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  genreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radii.round,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 6,
  },
  genreChipOn: { backgroundColor: colors.primary },
  genreText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, color: colors.textSecondary },
  genreTextOn: { color: colors.onPrimary },
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
    borderRadius: radii.xl,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    ...shadows.card,
    overflow: "hidden",
  },
  pageCaption: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontStyle: "italic",
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  pageDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xl,
  },
  pageScroll: { flex: 1 },
  pageContent: { paddingHorizontal: 22, paddingTop: spacing.md, paddingBottom: spacing.xl },
  para: { marginBottom: spacing.md },
  pageText: {
    fontFamily: "PlayfairDisplay_400Regular",
    color: colors.textStrong,
  },
  hl: {
    backgroundColor: HL_BG,
    color: HL_TEXT,
  },
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
  centerText: { ...textTokens.supporting },
  errorTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
    textAlign: "center",
  },
  errorBody: { ...textTokens.supporting, textAlign: "center" },
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
  errorBtnGhostText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.primary },
  tray: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  trayLabel: { ...textTokens.annotation, marginBottom: spacing.xs },
  trayScroll: { maxHeight: 92 },
  trayWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.onPrimary,
    flexShrink: 1,
  },
  footer: { paddingTop: spacing.md },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 15,
  },
  primaryBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },
  primaryBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  primaryBtnGhostText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 13, color: colors.textMuted },
});
