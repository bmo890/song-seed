import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView, StyleSheet, Text, type TextInput, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { UserText, UserTextInput } from "../../../i18n";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { BottomSheet } from "../../common/BottomSheet";
import type { MagpieFragment, MagpieSpark } from "../../../types";
import type { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { useTranslation } from "react-i18next";
import { useSparkTextScale } from "../../common/sparkTextScale";
import { SparkFooter } from "../../common/SparkFrame";
import { UndoRedoButtons } from "../../common/useUndoHistory";

type Model = ReturnType<typeof useMagpieScreenModel>;

// The writing sheet is a card on the app paper (2026-10-17, paper A).
const PAGE_BG = colors.surface;
const BASE_FONT = 18;
const BASE_LINE = 29;

export function MagpieBuildStep({
  model,
  spark,
}: {
  model: Model;
  spark: MagpieSpark;
}) {
  const { t } = useTranslation();
  const { zoom } = useSparkTextScale();
  const [expanded, setExpanded] = useState(false);
  const [menuFragmentId, setMenuFragmentId] = useState<string | null>(null);
  // Derive the menu's fragment live from the store so inline edits/merges show.
  const menuFragment = menuFragmentId ? spark.fragments.find((f) => f.id === menuFragmentId) ?? null : null;
  // Track the caret in a ref (no re-render); only control `selection` for one
  // frame right after a programmatic insert, then release it (avoids Android
  // caret-jumping from permanently-controlled selection).
  const caretRef = useRef({ start: 0, end: 0 });
  const [pendingSel, setPendingSel] = useState<{ start: number; end: number } | undefined>(undefined);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const draftRef = useRef<TextInput>(null);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const used = useMemo(() => new Set(spark.usedFragmentIds), [spark.usedFragmentIds]);

  // Unused scraps lead; used ones drift to the end. Order preserved within each.
  const orderedScraps = useMemo(() => {
    const byOrder = [...spark.fragments].sort((a, b) => a.order - b.order);
    return [...byOrder.filter((f) => !used.has(f.id)), ...byOrder.filter((f) => used.has(f.id))];
  }, [spark.fragments, used]);

  const draftText = model.draftField.draft;
  const draftBlank = draftText.trim().length === 0;
  const fontSize = BASE_FONT * zoom;
  const lineHeight = BASE_LINE * zoom;

  // Drop a scrap in at the caret (or append a new line if the caret is at the end
  // of a non-empty line), with smart spacing. Marks the scrap used.
  const insertScrap = (fragment: MagpieFragment) => {
    haptic.light();
    const current = draftText;
    const pos = Math.min(caretRef.current.start, current.length);
    const before = current.slice(0, pos);
    const after = current.slice(pos);
    const lead = before.length > 0 && !/\s$/.test(before) ? " " : "";
    const trail = after.length > 0 && !/^\s/.test(after) ? " " : "";
    const next = before + lead + fragment.text + trail + after;
    model.setDraft(next);
    model.markFragmentUsed(fragment.id);
    // Leave the caret just after the inserted word (before any trailing space).
    const caret = pos + lead.length + fragment.text.length;
    caretRef.current = { start: caret, end: caret };
    setPendingSel({ start: caret, end: caret });
  };

  return (
    <View style={styles.body}>
      <View style={styles.draftPage}>
        <UserTextInput
          ref={draftRef}
          style={[styles.draftInput, { fontSize, lineHeight }]}
          value={draftText}
          onChangeText={model.draftField.onChangeText}
          onBlur={model.draftField.flush}
          selection={pendingSel}
          onSelectionChange={(e) => {
            caretRef.current = e.nativeEvent.selection;
            if (pendingSel) setPendingSel(undefined);
          }}
          multiline
          textAlignVertical="top"
          placeholder={t("magpie.draftPlaceholder")}
          placeholderTextColor={colors.textMuted}
          scrollEnabled
        />
      </View>

      <Palette
        scraps={orderedScraps}
        used={used}
        history={model.fragmentHistory}
        count={spark.fragments.length}
        showPour={draftBlank && spark.fragments.length > 0}
        onInsert={insertScrap}
        onLongPress={(fragment) => {
          haptic.grab();
          setMenuFragmentId(fragment.id);
        }}
        onExpand={() => setExpanded(true)}
        onPour={() => {
          haptic.success();
          model.pourScraps();
        }}
      />

      {!keyboardVisible ? (
        <SparkFooter
          back={{ label: t("wordSparks.page"), onPress: () => model.goToStep("page") }}
          next={{ label: t("common.save"), onPress: model.saveAsLyrics, final: true }}
        />
      ) : null}


      <ExpandedPalette
        visible={expanded}
        onClose={() => setExpanded(false)}
        scraps={orderedScraps}
        used={used}
        onInsert={insertScrap}
        onLongPress={(fragment) => {
          haptic.grab();
          setMenuFragmentId(fragment.id);
        }}
      />

      <ScrapMenu
        fragment={menuFragment}
        used={menuFragment ? used.has(menuFragment.id) : false}
        onClose={() => setMenuFragmentId(null)}
        model={model}
      />
    </View>
  );
}

// ── Palette ───────────────────────────────────────────────────────────────────
const Chip = memo(function Chip({
  fragment,
  isUsed,
  onInsert,
  onLongPress,
}: {
  fragment: MagpieFragment;
  isUsed: boolean;
  onInsert: (fragment: MagpieFragment) => void;
  onLongPress: (fragment: MagpieFragment) => void;
}) {
  return (
    <Press
      haptic="none"
      style={[styles.chip, isUsed ? styles.chipUsed : null]}
      onPress={() => onInsert(fragment)}
      onLongPress={() => onLongPress(fragment)}
      delayLongPress={230}
    >
      {isUsed ? (
        <Ionicons name="checkmark" size={13} color={colors.primaryDeep} />
      ) : null}
      <UserText style={styles.chipText} numberOfLines={1}>
        {fragment.text}
      </UserText>
    </Press>
  );
});

function Palette({
  scraps,
  used,
  count,
  showPour,
  onInsert,
  onLongPress,
  onExpand,
  onPour,
  history,
}: {
  scraps: MagpieFragment[];
  used: Set<string>;
  count: number;
  showPour: boolean;
  onInsert: (fragment: MagpieFragment) => void;
  onLongPress: (fragment: MagpieFragment) => void;
  onExpand: () => void;
  onPour: () => void;
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };
}) {
  const { t } = useTranslation();
  if (count === 0) {
    return (
      <View style={styles.palette}>
        <Text style={styles.paletteEmpty}>{t("magpie.noWords")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.palette}>
      <View style={styles.paletteHead}>
        <Text style={styles.paletteLabel}>{t("magpie.yourScraps", { count })}</Text>
        <UndoRedoButtons canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
        {showPour ? (
          <Press haptic="none" style={styles.pourBtn} onPress={onPour}>
            <Ionicons name="arrow-down" size={13} color={colors.onPrimary} />
            <Text style={styles.pourText}>{t("magpie.pourInOrder")}</Text>
          </Press>
        ) : (
          <Press haptic="none" style={styles.expandBtn} onPress={onExpand} hitSlop={6}>
            <Ionicons name="grid-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.expandText}>{t("magpie.seeAll")}</Text>
          </Press>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.stripContent}
      >
        {scraps.map((fragment) => (
          <Chip
            key={fragment.id}
            fragment={fragment}
            isUsed={used.has(fragment.id)}
            onInsert={onInsert}
            onLongPress={onLongPress}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ExpandedPalette({
  visible,
  onClose,
  scraps,
  used,
  onInsert,
  onLongPress,
}: {
  visible: boolean;
  onClose: () => void;
  scraps: MagpieFragment[];
  used: Set<string>;
  onInsert: (fragment: MagpieFragment) => void;
  onLongPress: (fragment: MagpieFragment) => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetLabel}>{t("magpie.yourScraps", { count: scraps.length })}</Text>
      <ScrollView style={styles.gridScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.grid}>
          {scraps.map((fragment) => (
            <Chip
              key={fragment.id}
              fragment={fragment}
              isUsed={used.has(fragment.id)}
              onInsert={onInsert}
              onLongPress={onLongPress}
            />
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// ── Scrap menu (long-press) ───────────────────────────────────────────────────
function ScrapMenu({
  fragment,
  used,
  onClose,
  model,
}: {
  fragment: MagpieFragment | null;
  used: boolean;
  onClose: () => void;
  model: Model;
}) {
  const { t } = useTranslation();
  const isMultiWord = fragment ? fragment.text.trim().split(/\s+/).length > 1 : false;
  return (
    <BottomSheet visible={fragment !== null} onClose={onClose} keyboardAvoiding>
      {fragment ? (
        <>
          <Text style={styles.sheetLabel}>{t("magpie.editScrap")}</Text>
          <UserTextInput
            style={styles.menuInput}
            value={fragment.text}
            onChangeText={(text) => model.editFragment(fragment.id, text)}
            multiline
          />
          {fragment.text.trim() !== fragment.originalText.trim() ? (
            <UserText style={styles.editedNote} value={fragment.originalText} numberOfLines={1}>
              {t("magpie.editedFrom", { text: fragment.originalText })}
            </UserText>
          ) : null}

          <View style={styles.menuList}>
            {isMultiWord ? (
              <MenuRow icon="cut-outline" label={t("magpie.splitWords")} onPress={() => { model.splitFragment(fragment.id); onClose(); }} />
            ) : null}
            <MenuRow icon="git-merge-outline" label={t("magpie.merge")} onPress={() => model.mergeFragment(fragment.id)} />
            <MenuRow
              icon={used ? "ellipse-outline" : "checkmark-circle-outline"}
              label={used ? t("magpie.markUnused") : t("magpie.markUsed")}
              onPress={() => (used ? model.clearFragmentUsed(fragment.id) : model.markFragmentUsed(fragment.id))}
            />
            <MenuRow icon="trash-outline" label={t("magpie.remove")} danger onPress={() => { model.removeFragment(fragment.id); onClose(); }} />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

function MenuRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Press haptic="none" style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.textStrong} />
      <Text style={[styles.menuRowText, danger ? styles.menuRowDanger : null]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  sheetLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, marginBottom: spacing.md },
  body: { flex: 1 },


  draftPage: { flex: 1, backgroundColor: PAGE_BG, borderRadius: radii.xl, padding: spacing.lg, ...shadows.card },
  draftInput: { flex: 1, fontFamily: "Lora_500Medium", color: colors.textStrong },

  palette: { paddingTop: spacing.md },
  paletteEmpty: { fontFamily: "Lora_500Medium", fontStyle: "italic", fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.md },
  paletteHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  paletteLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: colors.textMuted },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 5, ...shadows.control },
  expandText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 11, color: colors.textSecondary },
  pourBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primaryDeep, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 6 },
  pourText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 11, color: colors.onPrimary },
  stripContent: { gap: spacing.xs, alignItems: "center", paddingRight: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 200,
    backgroundColor: colors.surface,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    ...shadows.control,
  },
  chipUsed: { opacity: 0.55 },
  chipText: { fontFamily: "Lora_500Medium", fontSize: 14, color: colors.textStrong, flexShrink: 1 },


  gridScroll: { maxHeight: 320 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },

  menuInput: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  editedNote: { fontFamily: "PlusJakartaSans_400Regular", fontStyle: "italic", fontSize: 11, color: colors.textMuted, marginTop: 6 },
  menuList: { marginTop: spacing.md },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  menuRowText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14.5, color: colors.textPrimary },
  menuRowDanger: { color: colors.danger },
});
