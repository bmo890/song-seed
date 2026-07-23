import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { UserText, UserTextInput } from "../../../i18n";
import { Gesture, GestureDetector, ScrollView as GHScrollView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { BottomSheet } from "../../common/BottomSheet";
import { boardItemText } from "../../../domain/cutUp";
import { detectTextDirection } from "../../../i18n/direction";
import { CutSeamRow } from "./CutUpChunkEditor";
import { useSparkTextScale } from "../../common/sparkTextScale";
import type { CutUpBoardItem, CutUpChunk, CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

const SCRAP_BG = "#FCF8F0";
// Breathing room inside a ruled band above/below a scrap.
const RULE_INSET = 5;
// Empty rules kept below the lowest scrap so there's always table to drop onto.
const HEADROOM_BANDS = 6;

/**
 * The Arrange step as a table: a faintly ruled page of free-floating scraps.
 * Hold a scrap and put it down anywhere — it settles onto the nearest rule,
 * keeping the exact x where it was dropped. No slots, no insertion logic: the
 * scrap you're holding is its own preview, and the target rule glows softly.
 * Scraps sharing a rule read as one draft line; an empty rule between scraps
 * becomes a blank line. What's on the table IS the draft.
 */
export function CutUpBoard({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const { t } = useTranslation();
  const { size, lineHeight } = useSparkTextScale();
  const [sheetItem, setSheetItem] = useState<CutUpBoardItem | null>(null);
  const [splitItem, setSplitItem] = useState<CutUpBoardItem | null>(null);

  // Band geometry follows the text zoom so scraps always fit their rule.
  const scrapH = lineHeight + 14; // text + vertical padding
  const bandH = scrapH + RULE_INSET * 2;

  const active = useMemo(() => spark.boardItems.filter((it) => !it.removed), [spark.boardItems]);
  const removed = useMemo(() => spark.boardItems.filter((it) => it.removed), [spark.boardItems]);
  const textById = useCallback(
    (id: string) => {
      const item = spark.boardItems.find((it) => it.id === id);
      return item ? boardItemText(item, spark.chunks) : "";
    },
    [spark.boardItems, spark.chunks]
  );

  const maxBand = useMemo(
    () => active.reduce((max, it) => Math.max(max, typeof it.y === "number" ? it.y : 0), 0),
    [active]
  );
  const bandCount = Math.max(maxBand + 1 + HEADROOM_BANDS, 10);
  const canvasH = bandCount * bandH;

  const [canvasW, setCanvasW] = useState(0);
  const canvasWShared = useSharedValue(0);
  const bandCountShared = useSharedValue(bandCount);
  useEffect(() => {
    bandCountShared.value = bandCount;
  }, [bandCount, bandCountShared]);

  // Measured scrap sizes, for clamping drops to the table's edge.
  const sizesRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const sharedSizes = useSharedValue<Record<string, { w: number; h: number }>>({});
  const onScrapSize = useCallback(
    (id: string, e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      sizesRef.current.set(id, { w: width, h: height });
      sharedSizes.value = Object.fromEntries(sizesRef.current);
    },
    [sharedSizes]
  );

  // ── Drag: base + pan translation, drop = snap to the nearest rule ──────────
  // The scrap's pan blocks THIS scroll view, so a swipe that starts on a scrap
  // drags it immediately (no long-press); a swipe on the empty page still
  // scrolls. A plain tap opens the edit sheet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const cloneBaseX = useSharedValue(0);
  const cloneBaseY = useSharedValue(0);
  const cloneX = useSharedValue(0);
  const cloneY = useSharedValue(0);
  const cloneW = useSharedValue(0);
  const cloneH = useSharedValue(0);
  const dragActive = useSharedValue(false);
  const targetBand = useSharedValue(-1);

  const beginDrag = useCallback((id: string) => {
    haptic.grab();
    dragIdRef.current = id;
    setDragId(id);
  }, []);

  const commitDrop = useCallback(
    (x: number, band: number) => {
      const id = dragIdRef.current;
      dragIdRef.current = null;
      setDragId(null);
      if (!id || band < 0) return;
      haptic.tap();
      model.moveScrap(id, x, band);
    },
    [model]
  );

  const cancelDrag = useCallback(() => {
    dragIdRef.current = null;
    setDragId(null);
  }, []);

  const openSheetFor = useCallback(
    (id: string) => {
      const item = spark.boardItems.find((it) => it.id === id);
      if (item) {
        haptic.tap();
        setSheetItem(item);
      }
    },
    [spark.boardItems]
  );

  const makeGesture = useCallback(
    (id: string, x: number, band: number) => {
      const pan = Gesture.Pan()
        // Immediate: no long-press. Once this pan wins, it blocks the scroll,
        // so dragging a scrap never scrolls the page.
        .blocksExternalGesture(scrollRef)
        .onStart((e) => {
          const sizes = sharedSizes.value[id];
          const w = sizes ? sizes.w : 80;
          const h = sizes ? sizes.h : 40;
          cloneW.value = w;
          cloneH.value = h;
          cloneBaseX.value = x;
          // The scrap lifts in place and rides 1:1 with the thumb.
          cloneBaseY.value = band * bandH + RULE_INSET;
          void h;
          cloneX.value = cloneBaseX.value;
          cloneY.value = cloneBaseY.value;
          dragActive.value = true;
          targetBand.value = band;
          runOnJS(beginDrag)(id);
        })
        .onUpdate((e) => {
          cloneX.value = cloneBaseX.value + e.translationX;
          cloneY.value = cloneBaseY.value + e.translationY;
          const centerY = cloneY.value + cloneH.value / 2;
          const band2 = Math.round((centerY - bandH / 2) / bandH);
          targetBand.value = Math.max(0, Math.min(bandCountShared.value - 1, band2));
        })
        .onEnd(() => {
          dragActive.value = false;
          const maxX = Math.max(0, canvasWShared.value - cloneW.value);
          const x2 = Math.max(0, Math.min(maxX, cloneX.value));
          const band2 = targetBand.value;
          targetBand.value = -1;
          runOnJS(commitDrop)(Math.round(x2), band2);
        })
        .onFinalize((_e, success) => {
          if (!success) {
            dragActive.value = false;
            targetBand.value = -1;
            runOnJS(cancelDrag)();
          }
        });

      // A quick tap (no drag) opens the edit sheet.
      const tap = Gesture.Tap()
        .maxDuration(260)
        .onEnd((_e, success) => {
          if (success) runOnJS(openSheetFor)(id);
        });

      return Gesture.Race(pan, tap);
    },
    [bandH, sharedSizes, canvasWShared, bandCountShared, cloneW, cloneH, cloneX, cloneY, cloneBaseX, cloneBaseY, dragActive, targetBand, beginDrag, commitDrop, cancelDrag, openSheetFor]
  );

  const cloneStyle = useAnimatedStyle(() => ({
    opacity: dragActive.value ? 0.95 : 0,
    transform: [{ translateX: cloneX.value }, { translateY: cloneY.value }, { scale: 1.04 }],
  }));
  const bandGlowStyle = useAnimatedStyle(() => ({
    opacity: targetBand.value >= 0 && dragActive.value ? 1 : 0,
    transform: [{ translateY: targetBand.value * bandH }],
  }));

  const dragText = dragId ? textById(dragId) : "";

  const measuredWidths = useCallback(
    () => Object.fromEntries([...sizesRef.current].map(([id, s2]) => [id, s2.w])),
    []
  );

  return (
    <View style={styles.body}>
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, styles.controlPrimary, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.light();
            model.shuffle(measuredWidths(), canvasW);
          }}
          hitSlop={6}
        >
          <Ionicons name="shuffle" size={15} color={colors.onPrimary} />
          <Text style={styles.controlTextPrimary}>{t("cutUp.shuffle")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            model.resetOrder(measuredWidths(), canvasW);
          }}
          hitSlop={6}
        >
          <Ionicons name="swap-vertical-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.controlText}>{t("cutUp.sourceOrder")}</Text>
        </Pressable>
        <View style={styles.controlsSpacer} />
        <Pressable
          style={({ pressed }) => [styles.historyBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            model.poolAll();
          }}
          disabled={model.activeCount === 0}
          hitSlop={6}
          accessibilityLabel={t("cutUp.poolAll")}
        >
          <Ionicons name="albums-outline" size={17} color={model.activeCount > 0 ? colors.textStrong : colors.borderMuted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.historyBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            model.undoBoard();
          }}
          disabled={!model.canUndoBoard}
          hitSlop={6}
          accessibilityLabel={t("wordSparks.undo")}
        >
          <Ionicons name="arrow-undo-outline" size={17} color={model.canUndoBoard ? colors.textStrong : colors.borderMuted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.historyBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            model.redoBoard();
          }}
          disabled={!model.canRedoBoard}
          hitSlop={6}
          accessibilityLabel={t("wordSparks.redo")}
        >
          <Ionicons name="arrow-redo-outline" size={17} color={model.canRedoBoard ? colors.textStrong : colors.borderMuted} />
        </Pressable>
      </View>

      <Text style={styles.hint}>{t("cutUp.tableReassure")}</Text>

      <GHScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={dragId === null}
      >
        {active.length === 0 ? (
          <Text style={styles.empty}>{t("cutUp.boardEmpty")}</Text>
        ) : (
          <View
            style={[styles.canvas, { height: canvasH }]}
            collapsable={false}
            onLayout={(e) => {
              setCanvasW(e.nativeEvent.layout.width);
              canvasWShared.value = e.nativeEvent.layout.width;
            }}
          >
            {/* The page's ruling */}
            {Array.from({ length: bandCount }, (_, i) => (
              <View key={i} pointerEvents="none" style={[styles.rule, { top: (i + 1) * bandH - 1 }]} />
            ))}

            {/* The rule the held scrap will settle onto */}
            <Animated.View pointerEvents="none" style={[styles.bandGlow, { height: bandH }, bandGlowStyle]} />

            {active.map((item) => {
              const band = typeof item.y === "number" ? item.y : 0;
              const x = typeof item.x === "number" ? item.x : 0;
              return (
                <Scrap
                  key={item.id}
                  text={textById(item.id)}
                  locked={item.locked === true}
                  fontSize={size}
                  lineHeight={lineHeight}
                  left={x}
                  top={band * bandH + RULE_INSET}
                  maxWidth={canvasW > 0 ? canvasW - Math.min(x, canvasW * 0.6) : undefined}
                  dimmed={dragId === item.id}
                  gesture={makeGesture(item.id, x, band)}
                  onSize={(e) => onScrapSize(item.id, e)}
                />
              );
            })}

            {/* The floating scrap that follows the finger */}
            <Animated.View pointerEvents="none" style={[styles.clone, cloneStyle]}>
              {dragId ? (
                <View style={[styles.scrap, styles.scrapClone]}>
                  <UserText style={[styles.scrapText, { fontSize: size, lineHeight }]}>{dragText}</UserText>
                </View>
              ) : null}
            </Animated.View>
          </View>
        )}
      </GHScrollView>

      {removed.length > 0 ? (
        <View style={styles.removedSection}>
          <View style={styles.removedHeader}>
            <Text style={styles.removedLabel}>{t("cutUp.setAside", { count: removed.length })}</Text>
            <Pressable
              style={({ pressed }) => [styles.bringAllBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                model.restoreAll();
              }}
              hitSlop={6}
            >
              <Ionicons name="arrow-up-outline" size={13} color={colors.primaryDeep} />
              <Text style={styles.bringAllText}>{t("cutUp.bringAllUp")}</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.removedScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.removedWrap}>
              {removed.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.removedChip, pressed ? appStyles.pressDown : null]}
                  onPress={() => {
                    haptic.tap();
                    model.restoreStrip(item.id);
                  }}
                >
                  <Ionicons name="arrow-undo-outline" size={12} color={colors.textSecondary} />
                  <UserText style={styles.removedChipText} numberOfLines={1}>
                    {boardItemText(item, spark.chunks)}
                  </UserText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <StripSheet
        item={sheetItem}
        chunks={spark.chunks}
        onClose={() => setSheetItem(null)}
        onSplit={(item) => {
          setSheetItem(null);
          setSplitItem(item);
        }}
        model={model}
      />

      <StripSplitSheet
        item={splitItem}
        chunks={spark.chunks}
        onClose={() => setSplitItem(null)}
        onApply={(itemId, texts) => {
          model.splitStrip(itemId, texts);
          setSplitItem(null);
        }}
      />
    </View>
  );
}

const Scrap = memo(function Scrap({
  text,
  locked,
  fontSize,
  lineHeight,
  left,
  top,
  maxWidth,
  dimmed,
  gesture,
  onSize,
}: {
  text: string;
  locked: boolean;
  fontSize: number;
  lineHeight: number;
  left: number;
  top: number;
  maxWidth?: number;
  dimmed: boolean;
  gesture: ReturnType<typeof Gesture.Race>;
  onSize: (e: LayoutChangeEvent) => void;
}) {
  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={onSize}
        style={[
          styles.scrap,
          styles.scrapPlaced,
          { left, top },
          maxWidth !== undefined ? { maxWidth } : null,
          locked ? styles.scrapLocked : null,
          dimmed ? styles.scrapDimmed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={text}
      >
        {locked ? <Ionicons name="lock-closed" size={11} color={colors.primaryDeep} style={styles.scrapLockIcon} /> : null}
        <UserText style={[styles.scrapText, { fontSize, lineHeight }]} numberOfLines={1}>
          {text}
        </UserText>
      </View>
    </GestureDetector>
  );
});

/** Tap a scrap → edit it in place, plus its actions. */
function StripSheet({
  item,
  chunks,
  onClose,
  onSplit,
  model,
}: {
  item: CutUpBoardItem | null;
  chunks: CutUpChunk[];
  onClose: () => void;
  onSplit: (item: CutUpBoardItem) => void;
  model: Model;
}) {
  const { t } = useTranslation();
  const { size, lineHeight } = useSparkTextScale();
  const text = item ? boardItemText(item, chunks) : "";
  const canSplit = text.trim().split(/\s+/).length > 1;
  return (
    <BottomSheet visible={item !== null} onClose={onClose} keyboardAvoiding>
      {item ? (
        <>
          <View style={styles.sheetInputWrap}>
            <UserTextInput
              style={[styles.sheetInput, { fontSize: size, lineHeight }]}
              value={text}
              onChangeText={(next) => model.editStripText(item.id, next)}
              multiline
              scrollEnabled={false}
            />
          </View>
          <View style={styles.menuList}>
            {canSplit ? (
              <MenuRow
                icon="cut-outline"
                label={t("cutUp.cutStrip")}
                onPress={() => {
                  haptic.light();
                  onSplit(item);
                }}
              />
            ) : null}
            <MenuRow
              icon={item.locked ? "lock-open-outline" : "lock-closed-outline"}
              label={item.locked ? t("cutUp.unlock") : t("cutUp.lock")}
              onPress={() => {
                haptic.light();
                model.toggleStripLock(item.id);
              }}
            />
            <MenuRow
              icon="copy-outline"
              label={t("cutUp.duplicate")}
              onPress={() => {
                haptic.light();
                model.duplicateStrip(item.id);
              }}
            />
            <MenuRow
              icon="archive-outline"
              label={t("cutUp.removeStrip")}
              danger
              onPress={() => {
                model.removeStrip(item.id);
                onClose();
              }}
            />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

function StripSplitSheet({
  item,
  chunks,
  onClose,
  onApply,
}: {
  item: CutUpBoardItem | null;
  chunks: CutUpChunk[];
  onClose: () => void;
  onApply: (itemId: string, texts: string[]) => void;
}) {
  const { t } = useTranslation();
  const { size } = useSparkTextScale();
  const text = item ? boardItemText(item, chunks) : "";
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const rtl = detectTextDirection(text) === "rtl";
  const [cuts, setCuts] = useState<Set<number>>(new Set());

  useEffect(() => {
    setCuts(new Set());
  }, [item?.id]);

  const toggleCut = (seam: number) => {
    haptic.light();
    setCuts((prev) => {
      const next = new Set(prev);
      if (next.has(seam)) next.delete(seam);
      else next.add(seam);
      return next;
    });
  };

  const apply = () => {
    if (!item || cuts.size === 0) return;
    haptic.tap();
    const bounds = [0, ...[...cuts].sort((a, b) => a - b), words.length];
    const texts: string[] = [];
    for (let i = 0; i < bounds.length - 1; i++) texts.push(words.slice(bounds[i], bounds[i + 1]).join(" "));
    onApply(item.id, texts);
  };

  return (
    <BottomSheet visible={item !== null} onClose={onClose}>
      {item ? (
        <>
          <Text style={styles.splitTitle}>{t("cutUp.cutStrip")}</Text>
          <Text style={styles.splitHint}>{t("cutUp.cutStripHint")}</Text>
          <View style={styles.splitPaper}>
            <CutSeamRow words={words} isCut={(seam) => cuts.has(seam)} onToggle={toggleCut} rtl={rtl} size={size} />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.splitCta,
              cuts.size === 0 ? styles.splitCtaDisabled : null,
              pressed && cuts.size > 0 ? appStyles.pressDown : null,
            ]}
            onPress={apply}
            disabled={cuts.size === 0}
          >
            <Ionicons name="cut-outline" size={15} color={cuts.size > 0 ? colors.onPrimary : colors.textSecondary} />
            <Text style={[styles.splitCtaText, cuts.size === 0 ? styles.splitCtaTextDisabled : null]}>
              {t("cutUp.cutInto", { count: cuts.size + 1 })}
            </Text>
          </Pressable>
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
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  controlPrimary: { backgroundColor: colors.primaryDeep },
  controlsSpacer: { flex: 1 },
  historyBtn: { width: 32, height: 32, borderRadius: radii.round, alignItems: "center", justifyContent: "center" },
  controlText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12, color: colors.textSecondary },
  controlTextPrimary: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12, color: colors.onPrimary },
  hint: { ...textTokens.supporting, fontSize: 11.5, marginBottom: spacing.xs },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  empty: { ...textTokens.supporting, fontSize: 13, textAlign: "center", paddingVertical: spacing.xl },

  canvas: { position: "relative" },
  rule: {
    position: "absolute",
    left: 2,
    right: 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    opacity: 0.45,
  },
  bandGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(184, 125, 107, 0.08)",
    borderRadius: radii.sm,
  },

  scrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SCRAP_BG,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    ...shadows.card,
  },
  scrapPlaced: { position: "absolute" },
  scrapLocked: { backgroundColor: colors.surfaceHigh },
  scrapDimmed: { opacity: 0.3 },
  scrapLockIcon: { marginEnd: 5 },
  scrapText: { fontFamily: "PlayfairDisplay_400Regular", color: colors.textPrimary, flexShrink: 1 },

  clone: { position: "absolute", left: 0, top: 0 },
  scrapClone: { ...shadows.drawer, backgroundColor: colors.surface },

  removedSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted },
  removedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  removedLabel: { ...textTokens.annotation },
  bringAllBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.round, backgroundColor: colors.surfaceHigh },
  bringAllText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 11.5, color: colors.primaryDeep },
  removedScroll: { maxHeight: 88 },
  removedWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  removedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  removedChipText: { fontFamily: "PlusJakartaSans_500Medium", fontSize: 12, color: colors.textSecondary, flexShrink: 1 },

  sheetInputWrap: {
    backgroundColor: SCRAP_BG,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetInput: { fontFamily: "PlayfairDisplay_400Regular", color: colors.textPrimary, padding: 0 },
  menuList: {},
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  menuRowText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14.5, color: colors.textPrimary },
  menuRowDanger: { color: colors.danger },

  splitTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 19, color: colors.textPrimary, marginBottom: 4 },
  splitHint: { ...textTokens.supporting, marginBottom: spacing.md },
  splitPaper: { backgroundColor: SCRAP_BG, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.card },
  splitCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.round,
    paddingVertical: 12,
  },
  splitCtaDisabled: { backgroundColor: colors.surfaceHigh },
  splitCtaText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },
  splitCtaTextDisabled: { color: colors.textMuted },
});
