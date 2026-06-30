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
import { HelpSheet, type HelpItem } from "../../common/HelpSheet";

type LyricsVersionPreviewProps = {
  sourceText: string;
  lines: LyricsLine[];
  hasChords: boolean;
  canChart: boolean;
  onEdit: () => void;
  onChords: () => void;
  onExport: () => void;
  onLayout: (height: number) => void;
  onContentSizeChange: (height: number) => void;
  onScroll: (nextY: number) => void;
  scrollIndicator: ReactNode;
};

const HELP_ITEMS: HelpItem[] = [
  { icon: "pencil", label: "Edit", description: "Edits what you're viewing — the words on Lyrics, the chords on Chords." },
  { icon: "musical-notes-outline", label: "Lyrics / Chords", description: "Switch between the plain words and the chord chart." },
  { icon: "share-outline", label: "Export", description: "Share or copy this version as text or a PDF." },
  { icon: "text", label: "Zoom", description: "On Chords, drag the slider to fit a long line on screen." },
];

export function LyricsVersionPreview({
  sourceText,
  lines,
  hasChords,
  canChart,
  onEdit,
  onChords,
  onExport,
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollIndicator,
}: LyricsVersionPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"lyrics" | "chords">(hasChords ? "chords" : "lyrics");
  const [helpVisible, setHelpVisible] = useState(false);
  const chordView = viewMode === "chords";

  return (
    <View style={[styles.lyricsVersionScreenBody, chordView ? styles.lyricsVersionBodyFlush : null]}>
      <View style={controls.row}>
        <View style={controls.group}>
          <Pressable
            style={({ pressed }) => [controls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={onExport}
            hitSlop={6}
            accessibilityLabel="Export"
          >
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [controls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => setHelpVisible(true)}
            hitSlop={6}
            accessibilityLabel="Help"
          >
            <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [controls.editIconBtn, pressed ? appStyles.pressDown : null]}
          onPress={chordView ? onChords : onEdit}
          hitSlop={6}
          accessibilityLabel={chordView ? "Edit chords" : "Edit lyrics"}
        >
          <Ionicons name="pencil" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>

      {canChart ? (
        <View style={controls.toggleWrap}>
          <LyricsChordsToggle value={viewMode} onChange={setViewMode} />
        </View>
      ) : null}

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
              <ChordChart lines={lines} editable={false} zoom={zoom} />
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
                <Text style={styles.lyricsPreviewText}>{sourceText || "No lyrics in this version."}</Text>
              </ScrollView>
              {scrollIndicator}
            </>
          )}
        </View>
      </View>

      <HelpSheet
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Lyrics version"
        intro="View this version, switch between words and chords, and edit either."
        items={HELP_ITEMS}
      />
    </View>
  );
}

// Mirrors the song chord-chart control row: a quiet icon group + one accented
// (filled-terracotta) primary. Icons over words — the (?) helper explains them.
const controls = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleWrap: {
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
});
