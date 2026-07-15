import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../common/BottomSheet";
import { styles as appStyles } from "../../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../../design/tokens";
import {
  ACCIDENTAL_OPTIONS,
  CHORD_ROOTS,
  QUALITY_OPTIONS,
  buildChordDisplay,
  type ChordParts,
} from "../../../../domain/chords";
import type { ChordAccidental, ChordRoot, SongChordPaletteItem } from "../../../../types";

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

export function ChordPickerSheet({ visible, mode, initial, palette, onClose, onSave, onDelete }: Props) {
  const [parts, setParts] = useState<ChordParts>(EMPTY);

  useEffect(() => {
    if (!visible) return;
    setParts(initial ? { accidental: "natural", quality: "", ...initial } : EMPTY);
  }, [visible, initial]);

  const preview = buildChordDisplay(parts);
  const update = (patch: Partial<ChordParts>) => setParts((prev) => ({ ...prev, ...patch }));

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding>
      <View style={pickerStyles.headerRow}>
        <Text style={pickerStyles.title}>{mode === "edit" ? "Edit chord" : "Add chord"}</Text>
        <View style={pickerStyles.previewChip}>
          <Text style={pickerStyles.previewText}>{preview || "—"}</Text>
        </View>
      </View>

      <ScrollView style={pickerStyles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {palette.length > 0 ? (
          <>
            <Text style={pickerStyles.sectionLabel}>Recent in this song</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={pickerStyles.paletteRow}
              keyboardShouldPersistTaps="handled"
            >
              {palette.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [pickerStyles.paletteChip, pressed ? appStyles.pressDown : null]}
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
                >
                  <Text style={pickerStyles.paletteChipText}>{item.displayText}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={pickerStyles.sectionLabel}>Root</Text>
        <View style={pickerStyles.rowWrap}>
          {CHORD_ROOTS.map((root) => (
            <Chip key={root} label={root} active={parts.root === root} onPress={() => update({ root })} />
          ))}
        </View>

        <Text style={pickerStyles.sectionLabel}>Accidental</Text>
        <View style={pickerStyles.rowWrap}>
          {ACCIDENTAL_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={(parts.accidental ?? "natural") === opt.value}
              onPress={() => update({ accidental: opt.value })}
            />
          ))}
        </View>

        <Text style={pickerStyles.sectionLabel}>Quality</Text>
        <View style={pickerStyles.rowWrap}>
          {QUALITY_OPTIONS.map((opt) => (
            <Chip
              key={opt.label}
              label={opt.label}
              active={(parts.quality ?? "") === opt.value}
              onPress={() => update({ quality: opt.value })}
            />
          ))}
        </View>

        <Text style={pickerStyles.sectionLabel}>Slash bass</Text>
        <View style={pickerStyles.rowWrap}>
          <Chip label="none" active={!parts.bassRoot} onPress={() => update({ bassRoot: undefined, bassAccidental: undefined })} />
          {CHORD_ROOTS.map((root) => (
            <Chip
              key={`bass-${root}`}
              label={`/${root}`}
              active={parts.bassRoot === root}
              onPress={() => update({ bassRoot: root, bassAccidental: parts.bassAccidental ?? "natural" })}
            />
          ))}
        </View>
        {parts.bassRoot ? (
          <View style={pickerStyles.rowWrap}>
            {ACCIDENTAL_OPTIONS.map((opt) => (
              <Chip
                key={`bassacc-${opt.value}`}
                label={opt.label}
                active={(parts.bassAccidental ?? "natural") === opt.value}
                onPress={() => update({ bassAccidental: opt.value })}
              />
            ))}
          </View>
        ) : null}

        <Text style={pickerStyles.sectionLabel}>Custom suffix</Text>
        <TextInput
          style={pickerStyles.customInput}
          value={parts.customSuffix ?? ""}
          onChangeText={(customSuffix) => update({ customSuffix })}
          placeholder="e.g. #9, no3, *"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </ScrollView>

      <View style={pickerStyles.actions}>
        {mode === "edit" ? (
          <Pressable
            style={({ pressed }) => [pickerStyles.deleteBtn, pressed ? appStyles.pressDown : null]}
            onPress={onDelete}
            hitSlop={6}
          >
            <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            pickerStyles.saveBtn,
            !preview ? pickerStyles.saveBtnDisabled : null,
            pressed && preview ? appStyles.pressDown : null,
          ]}
          onPress={() => onSave(parts)}
          disabled={!preview}
        >
          <Text style={pickerStyles.saveBtnText}>{mode === "edit" ? "Update chord" : "Add chord"}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        pickerStyles.chip,
        active ? pickerStyles.chipActive : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <Text style={[pickerStyles.chipText, active ? pickerStyles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const pickerStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  previewChip: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 56,
    alignItems: "center",
  },
  previewText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.onPrimary,
  },
  scroll: {
    maxHeight: 360,
  },
  sectionLabel: {
    ...textTokens.annotation,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  paletteRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  paletteChip: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  paletteChipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.primary,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    minWidth: 38,
    alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  customInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
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
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: {
    backgroundColor: colors.borderMuted,
  },
  saveBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.onPrimary,
  },
});
