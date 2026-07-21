import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { styles } from "../styles";
import type { LyricsLine } from "../../../types";
import { ChordChart } from "./chords/ChordChart";
import { ChordZoomBar } from "./chords/ChordZoomBar";
import { LyricsChordsToggle } from "../../common/LyricsChordsToggle";
import { TransposeChip } from "../../common/TransposeChip";
import { useChartPrefsStore } from "../../../state/useChartPrefsStore";
import { clampTransposeOffset, transposeLyricsLines } from "../../../domain/transpose";
import { UserText, type ContentDirection } from "../../../i18n";

type LyricsVersionPreviewProps = {
  sourceText: string;
  textDirection: ContentDirection;
  lines: LyricsLine[];
  hasChords: boolean;
  canChart: boolean;
  /** Enables the per-song display transpose on the chord view. */
  transposeIdeaId?: string;
  onEdit: () => void;
  onChords: () => void;
  onLayout: (height: number) => void;
  onContentSizeChange: (height: number) => void;
  onScroll: (nextY: number) => void;
  scrollIndicator: ReactNode;
};

export function LyricsVersionPreview({
  sourceText,
  textDirection,
  lines,
  hasChords,
  canChart,
  transposeIdeaId,
  onEdit,
  onChords,
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollIndicator,
}: LyricsVersionPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"lyrics" | "chords">(hasChords ? "chords" : "lyrics");
  const chordView = viewMode === "chords";

  // Non-destructive display transpose for the chord view (per song, persisted).
  const transposeByIdeaId = useChartPrefsStore((s) => s.transposeByIdeaId);
  const transpose = transposeIdeaId
    ? clampTransposeOffset(transposeByIdeaId[transposeIdeaId] ?? 0)
    : 0;
  const displayLines = transposeLyricsLines(lines, transpose);

  return (
    <View style={[styles.lyricsVersionScreenBody, chordView ? styles.lyricsVersionBodyFlush : null]}>
      {/* One row: the Lyrics/Chords toggle and the Edit primary. Edit acts on the
       * shown view. Export lives in the screen header. */}
      <View style={controls.row}>
        {canChart ? <LyricsChordsToggle value={viewMode} onChange={setViewMode} /> : <View />}
        <Pressable
          style={({ pressed }) => [controls.editIconBtn, pressed ? appStyles.pressDown : null]}
          onPress={chordView ? onChords : onEdit}
          hitSlop={6}
          accessibilityLabel={chordView ? "Edit chords" : "Edit lyrics"}
        >
          <Ionicons name="pencil" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={[styles.lyricsVersionDocumentFill, chordView ? styles.lyricsVersionBodyFlush : null]}>
        <View
          style={[
            styles.lyricsPreviewWrap,
            styles.lyricsPreviewWrapExpanded,
            styles.lyricsPreviewWrapDocument,
            styles.lyricsScrollableWrap,
            chordView ? styles.lyricsChordChartFlush : null,
          ]}
          onLayout={(event) => onLayout(event.nativeEvent.layout.height)}
        >
          {chordView ? (
            <>
              {transposeIdeaId ? (
                <View style={controls.transposeRow}>
                  <TransposeChip
                    offset={transpose}
                    onNudge={(delta) =>
                      useChartPrefsStore.getState().nudgeTranspose(transposeIdeaId, delta)
                    }
                    onReset={() => useChartPrefsStore.getState().resetTranspose(transposeIdeaId)}
                  />
                </View>
              ) : null}
              <ChordChart lines={displayLines} editable={false} zoom={zoom} />
              <ChordZoomBar zoom={zoom} onChange={setZoom} />
            </>
          ) : (
            <>
              <ScrollView
                style={styles.flexFill}
                contentContainerStyle={styles.lyricsVersionPreviewContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={(_, height) => onContentSizeChange(height)}
                onScroll={(event) => onScroll(event.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
              >
                <UserText value={sourceText} direction={textDirection} style={styles.lyricsPreviewText}>
                  {sourceText || "No lyrics in this version."}
                </UserText>
              </ScrollView>
              {scrollIndicator}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const controls = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  transposeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
