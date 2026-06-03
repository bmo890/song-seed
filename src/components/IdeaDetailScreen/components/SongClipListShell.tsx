import { useCallback, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import { FlatList, Text, View } from "react-native";
import { styles } from "../styles";
import { type TimelineClipEntry } from "../../../clipGraph";
import { useStickyHeaderScroll } from "../../../hooks/useStickyHeaderScroll";
import { SongClipListHeader } from "./songClipToolbar/SongClipListHeader";

type ShellRow<T> =
  | { kind: "summary-section" }
  | { kind: "ideas-header" }
  | { kind: "empty" }
  | { kind: "content"; item: T; index: number };

type SongClipListShellProps<T> = {
  contentRows: T[];
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  visibleIdeaCount: number;
  emptyLabel: string;
  onIdeasStickyChange?: (isSticky: boolean) => void;
  /** When set (with a fresh nonce), scroll the content row at `index` into view. */
  scrollTarget?: { index: number; nonce: number } | null;
  contentKeyExtractor: (item: T, index: number) => string;
  renderContentRow: (item: T, index: number) => ReactElement | null;
};

export function SongClipListShell<T>({
  contentRows,
  summaryContent,
  footerSpacerHeight,
  visibleIdeaCount,
  emptyLabel,
  onIdeasStickyChange,
  scrollTarget,
  contentKeyExtractor,
  renderContentRow,
}: SongClipListShellProps<T>) {
  const listRows = useMemo<ShellRow<T>[]>(() => {
    const rows: ShellRow<T>[] = [];
    if (summaryContent) rows.push({ kind: "summary-section" });
    rows.push({ kind: "ideas-header" });
    if (contentRows.length === 0) {
      rows.push({ kind: "empty" });
      return rows;
    }
    rows.push(...contentRows.map((item, index) => ({ kind: "content" as const, item, index })));
    return rows;
  }, [contentRows, summaryContent]);

  const stickyIdeasIndex = useMemo(() => {
    let index = 0;
    if (summaryContent) index += 1;
    return index;
  }, [summaryContent]);

  // Number of non-content rows before the first content row (summary? + ideas-header).
  const leadingRowCount = useMemo(() => (summaryContent ? 1 : 0) + 1, [summaryContent]);

  const summaryHeightRef = useRef(0);
  const listRef = useRef<FlatList<ShellRow<T>>>(null);

  const getSnapY = useCallback(() => summaryHeightRef.current, []);

  const { handleScroll, scrollEventThrottle } = useStickyHeaderScroll({
    onStickyChange: onIdeasStickyChange,
    getSnapY,
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
    <FlatList
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
      stickyHeaderIndices={[stickyIdeasIndex]}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle}
      keyExtractor={(row) => {
        if (row.kind === "content") return contentKeyExtractor(row.item, row.index);
        return `${row.kind}`;
      }}
      style={styles.songDetailClipList}
      contentContainerStyle={styles.songDetailClipListContent}
      ListFooterComponent={<View style={{ height: footerSpacerHeight }} />}
      renderItem={({ item }) => {
        if (item.kind === "summary-section") {
          return summaryContent ? (
            <View
              style={styles.songDetailClipSummarySection}
              onLayout={(e) => {
                summaryHeightRef.current = e.nativeEvent.layout.height;
              }}
            >
              {summaryContent}
            </View>
          ) : null;
        }

        if (item.kind === "ideas-header") {
          return <SongClipListHeader visibleIdeaCount={visibleIdeaCount} />;
        }

        if (item.kind === "empty") {
          return <Text style={styles.emptyText}>{emptyLabel}</Text>;
        }

        return renderContentRow(item.item, item.index);
      }}
    />
  );
}
