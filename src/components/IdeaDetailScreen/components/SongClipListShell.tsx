import { useCallback, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import { FlatList, Text, View } from "react-native";
import { styles } from "../styles";
import { type TimelineClipEntry } from "../../../clipGraph";
import { useStickyHeaderScroll } from "../../../hooks/useStickyHeaderScroll";
import { type ClipCardContextProps } from "../ClipCard";
import { PrimaryTakeSection } from "../PrimaryTakeSection";
import { SongClipListHeader } from "./songClipToolbar/SongClipListHeader";

type ShellRow<T> =
  | { kind: "summary-section" }
  | { kind: "primary-section" }
  | { kind: "ideas-header" }
  | { kind: "empty" }
  | { kind: "content"; item: T; index: number };

type SongClipListShellProps<T> = {
  contentRows: T[];
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  visibleIdeaCount: number;
  emptyLabel: string;
  onIdeasStickyChange?: (isSticky: boolean) => void;
  contentKeyExtractor: (item: T, index: number) => string;
  renderContentRow: (item: T, index: number) => ReactElement | null;
};

export function SongClipListShell<T>({
  contentRows,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  visibleIdeaCount,
  emptyLabel,
  onIdeasStickyChange,
  contentKeyExtractor,
  renderContentRow,
}: SongClipListShellProps<T>) {
  const listRows = useMemo<ShellRow<T>[]>(() => {
    const rows: ShellRow<T>[] = [];
    if (summaryContent) rows.push({ kind: "summary-section" });
    if (primaryEntry) rows.push({ kind: "primary-section" });
    rows.push({ kind: "ideas-header" });
    if (contentRows.length === 0) {
      rows.push({ kind: "empty" });
      return rows;
    }
    rows.push(...contentRows.map((item, index) => ({ kind: "content" as const, item, index })));
    return rows;
  }, [contentRows, primaryEntry, summaryContent]);

  const stickyIdeasIndex = useMemo(() => {
    let index = 0;
    if (summaryContent) index += 1;
    if (primaryEntry) index += 1;
    return index;
  }, [primaryEntry, summaryContent]);

  const summaryHeightRef = useRef(0);
  const primaryHeightRef = useRef(0);

  const getSnapY = useCallback(() => summaryHeightRef.current + primaryHeightRef.current, []);

  const { handleScroll, scrollEventThrottle } = useStickyHeaderScroll({
    onStickyChange: onIdeasStickyChange,
    getSnapY,
  });

  return (
    <FlatList
      data={listRows}
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

        if (item.kind === "primary-section") {
          return (
            <View
              onLayout={(e) => {
                primaryHeightRef.current = e.nativeEvent.layout.height;
              }}
            >
              <PrimaryTakeSection entry={primaryEntry} clipCardContext={clipCardContext} />
            </View>
          );
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
