import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { UserText } from "../../../i18n";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import {
  joinSelectedLines,
  splitSourceLines,
  toggleStanzaSelection,
  type SourceLine,
} from "../../../domain/cutUp";
import { detectTextDirection } from "../../../i18n/direction";
import { deriveNotePreviewTitle } from "../../../domain/notepad";
import type { Note } from "../../../types";
import { useTranslation } from "react-i18next";

type Props = {
  note: Note | null;
  onClose: () => void;
  /** Called with the chosen lines joined back into source text. */
  onConfirm: (note: Note, text: string) => void;
};

/**
 * The "choose your material" step of importing from a Lyrics Pad page. The
 * whole page is shown, grouped by verse; nothing is selected until the writer
 * takes it — the exercise is about working a piece, not the whole song. Tap a
 * line to take or drop it; tap a verse label (or long-press any line) for the
 * whole verse; "Select all" for the whole page.
 */
export function CutUpLineSelectSheet({ note, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const lines = useMemo(() => (note ? splitSourceLines(note.body) : []), [note]);
  const stanzaCount = lines.length > 0 ? lines[lines.length - 1].stanza + 1 : 0;
  const rtl = note ? detectTextDirection(note.body) === "rtl" : false;
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Fresh selection each time a page is opened.
  useEffect(() => {
    setSelected(new Set());
  }, [note?.id]);

  const allSelected = lines.length > 0 && selected.size === lines.length;

  const toggleLine = (index: number) => {
    haptic.light();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleStanza = (stanza: number) => {
    haptic.tap();
    setSelected((prev) => toggleStanzaSelection(lines, prev, stanza));
  };

  const toggleAll = () => {
    haptic.tap();
    setSelected(allSelected ? new Set() : new Set(lines.map((line) => line.index)));
  };

  const confirm = () => {
    if (!note || selected.size === 0) return;
    haptic.tap();
    onConfirm(note, joinSelectedLines(lines, selected));
  };

  return (
    <BottomSheet visible={note !== null} onClose={onClose} expandable collapsedHeight={620}>
      {note ? (
        <View style={styles.body}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={1}>
                {deriveNotePreviewTitle(note)}
              </Text>
              <Text style={styles.subtitle}>{t("cutUp.chooseLinesHint")}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.allBtn, pressed ? appStyles.pressDown : null]}
              onPress={toggleAll}
              hitSlop={6}
            >
              <Text style={styles.allBtnText}>
                {allSelected ? t("cutUp.clearLines") : t("common.selectAll")}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {lines.map((line, i) => {
              const startsStanza = i === 0 || lines[i - 1].stanza !== line.stanza;
              return (
                <View key={line.index}>
                  {startsStanza && stanzaCount > 1 ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.verseLabelRow,
                        rtl ? styles.rowRtl : null,
                        i > 0 ? styles.verseLabelGap : null,
                        pressed ? appStyles.pressDown : null,
                      ]}
                      onPress={() => toggleStanza(line.stanza)}
                      hitSlop={6}
                    >
                      <Text style={styles.verseLabel}>
                        {t("cutUp.verseN", { num: line.stanza + 1 })}
                      </Text>
                      <Ionicons name="add-circle-outline" size={13} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                  <LineRow
                    line={line}
                    selected={selected.has(line.index)}
                    rtl={rtl}
                    onPress={() => toggleLine(line.index)}
                    onLongPress={() => toggleStanza(line.stanza)}
                  />
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              selected.size === 0 ? styles.ctaDisabled : null,
              pressed && selected.size > 0 ? appStyles.pressDown : null,
            ]}
            onPress={confirm}
            disabled={selected.size === 0}
          >
            <Text style={[styles.ctaText, selected.size === 0 ? styles.ctaTextDisabled : null]}>
              {t("cutUp.useLines", { count: selected.size })}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={selected.size > 0 ? colors.onPrimary : colors.textSecondary}
            />
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function LineRow({
  line,
  selected,
  rtl,
  onPress,
  onLongPress,
}: {
  line: SourceLine;
  selected: boolean;
  rtl: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.lineRow,
        rtl ? styles.rowRtl : null,
        selected ? styles.lineRowSelected : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
    >
      <View style={[styles.selectBar, selected ? styles.selectBarOn : null]} />
      <UserText
        style={[styles.lineText, selected ? styles.lineTextSelected : null]}
      >
        {line.text}
      </UserText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: { ...textTokens.supporting, fontSize: 12 },
  allBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  allBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12, color: colors.primaryDeep },

  scroll: { flex: 1, marginBottom: spacing.sm },

  verseLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    marginBottom: 2,
  },
  verseLabelGap: { marginTop: spacing.lg },
  verseLabel: { ...textTokens.annotation },

  rowRtl: { flexDirection: "row-reverse" },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    marginBottom: 2,
  },
  lineRowSelected: { backgroundColor: colors.surfaceContainer },
  selectBar: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: "transparent" },
  selectBarOn: { backgroundColor: colors.primary },
  lineText: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  lineTextSelected: { color: colors.textPrimary },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.round,
    paddingVertical: 14,
  },
  ctaDisabled: { backgroundColor: colors.borderMuted },
  ctaText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },
  ctaTextDisabled: { color: colors.textSecondary },
});
