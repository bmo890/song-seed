import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { tokenizeWords, unitIndexByWord } from "../../../cutUp";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";

type Model = ReturnType<typeof useCutUpScreenModel>;

// Two warm tints alternate per unit so adjacent chunks read apart on the mat.
const TINT_A = colors.surface;
const TINT_B = "#F1E7D3";
const BIND_TINT = "#E7C6AE";

type Rect = { x: number; y: number; w: number; h: number };

export function CutUpChunkEditor({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const words = useMemo(() => tokenizeWords(spark.sourceText), [spark.sourceText]);
  const seams = model.currentSeams;
  const units = useMemo(() => unitIndexByWord(words, seams), [words, seams]);
  const unitCount = words.length === 0 ? 0 : units[units.length - 1] + 1;

  // Live "press-and-slide to bind" range (word indices); refs keep the gesture's
  // callbacks off stale closures.
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);
  const wordRects = useRef<Map<number, Rect>>(new Map());
  const scrollY = useRef(0);
  const dragRangeRef = useRef<[number, number] | null>(null);
  const bindRef = useRef(model.bindWords);
  bindRef.current = model.bindWords;
  const wordCountRef = useRef(words.length);
  wordCountRef.current = words.length;

  const findWordAt = (x: number, y: number): number | null => {
    const yy = y + scrollY.current;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const [i, r] of wordRects.current) {
      if (x >= r.x && x <= r.x + r.w && yy >= r.y && yy <= r.y + r.h) return i;
      // Fallback: on the same row, snap to the nearest word horizontally.
      if (yy >= r.y && yy <= r.y + r.h) {
        const dist = Math.min(Math.abs(x - r.x), Math.abs(x - (r.x + r.w)));
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
    }
    return best;
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(180)
        .runOnJS(true)
        .onStart((e) => {
          const w = findWordAt(e.x, e.y);
          if (w == null) return;
          dragRangeRef.current = [w, w];
          setDragRange([w, w]);
          haptic.grab();
        })
        .onUpdate((e) => {
          const start = dragRangeRef.current?.[0];
          if (start == null) return;
          const w = findWordAt(e.x, e.y);
          if (w == null) return;
          const next: [number, number] = [start, w];
          dragRangeRef.current = next;
          setDragRange(next);
        })
        .onEnd(() => {
          const r = dragRangeRef.current;
          if (r && r[0] !== r[1]) {
            bindRef.current(Math.min(r[0], r[1]), Math.max(r[0], r[1]), wordCountRef.current);
            haptic.success();
          }
        })
        .onFinalize(() => {
          dragRangeRef.current = null;
          setDragRange(null);
        }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const inDrag = (i: number) =>
    dragRange != null && i >= Math.min(dragRange[0], dragRange[1]) && i <= Math.max(dragRange[0], dragRange[1]);

  if (words.length === 0) {
    return (
      <View style={styles.body}>
        <Text style={styles.empty}>No words yet — go back and add some source text.</Text>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>
          {unitCount} piece{unitCount === 1 ? "" : "s"}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.resetBtn, pressed ? appStyles.pressDown : null]}
          onPress={model.resetCuts}
          hitSlop={6}
        >
          <Ionicons name="sparkles-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.resetText}>Reset cuts</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Tap a <Ionicons name="cut" size={11} color={colors.primary} /> seam to cut or join · press and slide
        across words to bind them
      </Text>

      <View style={styles.matWrap}>
        <GestureDetector gesture={pan}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.mat}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
          >
            {words.map((word, i) => {
              const tint = units[i] % 2 === 0 ? TINT_A : TINT_B;
              const binding = inDrag(i);
              return (
                <View
                  key={word.index}
                  style={styles.cluster}
                  onLayout={(e) => {
                    const { x, y, width, height } = e.nativeEvent.layout;
                    wordRects.current.set(i, { x, y, w: width, h: height });
                  }}
                >
                  {i > 0 ? <Seam cut={seams.includes(i)} onPress={() => model.toggleSeamAt(i)} /> : null}
                  <View style={[styles.word, { backgroundColor: binding ? BIND_TINT : tint }]}>
                    <Text style={styles.wordText}>{word.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </GestureDetector>
      </View>
    </View>
  );
}

function Seam({ cut, onPress }: { cut: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
      style={[styles.seam, cut ? styles.seamCut : null]}
    >
      {cut ? (
        <Ionicons name="cut" size={12} color={colors.primary} />
      ) : (
        <View style={styles.joinDot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  count: { ...textTokens.annotation },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  resetText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, color: colors.textSecondary },
  hint: { ...textTokens.supporting, fontSize: 11, marginBottom: spacing.sm },
  matWrap: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  scroll: { flex: 1 },
  mat: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "flex-start",
    padding: spacing.sm,
  },
  cluster: { flexDirection: "row", alignItems: "center" },
  seam: {
    minWidth: 12,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 1,
  },
  seamCut: { minWidth: 20 },
  joinDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderMuted,
  },
  word: {
    borderRadius: radii.sm,
    paddingHorizontal: 7,
    paddingVertical: 7,
    marginVertical: 3,
  },
  wordText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    color: colors.textPrimary,
  },
  empty: {
    ...textTokens.supporting,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
});
