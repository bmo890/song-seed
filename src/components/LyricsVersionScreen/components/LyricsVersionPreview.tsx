import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import type { LyricsLine } from "../../../types";
import { ChordChart } from "./chords/ChordChart";

type LyricsVersionPreviewProps = {
  sourceText: string;
  lines: LyricsLine[];
  hasChords: boolean;
  canChart: boolean;
  showNewDraft: boolean;
  onEdit: () => void;
  onChords: () => void;
  onNewDraft: () => void;
  onExport: () => void;
  onLayout: (height: number) => void;
  onContentSizeChange: (height: number) => void;
  onScroll: (nextY: number) => void;
  scrollIndicator: ReactNode;
};

export function LyricsVersionPreview({
  sourceText,
  lines,
  hasChords,
  canChart,
  showNewDraft,
  onEdit,
  onChords,
  onNewDraft,
  onExport,
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollIndicator,
}: LyricsVersionPreviewProps) {
  return (
    <View style={styles.lyricsVersionScreenBody}>
      <View style={styles.lyricsVersionTopActions}>
        <Button
          label={showNewDraft ? "Edit" : "Edit as New"}
          onPress={onEdit}
          style={styles.lyricsActionBtn}
          textStyle={styles.lyricsActionBtnText}
        />
        {canChart ? (
          <Button
            variant="secondary"
            label="Chords"
            onPress={onChords}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
        ) : null}
        {showNewDraft ? (
          <Button
            variant="secondary"
            label="New Draft"
            onPress={onNewDraft}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
        ) : null}
        <Button
          variant="secondary"
          label="Export"
          onPress={onExport}
          style={styles.lyricsActionBtn}
          textStyle={styles.lyricsActionBtnText}
        />
      </View>
      <View style={styles.lyricsVersionDocumentFill}>
        <View
          style={[
            styles.lyricsPreviewWrap,
            styles.lyricsPreviewWrapExpanded,
            styles.lyricsPreviewWrapDocument,
            styles.lyricsScrollableWrap,
            hasChords ? { paddingHorizontal: 0, paddingVertical: 0 } : null,
          ]}
          onLayout={(event) => onLayout(event.nativeEvent.layout.height)}
        >
          {hasChords ? (
            <ChordChart lines={lines} editable={false} />
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
    </View>
  );
}
