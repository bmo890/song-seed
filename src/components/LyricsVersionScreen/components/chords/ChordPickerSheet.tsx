import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../common/BottomSheet";
import { Button } from "../../../common/Button";
import { Press } from "../../../common/Press";
import { colors, radii, spacing, text as textTokens } from "../../../../design/tokens";
import {
  CHORD_ROOTS,
  QUALITY_OPTIONS,
  accidentalSymbol,
  buildChordDisplay,
  tidyChordName,
  type ChordParts,
} from "../../../../domain/chords";
import type { ChordAccidental, SongChordPaletteItem } from "../../../../types";
import { useTranslation } from "react-i18next";
import { UserTextInput, ltrRow } from "../../../../i18n";

/** A chord symbol reads left to right in every language ("C/G", "/E"): the left-to-right
 *  mark keeps a leading slash from landing on the wrong side in a Hebrew paragraph. */
const LRM = "\u200E";

type Props = {
  visible: boolean;
  mode: "add" | "edit";
  initial: ChordParts | null;
  palette: SongChordPaletteItem[];
  onClose: () => void;
  onSave: (parts: ChordParts) => void;
  onDelete: () => void;
};

const EMPTY: ChordParts = { root: "C", accidental: "natural", quality: "" };

/**
 * The one chord picker (2026-10-18), shared by the lyric chord editor and the
 * bar chart. The chord you are making sits large at the top, in the reading
 * ink; every key is ink on paper, the chosen one in the tonal terracotta wash
 * (no filled chips). Each chord type is labelled by the chord it makes with
 * the root you picked ("D", "Dm", "D7", "Dmaj7"), the way charts write them.
 */
export function ChordPickerSheet({ visible, mode, initial, palette, onClose, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<ChordParts>(EMPTY);

  useEffect(() => {
    if (!visible) return;
    setParts(initial ? { accidental: "natural", quality: "", ...initial } : EMPTY);
  }, [visible, initial]);

  const preview = buildChordDisplay(parts);
  const update = (patch: Partial<ChordParts>) => setParts((prev) => ({ ...prev, ...patch }));
  // Types are named with the chosen root; a chord saved without one reads on C.
  const rootName = `${parts.root ?? "C"}${parts.root ? accidentalSymbol(parts.accidental) : ""}`;
  const toggleAccidental = (next: ChordAccidental) =>
    update({ accidental: (parts.accidental ?? "natural") === next ? "natural" : next });
  const toggleBassAccidental = (next: ChordAccidental) =>
    update({ bassAccidental: (parts.bassAccidental ?? "natural") === next ? "natural" : next });

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding>
      <View style={s.headerRow}>
        <Text style={s.title}>{t(mode === "edit" ? "chordEditor.editChord" : "chordEditor.addChord")}</Text>
        <Text style={s.preview} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {preview ? LRM + preview : "—"}
        </Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {palette.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>{t("chordEditor.recent")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.paletteRow}
              keyboardShouldPersistTaps="handled"
            >
              {palette.map((item) => (
                <Key
                  key={item.id}
                  label={tidyChordName(item.displayText)}
                  active={false}
                  wide
                  onPress={() =>
                    onSave({
                      root: item.root,
                      accidental: item.accidental,
                      quality: item.quality,
                      extension: item.extension,
                      bassRoot: item.bassRoot,
                      bassAccidental: item.bassAccidental,
                      customSuffix: item.customSuffix,
                    })
                  }
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={s.sectionLabel}>{t("chordEditor.root")}</Text>
        {/* Seven letters, then flat and sharp: one row, so a root is one glance.
            Notation, not a list: A to G runs left to right in Hebrew too. */}
        <View style={[s.cellRow, ltrRow]}>
          {CHORD_ROOTS.map((root) => (
            <Key key={root} label={root} cell active={parts.root === root} onPress={() => update({ root })} />
          ))}
          <View style={s.keyGap} />
          <Key
            label="♭"
            cell
            active={parts.accidental === "flat"}
            onPress={() => toggleAccidental("flat")}
            accessibilityLabel={t("chordEditor.flat")}
          />
          <Key
            label="♯"
            cell
            active={parts.accidental === "sharp"}
            onPress={() => toggleAccidental("sharp")}
            accessibilityLabel={t("chordEditor.sharp")}
          />
        </View>

        <Text style={s.sectionLabel}>{t("chordEditor.quality")}</Text>
        <View style={[s.grid, ltrRow]}>
          {QUALITY_OPTIONS.map((option) => (
            <Key
              key={option.value || "major"}
              label={`${rootName}${option.value}`}
              active={(tidyQuality(parts.quality) ?? "") === option.value}
              wide
              onPress={() => update({ quality: option.value })}
            />
          ))}
        </View>

        <Text style={s.sectionLabel}>{t("chordEditor.slashBass")}</Text>
        <View style={[s.grid, ltrRow]}>
          <Key
            label={t("chordEditor.none")}
            active={!parts.bassRoot}
            wide
            onPress={() => update({ bassRoot: undefined, bassAccidental: undefined })}
          />
          {CHORD_ROOTS.map((root) => (
            <Key
              key={`bass-${root}`}
              label={`/${root}`}
              active={parts.bassRoot === root}
              onPress={() => update({ bassRoot: root, bassAccidental: parts.bassAccidental ?? "natural" })}
            />
          ))}
          {parts.bassRoot ? (
            <>
              <View style={s.keyGap} />
              <Key
                label="♭"
                active={parts.bassAccidental === "flat"}
                onPress={() => toggleBassAccidental("flat")}
                accessibilityLabel={t("chordEditor.flat")}
              />
              <Key
                label="♯"
                active={parts.bassAccidental === "sharp"}
                onPress={() => toggleBassAccidental("sharp")}
                accessibilityLabel={t("chordEditor.sharp")}
              />
            </>
          ) : null}
        </View>

        <Text style={s.sectionLabel}>{t("chordEditor.customSuffix")}</Text>
        <UserTextInput
          style={s.customInput}
          value={parts.customSuffix ?? ""}
          onChangeText={(customSuffix) => update({ customSuffix })}
          placeholder={t("chordEditor.customSuffixPlaceholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </ScrollView>

      <View style={s.actions}>
        {mode === "edit" ? (
          <Press
            feel="glyph"
            // haptics.ts: tap → a control acted (the chord is removed).
            haptic="tap"
            style={s.deleteBtn}
            onPress={onDelete}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("chordEditor.removeChord")}
          >
            <Ionicons name="trash-outline" size={19} color={colors.danger} />
          </Press>
        ) : null}
        <Button
          label={t(mode === "edit" ? "chordEditor.updateChord" : "chordEditor.addChord")}
          onPress={() => onSave(parts)}
          disabled={!preview}
          style={s.saveBtn}
        />
      </View>
    </BottomSheet>
  );
}

/** A long-hand quality an older chord was saved with ("maj", "min7") reads as
 *  the key that makes it today ("", "m7"). */
function tidyQuality(quality: string | undefined): string | undefined {
  if (quality == null) return quality;
  const tidied = tidyChordName(`C${quality}`);
  return tidied.slice(1);
}

function Key({
  label,
  active,
  onPress,
  wide = false,
  cell = false,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Sized to its word (chord types, the bass "none") rather than a letter cell. */
  wide?: boolean;
  /** An equal share of a row (the root letters and accidentals). */
  cell?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Press
      feel="surface"
      // haptics.ts: light → a small state flip (a choice in a set).
      haptic="light"
      style={[s.key, wide ? s.keyWide : null, cell ? s.keyCell : null, active ? s.keyActive : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[s.keyText, active ? s.keyTextActive : null]} numberOfLines={1}>
        {LRM + label}
      </Text>
    </Press>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  title: {
    ...textTokens.headerTitle,
    fontSize: 19,
  },
  // The chord being made, large in the reading ink (as it will read on a chart).
  preview: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 28,
    color: colors.textStrong,
  },
  scroll: {
    maxHeight: 380,
  },
  sectionLabel: {
    ...textTokens.annotation,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  paletteRow: {
    flexDirection: "row",
    gap: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  cellRow: {
    flexDirection: "row",
    gap: 2,
  },
  keyGap: {
    width: 8,
  },
  key: {
    minWidth: 40,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  keyCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  keyWide: {
    minWidth: 58,
    paddingHorizontal: 10,
  },
  keyActive: {
    backgroundColor: colors.primarySurface,
  },
  keyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    color: colors.textStrong,
  },
  keyTextActive: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
  // One field: the tonal fill, as the search field wears it.
  customInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    flex: 1,
  },
});
