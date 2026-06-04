import { useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import { FlatList, Text, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  type SharedValue,
} from "react-native-reanimated";
import { styles } from "../styles";
import { type TimelineClipEntry } from "../../../clipGraph";

type ShellRow<T> =
  | { kind: "summary-section" }
  | { kind: "empty" }
  | { kind: "content"; item: T; index: number };

type SongClipListShellProps<T> = {
  contentRows: T[];
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  emptyLabel: string;
  /** Shared scroll offset driven on the UI thread; powers the collapsing header. */
  scrollY?: SharedValue<number>;
  /** Top inset reserving space for the absolute collapsing header overlay. */
  contentPaddingTop?: number;
  /** When set (with a fresh nonce), scroll the content row at `index` into view. */
  scrollTarget?: { index: number; nonce: number } | null;
  contentKeyExtractor: (item: T, index: number) => string;
  renderContentRow: (item: T, index: number) => ReactElement | null;
};

// Animated.FlatList retains the runtime FlatList behavior; cast keeps generic
// prop/ref typing usable in JSX.
const AnimatedFlatList = Animated.FlatList as unknown as typeof FlatList;

export function SongClipListShell<T>({
  contentRows,
  summaryContent,
  footerSpacerHeight,
  emptyLabel,
  scrollY,
  contentPaddingTop,
  scrollTarget,
  contentKeyExtractor,
  renderContentRow,
}: SongClipListShellProps<T>) {
  const listRows = useMemo<ShellRow<T>[]>(() => {
    const rows: ShellRow<T>[] = [];
    if (summaryContent) rows.push({ kind: "summary-section" });
    if (contentRows.length === 0) {
      rows.push({ kind: "empty" });
      return rows;
    }
    rows.push(...contentRows.map((item, index) => ({ kind: "content" as const, item, index })));
    return rows;
  }, [contentRows, summaryContent]);

  // Number of non-content rows before the first content row.
  const leadingRowCount = useMemo(() => (summaryContent ? 1 : 0), [summaryContent]);

  const listRef = useRef<FlatList<ShellRow<T>>>(null);

  // Reset the shared scroll offset whenever this list instance mounts (e.g. when
  // switching between Timeline and Evolution views, which swaps the list). The
  // fresh list starts at offset 0, so the header must start fully expanded.
  useEffect(() => {
    if (scrollY) scrollY.value = 0;
    return () => {
      if (scrollY) scrollY.value = 0;
    };
  }, [scrollY]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (scrollY) scrollY.value = event.contentOffset.y;
    },
  });

  // Scroll the targeted content row into view when a fresh locate request arrives.
  useEffect(() => {
    if (!scrollTarget) return;
    if (scrollTarget.index < 0 || scrollTarget.index >= contentRows.length) return;
    const rowIndex = leadingRowCount + scrollTarget.index;
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: rowIndex, animated: true, viewPosition: 0.3 });
    }, 60);
    return () => clearTimeout(id);
  }, [scrollTarget?.nonce, contentRows.length, leadingRowCount]);

  return (
    <AnimatedFlatList
      ref={listRef}
      data={listRows}
      onScrollToIndexFailed={(info) => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: info.index,
            animated: true,
            viewPosition: 0.3,
          });
        }, 250);
      }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      keyExtractor={(row) => {
        if (row.kind === "content") return contentKeyExtractor(row.item, row.index);
        return `${row.kind}`;
      }}
      style={styles.songDetailClipList}
      contentContainerStyle={[
        styles.songDetailClipListContent,
        contentPaddingTop ? { paddingTop: contentPaddingTop } : null,
      ]}
      ListFooterComponent={<View style={{ height: footerSpacerHeight }} />}
      renderItem={({ item }) => {
        if (item.kind === "summary-section") {
          return summaryContent ? (
            <View style={styles.songDetailClipSummarySection}>{summaryContent}</View>
          ) : null;
        }

        if (item.kind === "empty") {
          return <Text style={styles.emptyText}>{emptyLabel}</Text>;
        }

        return renderContentRow(item.item, item.index);
      }}
    />
  );
}
