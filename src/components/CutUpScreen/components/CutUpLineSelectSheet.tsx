import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { Button } from "../../common/Button";
import { Press } from "../../common/Press";
import { InkKey } from "../../common/InkKey";
import { UserText, contentRow } from "../../../i18n";
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
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleStanza = (stanza: number) => {
    setSelected((prev) => toggleStanzaSelection(lines, prev, stanza));
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(lines.map((line) => line.index)));
  };

  const confirm = () => {
    if (!note || selected.size === 0) return;
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
              <Text style={styles.subtitle}>
                {selected.size > 0 ? t("cutUp.linesChosen", { count: selected.size }) : t("cutUp.chooseLinesHint")}
              </Text>
            </View>
            <InkKey
              glyph={null}
              label={allSelected ? t("cutUp.clearLines") : t("common.selectAll")}
              onPress={toggleAll}
              style={styles.allKey}
            />
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {lines.map((line, i) => {
              const startsStanza = i === 0 || lines[i - 1].stanza !== line.stanza;
              return (
                <View key={line.index}>
                  {startsStanza && stanzaCount > 1 ? (
                    <Press
                      // Haptics vocabulary: tap, an acknowledged press (a whole verse).
                      style={[styles.verseLabelRow, contentRow(rtl ? "rtl" : "ltr"), i > 0 ? styles.verseLabelGap : null]}
                      onPress={() => toggleStanza(line.stanza)}
                      hitSlop={6}
                      accessibilityRole="button"
                    >
                      <Text style={styles.verseLabel}>
                        {t("cutUp.verseN", { num: line.stanza + 1 })}
                      </Text>
                      <Ionicons name="add-circle-outline" size={13} color={colors.textMuted} />
                    </Press>
                  ) : null}
                  <LineRow
                    line={line}
                    selected={selected.has(line.index)}
                    rtl={rtl}
                    onPress={() => toggleLine(line.index)}
                    onLongPress={() => {
                      // Haptics vocabulary: light, a small state flip (the whole verse).
                      haptic.light();
                      toggleStanza(line.stanza);
                    }}
                  />
                </View>
              );
            })}
          </ScrollView>

          <Button
            label={t("cutUp.useLinesShort")}
            onPress={confirm}
            disabled={selected.size === 0}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** A line of the page. Taken, its dot fills terracotta and the words come up
 *  to full ink: the app's one multi-select mark (editorial ink, no rail). */
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
    <Press
      // Haptics vocabulary: light, a small state flip (a line taken or dropped).
      haptic="light"
      style={[styles.lineRow, contentRow(rtl ? "rtl" : "ltr")]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <View style={[styles.dot, selected ? styles.dotOn : null]} />
      <UserText style={[styles.lineText, selected ? styles.lineTextSelected : null]}>{line.text}</UserText>
    </Press>
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
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: { ...textTokens.supporting, fontSize: 12 },
  allKey: { minHeight: 32 },

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

  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
    borderWidth: 1.25,
    borderColor: colors.textMuted,
  },
  dotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lineText: {
    flex: 1,
    fontFamily: "Lora_500Medium",
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  lineTextSelected: { color: colors.textPrimary },
});
