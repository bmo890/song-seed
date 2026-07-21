import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserText, UserTextInput } from "../../../i18n";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { BottomSheet } from "../../common/BottomSheet";
import { ChordZoomBar } from "../../LyricsVersionScreen/components/chords/ChordZoomBar";
import type { MagpieFragment, MagpieSpark } from "../../../types";
import type { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useMagpieScreenModel>;

const PAGE_BG = "#FBF6EC";
const BASE_FONT = 18;
const BASE_LINE = 29;

export function MagpieBuildStep({
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
  const [sizeOpen, setSizeOpen] = useState(false);
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

  const draftBlank = spark.draft.trim().length === 0;
  const fontSize = BASE_FONT * zoom;
  const lineHeight = BASE_LINE * zoom;

  // Drop a scrap in at the caret (or append a new line if the caret is at the end
  // of a non-empty line), with smart spacing. Marks the scrap used.
  const insertScrap = (fragment: MagpieFragment) => {
    haptic.light();
    const current = spark.draft;
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
      <Header
        title={spark.title}
        onBack={() => model.goToStep("page")}
        onSize={() => setSizeOpen(true)}
        onHelp={onHelp}
      />

      <View style={styles.draftPage}>
        <UserTextInput
          ref={draftRef}
          style={[styles.draftInput, { fontSize, lineHeight }]}
          value={spark.draft}
          onChangeText={model.setDraft}
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
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed ? appStyles.pressDown : null]}
          onPress={model.saveAsLyrics}
        >
          <Ionicons name="bookmark-outline" size={16} color={colors.onPrimary} />
          <Text style={styles.saveBtnText}>{t("wordSparks.saveLyrics")}</Text>
        </Pressable>
      ) : null}

      <BottomSheet visible={sizeOpen} onClose={() => setSizeOpen(false)}>
        <Text style={styles.sheetLabel}>{t("magpie.textSize")}</Text>
        <ChordZoomBar zoom={zoom} onChange={setZoom} />
      </BottomSheet>

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

// ── Header ────────────────────────────────────────────────────────────────────
function Header({
  title,
  onBack,
  onSize,
  onHelp,
}: {
  title: string;
  onBack: () => void;
  onSize: () => void;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [styles.backBtn, pressed ? appStyles.pressDown : null]}
        onPress={onBack}
        hitSlop={6}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textStrong} />
        <Text style={styles.backText}>{t("wordSparks.page")}</Text>
      </Pressable>
      <View style={styles.titleCol}>
        <Text style={styles.titleOver}>{t("magpie.yourDraft")}</Text>
        <UserText style={styles.titleText} numberOfLines={1}>
          {title}
        </UserText>
      </View>
      <Pressable style={({ pressed }) => [styles.iconBtn, pressed ? appStyles.pressDown : null]} onPress={onSize} hitSlop={6} accessibilityLabel={t("magpie.textSize")}>
        <Text style={styles.iconBtnText}>Aa</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.iconBtn, pressed ? appStyles.pressDown : null]} onPress={onHelp} hitSlop={6} accessibilityLabel="How this works">
        <Ionicons name="help-circle-outline" size={20} color={colors.textStrong} />
      </Pressable>
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
    <Pressable
      style={({ pressed }) => [styles.chip, isUsed ? styles.chipUsed : null, pressed ? appStyles.pressDown : null]}
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
    </Pressable>
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
}: {
  scraps: MagpieFragment[];
  used: Set<string>;
  count: number;
  showPour: boolean;
  onInsert: (fragment: MagpieFragment) => void;
  onLongPress: (fragment: MagpieFragment) => void;
  onExpand: () => void;
  onPour: () => void;
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
        {showPour ? (
          <Pressable style={({ pressed }) => [styles.pourBtn, pressed ? appStyles.pressDown : null]} onPress={onPour}>
            <Ionicons name="arrow-down" size={13} color={colors.onPrimary} />
            <Text style={styles.pourText}>{t("magpie.pourInOrder")}</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [styles.expandBtn, pressed ? appStyles.pressDown : null]} onPress={onExpand} hitSlop={6}>
            <Ionicons name="grid-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.expandText}>{t("magpie.seeAll")}</Text>
          </Pressable>
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
      <Text style={styles.paletteTip}>{t("magpie.scrapTip")}</Text>
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
    <Pressable style={({ pressed }) => [styles.menuRow, pressed ? appStyles.pressDown : null]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.textStrong} />
      <Text style={[styles.menuRowText, danger ? styles.menuRowDanger : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingBottom: spacing.sm },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 6, paddingRight: 4 },
  backText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: colors.textStrong },
  titleCol: { flex: 1, minWidth: 0, alignItems: "center" },
  titleOver: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted },
  titleText: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 14, color: colors.textPrimary, marginTop: 1 },
  iconBtn: { minWidth: 34, height: 34, borderRadius: radii.round, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  iconBtnText: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 16, color: colors.textStrong },

  draftPage: { flex: 1, backgroundColor: PAGE_BG, borderRadius: radii.xl, padding: spacing.lg, ...shadows.card },
  draftInput: { flex: 1, fontFamily: "PlayfairDisplay_400Regular", color: colors.textStrong },

  palette: { paddingTop: spacing.md },
  paletteEmpty: { fontFamily: "PlayfairDisplay_400Regular", fontStyle: "italic", fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.md },
  paletteHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  paletteLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: colors.textMuted },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, borderRadius: radii.round, paddingHorizontal: spacing.md, paddingVertical: 5, ...shadows.control },
  expandText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 11, color: colors.textSecondary },
  pourBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primaryDeep, borderRadius: radii.round, paddingHorizontal: spacing.md, paddingVertical: 6 },
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
  chipText: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 14, color: colors.textStrong, flexShrink: 1 },
  paletteTip: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.round,
    paddingVertical: 15,
    marginTop: spacing.md,
  },
  saveBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },

  sheetLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, marginBottom: spacing.md },
  gridScroll: { maxHeight: 320 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },

  menuInput: {
    fontFamily: "PlayfairDisplay_400Regular",
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
